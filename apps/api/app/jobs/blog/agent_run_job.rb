# Executa o plano fechado pelo Ai::BlogAgent: por post, gera título, conteúdo,
# capa opcional e publica no WordPress via REST.
#
# RETRY DESLIGADO DE PROPÓSITO. O ApplicationJob reexecuta até 3 vezes em erro,
# e aqui isso republicaria posts que já foram ao ar — efeito colateral externo
# e irreversível. Este job nunca levanta exceção: cada falha é registrada no
# progresso e a execução segue para o próximo post.
#
# O progresso vai sendo gravado em ai_job.result a cada etapa, porque a tela
# faz polling e um lote pode levar vários minutos.

module Blog
  class AgentRunJob < ApplicationJob
    queue_as :ai

    # Sobrepõe o retry_on do ApplicationJob. Ver comentário do topo.
    retry_on StandardError, attempts: 1

    MAX_POSTS = 10 # espelha Ai::BlogAgent::MAX_POSTS

    def perform(workspace_id:, ai_job_id:, user_id:, plan:)
      workspace = Workspace.find_by(id: workspace_id)
      ai_job    = AiJob.find_by(id: ai_job_id)
      return unless workspace && ai_job

      posts = Array(plan["posts"]).first(MAX_POSTS)
      return finish_empty(ai_job) if posts.empty?

      ai_job.update!(status: "running", started_at: Time.current, sidekiq_jid: provider_job_id)

      state = {
        "total"     => posts.size,
        "completed" => 0,
        "failed"    => 0,
        "cost_usd"  => 0.0,
        "posts"     => posts.each_with_index.map do |p, i|
          { "index" => i, "topic" => p["topic"], "status" => "pending" }
        end,
      }
      ai_job.update!(result: state)

      with_workspace_rls(workspace.id, user_id: user_id) do
        wp     = wordpress_for(workspace)
        openai = plan["generate_cover"] ? openai_for(workspace) : nil

        posts.each_with_index do |post, index|
          # Cap estourado no meio do lote: para e diz o que já saiu.
          begin
            AiCostCap.require!(workspace)
          rescue CapReached => e
            mark_remaining_skipped(ai_job, state, index, "cap_reached: #{e.message}")
            break
          end

          run_one(workspace: workspace, user_id: user_id, wp: wp, openai: openai,
                  plan: plan, post: post, index: index, ai_job: ai_job, state: state)
        end
      end

      ai_job.update!(
        status:          state["failed"].positive? && state["completed"].zero? ? "error" : "done",
        finished_at:     Time.current,
        cost_usd_actual: state["cost_usd"],
        result:          state,
        error:           state["failed"].positive? ? "#{state['failed']} de #{state['total']} posts falharam" : nil
      )
    rescue StandardError => e
      # Nunca propaga: relançar acionaria retry e republicaria o que já subiu.
      Rails.logger.error("[BlogAgentRunJob] #{e.class}: #{e.message}")
      ai_job&.update!(status: "error", error: "#{e.class}: #{e.message}", finished_at: Time.current)
      nil
    end

    private

    def run_one(workspace:, user_id:, wp:, openai:, plan:, post:, index:, ai_job:, state:)
      brief  = [post["topic"], post["angle"], plan["notes"]].compact_blank.join(". ")
      record = nil

      touch(ai_job, state, index, status: "running", step: "title")
      title_result = Ai::BlogWriter.title(workspace: workspace, brief: brief)
      add_cost(state, title_result.ai_result.cost_usd)

      touch(ai_job, state, index, step: "content", title: title_result.text)
      content_result = Ai::BlogWriter.content(workspace: workspace, title: title_result.text, brief: brief)
      add_cost(state, content_result.ai_result.cost_usd)

      # Rascunho local ANTES de falar com o WordPress. Se a publicação falhar
      # daqui pra frente, o texto gerado (que já custou dinheiro) sobrevive em
      # "Meus posts" e o usuário republica de lá em vez de gerar tudo de novo.
      record = archive_draft!(
        workspace: workspace, user_id: user_id, ai_job: ai_job,
        title: title_result.text, content: content_result.text,
        brief: brief, plan: plan
      )

      featured = nil
      if openai
        touch(ai_job, state, index, step: "cover")
        featured = build_cover(workspace: workspace, wp: wp, openai: openai,
                               title: title_result.text, brief: brief, state: state)
        record&.update_columns(featured_media_id: featured, updated_at: Time.current) if featured
      end

      touch(ai_job, state, index, step: "publish")
      published = wp.publish(
        title:          title_result.text,
        content:        content_result.text,
        status:         plan["status"],
        category_ids:   Array(plan["category_ids"]),
        tag_ids:        Array(plan["tag_ids"]),
        featured_media: featured
      )

      record&.mark_published!(published)

      state["completed"] += 1
      touch(ai_job, state, index,
            status: "done", step: nil, blog_post_id: record&.id,
            post_id: published[:id], url: published[:url], post_status: published[:status])

      audit!(workspace: workspace, user_id: user_id, published: published)
    rescue StandardError => e
      Rails.logger.error("[BlogAgentRunJob] post #{index} falhou: #{e.class}: #{e.message}")
      state["failed"] += 1
      record&.update_columns(last_error: e.message.to_s.slice(0, 500), updated_at: Time.current)
      touch(ai_job, state, index,
            status: "error", step: nil, blog_post_id: record&.id,
            error: e.message.to_s.slice(0, 300))
    end

    # O acervo é acessório ao lote: se gravar falhar, o post ainda vai pro
    # WordPress. Devolve nil e o resto do fluxo segue sem ele.
    #
    # `requires_new: true` abre um SAVEPOINT, e não é detalhe: o lote inteiro
    # roda dentro de UMA transação (with_workspace_rls). Sem savepoint, um erro
    # de banco aqui aborta essa transação, e aí o rescue abaixo não salvaria
    # nada — toda query seguinte do lote morreria com InFailedSqlTransaction.
    # Com savepoint, o rollback é só deste INSERT e o lote continua.
    def archive_draft!(workspace:, user_id:, ai_job:, title:, content:, brief:, plan:)
      ApplicationRecord.transaction(requires_new: true) do
        workspace.blog_posts.create!(
          origin:       "univercopy",
          status:       "draft",
          title:        title.to_s.strip.slice(0, 500).presence || "Sem título",
          content:      content,
          brief:        brief.to_s.strip.slice(0, 2_000).presence,
          category_ids: Array(plan["category_ids"]).map(&:to_i),
          tag_ids:      Array(plan["tag_ids"]).map(&:to_i),
          created_by:   user_id,
          ai_job_id:    ai_job.id
        )
      end
    rescue StandardError => e
      Rails.logger.error("[BlogAgentRunJob] rascunho local falhou: #{e.class}: #{e.message}")
      nil
    end

    # Capa é acessório: se falhar, o post sai sem capa em vez de perder o texto.
    def build_cover(workspace:, wp:, openai:, title:, brief:, state:)
      prompt = Ai::BlogWriter.cover_prompt(workspace: workspace, title: title, extra: brief)
      image  = openai.generate_image(prompt: prompt)
      add_cost(state, image[:cost_usd])

      media = wp.upload_media(
        data:     image[:data],
        filename: "capa-#{Time.current.to_i}.#{image[:format]}",
        mime:     image[:mime],
        alt:      title
      )
      media[:id]
    rescue StandardError => e
      Rails.logger.warn("[BlogAgentRunJob] capa falhou, seguindo sem ela: #{e.message}")
      nil
    end

    def touch(ai_job, state, index, **attrs)
      entry = state["posts"][index]
      return unless entry

      attrs.each { |k, v| v.nil? ? entry.delete(k.to_s) : entry[k.to_s] = v }
      ai_job.update_columns(result: state, updated_at: Time.current)
    end

    def add_cost(state, cost)
      state["cost_usd"] = (state["cost_usd"].to_f + cost.to_f).round(5)
    end

    def mark_remaining_skipped(ai_job, state, from_index, reason)
      state["posts"][from_index..].each do |entry|
        next unless entry["status"] == "pending"

        entry["status"] = "skipped"
        entry["error"]  = reason.to_s.slice(0, 300)
      end
      ai_job.update_columns(result: state, updated_at: Time.current)
    end

    def finish_empty(ai_job)
      ai_job.update!(status: "error", error: "plano sem posts", finished_at: Time.current)
      nil
    end

    def wordpress_for(workspace)
      integration = workspace.integrations.find_by!(integration_type: "wordpress", status: "connected")
      Connectors::Wordpress.new(integration.config)
    end

    def openai_for(workspace)
      integration = workspace.integrations.find_by(integration_type: "openai", status: "connected")
      integration && Connectors::OpenAi.new(integration.config)
    end

    def audit!(workspace:, user_id:, published:)
      AuditLog.create!(
        workspace_id: workspace.id,
        user_id:      user_id,
        action:       "blog.agent_post_#{published[:status]}",
        metadata:     { post_id: published[:id], url: published[:url], status: published[:status] }
      )
    rescue StandardError => e
      Rails.logger.error("[BlogAgentRunJob] audit_log falhou: #{e.message}")
    end
  end
end
