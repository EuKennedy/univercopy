module Api
  module V1
    # Endpoints do wizard de onboarding. Estado vive em:
    #   - workspace.onboarding_status (pending|dna_loaded|qa_done|done)
    #   - workspace.brand_dnas[atual] (alimentado pelo job)
    #   - ai_jobs (tracking do job de DNA)
    class OnboardingController < BaseController
      # GET /api/v1/onboarding/state
      # Retorna o estado pra que o wizard saiba em qual step continuar.
      def state
        workspace = current_app_user.owned_workspaces.order(created_at: :desc).first
        job       = workspace && AiJob.where(workspace_id: workspace.id, task_kind: "extract_dna_from_url")
                                       .order(created_at: :desc).first

        render json: {
          workspace: workspace && workspace_payload(workspace),
          dna:       workspace && brand_dna_payload(workspace),
          job:       job && ai_job_payload(job),
        }
      end

      # POST /api/v1/onboarding/start
      # body: { url, model? }
      # Cria workspace (idempotente: reusa workspace pending do user) +
      # enfileira DnaExtractFromUrlJob.
      def start
        url   = params.require(:url).to_s.strip
        model = params[:model].presence || "auto"
        uri   = Security::SsrfGuard.safe!(url)

        workspace = current_app_user.owned_workspaces.where(onboarding_status: "pending").order(created_at: :desc).first ||
                    create_workspace_for(uri)

        # Atualiza site_url da workspace pra refletir a URL submetida.
        workspace.update!(site_url: uri.to_s) if workspace.site_url != uri.to_s

        ai_job = AiJob.create!(
          workspace_id: workspace.id,
          task_kind:    "extract_dna_from_url",
          status:       "queued",
          payload:      { url: uri.to_s, model: model },
        )

        Onboarding::DnaExtractFromUrlJob.perform_later(
          workspace_id: workspace.id,
          ai_job_id:    ai_job.id,
          url:          uri.to_s,
          model:        model,
        )

        render json: {
          workspace: workspace_payload(workspace),
          job:       ai_job_payload(ai_job),
        }, status: :accepted
      end

      # GET /api/v1/onboarding/job/:id — polling do status do job.
      def job
        job = AiJob.find_by!(id: params[:id])
        # RLS já filtra: se job não é do workspace do user, find_by retorna nil.
        render json: ai_job_payload(job)
      end

      # PATCH /api/v1/onboarding/dna
      # body: { workspace_slug, dna: { marca, posicionamento, tom, publico, ... } }
      def update_dna
        workspace = current_app_user.owned_workspaces.find_by!(slug: params.require(:workspace_slug))
        permitted = params.require(:dna).permit(
          :marca, :missao, :posicionamento, :tom, :publico, :consciencia,
          valores: [], produtos: [], ofertas: [], provas: [], objecoes: [], evitar: [],
        ).to_h

        ApplicationRecord.with_workspace_rls(workspace.id, user_id: current_app_user.id) do
          dna = workspace.brand_dnas.find_or_initialize_by(kind: "atual")
          dna.assign_attributes(permitted.merge(updated_at: Time.current))
          dna.save!
        end

        render json: { ok: true }
      end

      # PATCH /api/v1/onboarding/qa
      # body: { workspace_slug, qa: { publico_alvo, faixa_etaria, faixa_renda, ... } }
      def update_qa
        workspace = current_app_user.owned_workspaces.find_by!(slug: params.require(:workspace_slug))
        qa = params.require(:qa).permit(
          :publico_alvo, :faixa_etaria, :faixa_renda, :genero, :geografia,
          interesses: [],
        ).to_h

        ApplicationRecord.with_workspace_rls(workspace.id, user_id: current_app_user.id) do
          dna = workspace.brand_dnas.find_or_create_by(kind: "atual")
          dna.update!(publico_alvo_detalhado: qa)

          # RAG ingest — Q&A vira documento separado, sempre disponível pra retrieval.
          qa_text = qa_to_text(qa, workspace)
          Rag::Ingester.call(
            workspace:   workspace,
            source_kind: "onboarding_qna",
            source_ref:  "qa-#{workspace.id}",
            title:       "Onboarding Q&A — público alvo",
            text:        qa_text,
            metadata:    qa,
          )

          workspace.update!(onboarding_status: "qa_done") if %w[pending dna_loaded].include?(workspace.onboarding_status)
        end

        render json: { ok: true }
      end

      # POST /api/v1/onboarding/complete
      def complete
        workspace = current_app_user.owned_workspaces.find_by!(slug: params.require(:workspace_slug))
        workspace.update!(onboarding_status: "done")
        render json: { ok: true, workspace_slug: workspace.slug }
      end

      private

      def create_workspace_for(uri)
        name = (uri.host || "Nova marca").gsub(/^www\./, "").split(".").first.to_s.capitalize
        slug = "ws-#{SecureRandom.hex(4)}"

        # SECURITY DEFINER function cria workspace + owner_member + dnas atomicamente.
        ApplicationRecord.with_user(current_app_user.id) do
          ActiveRecord::Base.connection.exec_query(
            "SELECT * FROM create_workspace($1, $2, $3, $4, $5)",
            "CreateWorkspace",
            [name, slug, uri.to_s, current_app_user.default_locale, current_app_user.preferred_ai_model == "ultra" ? "ultra" : "entry"],
          )
        end
        Workspace.find_by!(slug: slug)
      end

      def workspace_payload(ws)
        ws.slice(:id, :slug, :name, :site_url, :plan, :default_locale, :onboarding_status)
      end

      def brand_dna_payload(ws)
        dna = ws.brand_dnas.find_by(kind: "atual") or return nil
        dna.slice(:marca, :missao, :posicionamento, :tom, :publico, :consciencia,
                  :valores, :produtos, :ofertas, :provas, :objecoes, :evitar,
                  :publico_alvo_detalhado, :source_url, :updated_at)
      end

      def ai_job_payload(job)
        {
          id:                 job.id,
          status:             job.status,
          task_kind:          job.task_kind,
          model:              job.model,
          cost_usd:           job.cost_usd_actual || job.cost_usd_estimated,
          error:              job.error,
          started_at:         job.started_at,
          finished_at:        job.finished_at,
          result:             job.result,
        }
      end

      def qa_to_text(qa, workspace)
        marca = workspace.active_brand_dna&.marca || workspace.name
        <<~TEXT
          # Perfil de público da marca #{marca}

          Cliente ideal: #{qa['publico_alvo']}
          Faixa etária predominante: #{qa['faixa_etaria']}
          Faixa de renda: #{qa['faixa_renda']}
          Gênero: #{qa['genero']}
          Geografia: #{qa['geografia']}
          Interesses-chave: #{Array(qa['interesses']).join(', ')}
        TEXT
      end
    end
  end
end
