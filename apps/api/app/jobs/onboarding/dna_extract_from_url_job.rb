# Job de extração de DNA durante o onboarding. Roda na fila :ai.
# Fluxo:
#   1) Scrape + Anthropic (Ai::DnaExtractor)
#   2) Upsert do BrandDna (kind=atual)
#   3) Ingest do scraped_text no RAG (source_kind=site)
#   4) Atualiza workspace.onboarding_status pra 'dna_loaded' (idempotente)
#
# Em caso de erro, marca ai_jobs row como :error e workspace continua em
# 'pending' — UI sabe que precisa retry/manual.

module Onboarding
  class DnaExtractFromUrlJob < ApplicationJob
    queue_as :ai

    def perform(workspace_id:, ai_job_id:, url:, model: "auto")
      workspace = Workspace.find_by(id: workspace_id)
      ai_job    = AiJob.find_by(id: ai_job_id)
      return unless workspace && ai_job

      ai_job.update!(status: "running", started_at: Time.current, sidekiq_jid: provider_job_id)

      result = with_workspace_rls(workspace.id) do
        out = Ai::DnaExtractor.call(url, model: model.to_sym)

        dna_attrs = out[:dna].slice("marca", "missao", "posicionamento", "tom", "publico", "consciencia").merge(
          valores:    out[:dna]["valores"],
          produtos:   out[:dna]["produtos"],
          ofertas:    out[:dna]["ofertas"],
          provas:     out[:dna]["provas"],
          objecoes:   out[:dna]["objecoes"],
          evitar:     out[:dna]["evitar"],
          source_url: url,
        )

        BrandDna.upsert(
          dna_attrs.merge(workspace_id: workspace.id, kind: "atual", updated_at: Time.current),
          unique_by: %i[workspace_id kind],
        )

        marca = out[:dna]["marca"].to_s.strip
        workspace.update!(name: marca) if marca.present?

        Rag::Ingester.call(
          workspace:   workspace,
          source_kind: "site",
          source_ref:  url,
          title:       "Conteúdo público de #{URI.parse(url).host}",
          text:        out[:scraped_text],
          metadata:    { extracted_marca: marca, model: out[:ai_result].model },
        )

        workspace.update!(onboarding_status: "dna_loaded") if workspace.onboarding_pending?

        {
          dna:           out[:dna],
          model:         out[:ai_result].model,
          input_tokens:  out[:ai_result].input_tokens,
          output_tokens: out[:ai_result].output_tokens,
          cost_usd:      out[:ai_result].cost_usd,
        }
      end

      ai_job.update!(
        status:              "done",
        finished_at:         Time.current,
        model:               result[:model].to_s,
        prompt_tokens:       result[:input_tokens],
        output_tokens:       result[:output_tokens],
        cost_usd_actual:     result[:cost_usd],
        cost_usd_estimated:  result[:cost_usd],
        result:              { dna: result[:dna] },
      )
    rescue Ai::CallFailed, Ai::ScrapeFailed, Security::SsrfBlocked => e
      ai_job&.update!(status: "error", error: e.message, finished_at: Time.current)
      raise  # ApplicationJob retry policy decide
    rescue StandardError => e
      Rails.logger.error("[OnboardingDnaJob] #{e.class}: #{e.message}")
      ai_job&.update!(status: "error", error: "#{e.class}: #{e.message}", finished_at: Time.current)
      raise
    end
  end
end
