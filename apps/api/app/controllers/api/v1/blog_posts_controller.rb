module Api
  module V1
    # Publicação no blog WordPress via REST API v2, com geração assistida por IA.
    #
    # Duas credenciais, ambas POR WORKSPACE e cifradas na tabela `integrations`
    # (TENANT_CREDENTIALS_KEY): o WordPress (usuário + senha de aplicação) e a
    # OpenAI (chave, usada só para gerar a capa). Nenhuma delas vem de ENV.
    #
    # Texto (título e corpo) usa o Anthropic que já move o resto do produto;
    # imagem usa OpenAI porque é o pedido do produto. Toda geração passa por
    # PlanFeatures + AiCostCap e vira um AiJob para o custo entrar na conta.
    #
    # rescue_from é avaliado na ordem REVERSA da declaração — a BaseController
    # declara o catch-all StandardError primeiro, então estes vêm antes.
    class BlogPostsController < WorkspaceScopedController
      class NotConnected   < StandardError; end
      class OpenAiMissing  < StandardError; end

      NOT_CONNECTED_MSG = "Nenhum WordPress conectado neste workspace. " \
                          "Conecte em Configurações → Integrações.".freeze
      OPENAI_MISSING_MSG = "Nenhuma chave da OpenAI cadastrada neste workspace. " \
                           "Cadastre em Configurações → Integrações para gerar capas.".freeze

      rescue_from Connectors::Wordpress::ConnectionError, with: :render_blog_unreachable
      rescue_from Connectors::Wordpress::PublishError,    with: :render_blog_failed
      rescue_from Connectors::OpenAi::ConnectionError,    with: :render_openai_failed
      rescue_from Connectors::OpenAi::GenerationError,    with: :render_openai_failed
      rescue_from NotConnected,                           with: :render_blog_not_connected
      rescue_from OpenAiMissing,                          with: :render_openai_missing

      # ---------------------------------------------------------------
      # Estado e taxonomias
      # ---------------------------------------------------------------

      # GET /blog/status
      def status
        return render json: base_status(connected: false) if wp_integration.blank?

        begin
          result = wp.test_connection
          render json: base_status(connected: true, reachable: true, site: result[:site])
        rescue Connectors::Wordpress::ConnectionError => e
          Rails.logger.warn("[BlogPosts] WordPress indisponível: #{e.message}")
          render json: base_status(connected: true, site: wp_integration.config["base_url"]).merge(message: e.message)
        end
      end

      # GET /blog/categories
      def categories
        render json: { categories: wp.categories }
      end

      # GET /blog/tags
      def tags
        render json: { tags: wp.tags }
      end

      # POST /blog/categories — botão "+" da tela.
      def create_category
        render json: { term: wp.create_category(term_params[:name]) }, status: :created
      end

      # POST /blog/tags — botão "+" da tela.
      def create_tag
        render json: { term: wp.create_tag(term_params[:name]) }, status: :created
      end

      # ---------------------------------------------------------------
      # Geração com IA
      # ---------------------------------------------------------------

      # POST /blog/generate/title  body: { brief?, model? }
      def generate_title
        guard_text_generation!
        b = generate_params

        result = Ai::BlogWriter.title(workspace: current_workspace, brief: b[:brief], model: b[:model])
        record_ai_job!("blog_title", result.ai_result)

        render json: { title: result.text, cost: AiCostCap.report(current_workspace) }
      end

      # POST /blog/generate/content  body: { title?, brief?, model? }
      def generate_content
        guard_text_generation!
        b = generate_params

        result = Ai::BlogWriter.content(
          workspace: current_workspace, title: b[:title], brief: b[:brief], model: b[:model]
        )
        record_ai_job!("blog_content", result.ai_result)

        render json: { content: result.text, cost: AiCostCap.report(current_workspace) }
      end

      # POST /blog/cover/generate  body: { title?, prompt?, size?, quality? }
      # Gera na OpenAI e já sobe pra biblioteca de mídia do WordPress — assim o
      # navegador recebe só uma URL em vez de megabytes de base64.
      def generate_cover
        PlanFeatures.require!(current_workspace, :ai_cover_image)
        AiCostCap.require!(current_workspace)

        b      = cover_params
        prompt = b[:prompt].presence ||
                 Ai::BlogWriter.cover_prompt(workspace: current_workspace, title: b[:title], extra: b[:brief])

        image = openai.generate_image(
          prompt:  prompt,
          size:    b[:size].presence    || Connectors::OpenAi::DEFAULT_SIZE,
          quality: b[:quality].presence || Connectors::OpenAi::DEFAULT_QUALITY
        )

        record_image_job!(prompt, image)

        media = wp.upload_media(
          data:     image[:data],
          filename: "capa-#{Time.current.to_i}.#{image[:format]}",
          mime:     image[:mime],
          alt:      b[:title]
        )

        render json: { media: media, prompt: prompt, cost: AiCostCap.report(current_workspace) }, status: :created
      end

      # POST /blog/cover/upload  body: { filename, mime, data_base64 }
      # Capa vinda do computador do usuário.
      def upload_cover
        b = upload_params

        mime = b[:mime].to_s
        unless ALLOWED_IMAGE_MIMES.include?(mime)
          return render json: { error: "unsupported_media", message: "Formato não suportado: #{mime}. Use JPEG, PNG ou WebP." },
                        status: :unprocessable_entity
        end

        data = decode_base64(b[:data_base64])
        return render json: { error: "invalid_upload", message: "Arquivo inválido ou vazio." }, status: :unprocessable_entity if data.blank?

        media = wp.upload_media(data: data, filename: b[:filename].presence || "capa", mime: mime, alt: b[:alt])
        render json: { media: media }, status: :created
      end

      # ---------------------------------------------------------------
      # Agente — planeja um lote de posts conversando, depois executa
      # ---------------------------------------------------------------

      # POST /blog/agent/message  body: { messages: [{role, content}] }
      # Só conversa. Não gera nem publica nada.
      def agent_message
        guard_text_generation!

        result = Ai::BlogAgent.call(
          workspace:  current_workspace,
          messages:   agent_message_params,
          categories: wp.categories,
          tags:       wp.tags,
          has_openai: openai_integration.present?
        )
        record_ai_job!("blog_agent", result.ai_result)

        render json: {
          reply: result.reply,
          plan:  result.plan,
          ready: result.ready,
          cost:  AiCostCap.report(current_workspace),
        }
      end

      # POST /blog/agent/run  body: { plan: {...} }
      # Confirmação explícita do usuário. Enfileira e devolve o job pra polling.
      def agent_run
        guard_text_generation!
        wp # levanta NotConnected antes de enfileirar, em vez de falhar no worker

        plan = sanitized_plan
        if plan["posts"].blank?
          return render json: { error: "empty_plan", message: "O plano não tem nenhum post." },
                        status: :unprocessable_entity
        end

        ai_job = AiJob.create!(
          workspace_id: current_workspace.id,
          task_kind:    "blog_agent_run",
          status:       "queued",
          payload:      { posts: plan["posts"].size, status: plan["status"], cover: plan["generate_cover"] }
        )

        Blog::AgentRunJob.perform_later(
          workspace_id: current_workspace.id,
          ai_job_id:    ai_job.id,
          user_id:      current_app_user.id,
          plan:         plan
        )

        render json: { job: ai_job_payload(ai_job) }, status: :accepted
      end

      # GET /blog/agent/run/:id — polling do progresso.
      def agent_run_status
        job = current_workspace.ai_jobs.find_by!(id: params[:id])
        render json: { job: ai_job_payload(job) }
      end

      # ---------------------------------------------------------------
      # Publicação
      # ---------------------------------------------------------------

      # POST /blog/publish
      def publish
        p = publish_params

        result = wp.publish(
          title:          p[:title],
          content:        p[:content],
          status:         p[:status].presence || "draft",
          excerpt:        p[:excerpt],
          category_ids:   Array(p[:category_ids]),
          tag_ids:        Array(p[:tag_ids]),
          featured_media: p[:featured_media]
        )

        record_audit!(result)
        render json: { ok: true, post: result }, status: :created
      end

      private

      ALLOWED_IMAGE_MIMES = %w[image/jpeg image/png image/webp].freeze
      # 8MB — mesmo teto do cliente e do bodySizeLimit do server action.
      MAX_UPLOAD_BYTES    = 8 * 1_048_576

      def base_status(connected:, reachable: false, site: nil)
        { connected: connected, reachable: reachable, site: site, openai: openai_integration.present? }
      end

      # --- conectores ---

      def wp_integration
        @wp_integration ||= current_workspace.integrations.find_by(integration_type: "wordpress", status: "connected")
      end

      def openai_integration
        @openai_integration ||= current_workspace.integrations.find_by(integration_type: "openai", status: "connected")
      end

      def wp
        @wp ||= begin
          raise NotConnected, NOT_CONNECTED_MSG if wp_integration.blank?

          PlanFeatures.require!(current_workspace, :connector_wordpress)
          Connectors::Wordpress.new(wp_integration.config)
        end
      end

      def openai
        @openai ||= begin
          raise OpenAiMissing, OPENAI_MISSING_MSG if openai_integration.blank?

          PlanFeatures.require!(current_workspace, :connector_openai)
          Connectors::OpenAi.new(openai_integration.config)
        end
      end

      def guard_text_generation!
        PlanFeatures.require!(current_workspace, :ai_blog_writer)
        AiCostCap.require!(current_workspace)
      end

      # --- params ---

      def publish_params
        params.require(:post)
              .permit(:title, :content, :excerpt, :status, :featured_media, category_ids: [], tag_ids: [])
      end

      def generate_params
        params.fetch(:generate, {}).permit(:title, :brief, :model)
      end

      def cover_params
        params.fetch(:cover, {}).permit(:title, :brief, :prompt, :size, :quality)
      end

      def upload_params
        params.require(:cover).permit(:filename, :mime, :alt, :data_base64)
      end

      def term_params
        params.require(:term).permit(:name)
      end

      def agent_message_params
        params.require(:messages).map { |m| m.permit(:role, :content).to_h }
      end

      # O plano volta do cliente, então NADA nele é confiável. Reconstruímos
      # campo a campo com tipo, teto e lista branca — o cliente só escolhe
      # dentro do que o servidor aceita.
      def sanitized_plan
        raw = params.require(:plan).permit(
          :status, :generate_cover, :notes,
          category_ids: [], tag_ids: [],
          posts: %i[topic angle]
        )

        posts = Array(raw[:posts]).filter_map do |p|
          topic = p[:topic].to_s.strip
          next if topic.blank?

          { "topic" => topic.slice(0, 500), "angle" => p[:angle].to_s.strip.slice(0, 500).presence }.compact
        end.first(Ai::BlogAgent::MAX_POSTS)

        {
          "posts"          => posts,
          "status"         => %w[draft publish].include?(raw[:status].to_s) ? raw[:status].to_s : "draft",
          # Capa só se houver chave — o cliente não decide isso sozinho.
          "generate_cover" => ActiveModel::Type::Boolean.new.cast(raw[:generate_cover]).present? && openai_integration.present?,
          "category_ids"   => Array(raw[:category_ids]).map(&:to_i).reject(&:zero?).uniq.first(20),
          "tag_ids"        => Array(raw[:tag_ids]).map(&:to_i).reject(&:zero?).uniq.first(20),
          "notes"          => raw[:notes].to_s.strip.slice(0, 2_000).presence,
        }.compact
      end

      def ai_job_payload(job)
        {
          id:          job.id,
          status:      job.status,
          task_kind:   job.task_kind,
          cost_usd:    job.cost_usd_actual || job.cost_usd_estimated,
          error:       job.error,
          started_at:  job.started_at,
          finished_at: job.finished_at,
          result:      job.result,
        }
      end

      # Base64 do navegador pode vir como data URL. Rejeita o que passar do teto
      # antes de decodificar, pra não alocar memória à toa.
      def decode_base64(raw)
        payload = raw.to_s.sub(/\Adata:[^;]+;base64,/, "")
        return nil if payload.blank?
        return nil if payload.bytesize > (MAX_UPLOAD_BYTES * 4 / 3) + 1024

        decoded = Base64.decode64(payload)
        decoded.presence
      rescue ArgumentError
        nil
      end

      # --- registro de custo e auditoria ---

      def record_ai_job!(kind, ai_result)
        AiJob.create!(
          workspace_id:     current_workspace.id,
          task_kind:        kind,
          status:           "done",
          model:            ai_result.model.to_s,
          prompt_tokens:    ai_result.input_tokens,
          output_tokens:    ai_result.output_tokens,
          cost_usd_actual:  ai_result.cost_usd,
          payload:          {},
          finished_at:      Time.current
        )
      rescue StandardError => e
        Rails.logger.error("[BlogPosts] ai_job (#{kind}) falhou: #{e.class}: #{e.message}")
      end

      def record_image_job!(prompt, image)
        AiJob.create!(
          workspace_id:    current_workspace.id,
          task_kind:       "blog_cover",
          status:          "done",
          model:           Connectors::OpenAi::MODEL,
          prompt_tokens:   image[:usage]["input_tokens"],
          output_tokens:   image[:usage]["output_tokens"],
          cost_usd_actual: image[:cost_usd],
          payload:         { prompt: prompt.to_s.slice(0, 1000) },
          finished_at:     Time.current
        )
      rescue StandardError => e
        Rails.logger.error("[BlogPosts] ai_job (blog_cover) falhou: #{e.class}: #{e.message}")
      end

      def record_audit!(result)
        AuditLog.create!(
          workspace_id: current_workspace.id,
          user_id:      current_app_user.id,
          action:       "blog.post_#{result[:status]}",
          metadata:     { post_id: result[:id], url: result[:url], status: result[:status] },
          ip:           request.remote_ip,
          user_agent:   request.user_agent.to_s.first(512)
        )
      rescue StandardError => e
        # O post já existe no WordPress. Falhar aqui faria o usuário reenviar e
        # duplicar o post — loga e segue.
        Rails.logger.error("[BlogPosts] audit_log falhou: #{e.class}: #{e.message}")
      end

      # --- erros ---

      def render_blog_not_connected(e)
        render json: { error: "blog_not_connected", message: e.message }, status: :unprocessable_entity
      end

      def render_openai_missing(e)
        render json: { error: "openai_not_connected", message: e.message }, status: :unprocessable_entity
      end

      def render_blog_unreachable(e)
        Rails.logger.warn("[BlogPosts] conexão falhou: #{e.message}")
        render json: { error: "blog_unreachable", message: e.message }, status: :unprocessable_entity
      end

      def render_blog_failed(e)
        Rails.logger.error("[BlogPosts] publicação falhou: #{e.message}")
        render json: { error: "blog_publish_failed", message: e.message }, status: :unprocessable_entity
      end

      def render_openai_failed(e)
        Rails.logger.error("[BlogPosts] OpenAI falhou: #{e.message}")
        render json: { error: "cover_generation_failed", message: e.message }, status: :bad_gateway
      end
    end
  end
end
