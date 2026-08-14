module Api
  module V1
    # Publicação no Fluent Community.
    #
    # Conector separado do WordPress de propósito: na prática a comunidade mora
    # num site diferente do blog (na Lizzon o blog é lizzon.com.br e o Fluent
    # Community está em univerhair.com.br), então base_url e credencial são
    # próprias. Ver Connectors::FluentCommunity.
    #
    # O que sai daqui NÃO é o post do blog republicado: é um texto curto em
    # markdown, gerado por IA, que dá o gancho e linka o artigo. O feed tem teto
    # de 15k caracteres e não renderiza HTML — republicar o corpo seria despejar
    # marcação literal na comunidade.
    class CommunityController < WorkspaceScopedController
      class NotConnected < StandardError; end

      NOT_CONNECTED_MSG = "Nenhuma comunidade conectada neste workspace. " \
                          "Conecte o Fluent Community em Configurações → Integrações.".freeze

      rescue_from Connectors::FluentCommunity::ConnectionError, with: :render_unreachable
      rescue_from Connectors::FluentCommunity::PublishError,    with: :render_failed
      rescue_from NotConnected,                                 with: :render_not_connected

      # GET /community/status
      def status
        return render json: { connected: false, reachable: false } if integration.blank?

        begin
          result = community.test_connection
          render json: {
            connected:     true,
            reachable:     true,
            site:          result[:site],
            spaces_count:  result[:spaces],
            default_space: community.default_space,
          }
        rescue Connectors::FluentCommunity::ConnectionError => e
          Rails.logger.warn("[Community] indisponível: #{e.message}")
          render json: {
            connected: true, reachable: false,
            site:      integration.config["base_url"],
            message:   e.message,
          }
        end
      end

      # GET /community/spaces — só os que aceitam post de feed.
      def spaces
        render json: { spaces: community.spaces, default_space: community.default_space }
      end

      # POST /community/posts/:id/message — gera o texto do anúncio, sem publicar.
      # Separado do publish pra que o usuário leia e ajuste antes de ir ao feed.
      def generate_message
        PlanFeatures.require!(current_workspace, :ai_blog_writer)
        AiCostCap.require!(current_workspace)

        post   = find_post!
        result = Ai::CommunityWriter.call(
          workspace: current_workspace,
          title:     post.title,
          content:   post.content,
          url:       post.url,
          model:     params[:model]
        )
        record_ai_job!("community_message", result.ai_result)

        render json: { message: result.text, cost: AiCostCap.report(current_workspace) }
      end

      # POST /community/posts/:id/publish  body: { message, space, title? }
      def publish
        post = find_post!

        if post.community_published?
          return render json: {
            error:   "already_shared",
            message: "Este post já foi anunciado na comunidade.",
            url:     post.community_url,
          }, status: :unprocessable_entity
        end

        unless post.shareable_to_community?
          return render json: {
            error:   "not_shareable",
            message: "Publique o post no blog antes de anunciá-lo na comunidade — " \
                     "o post da comunidade leva o link do artigo.",
          }, status: :unprocessable_entity
        end

        b       = publish_params
        message = b[:message].to_s.strip
        return render json: { error: "empty_message", message: "A mensagem está vazia." },
                      status: :unprocessable_entity if message.blank?

        # Mesmo tratamento do publish_draft: o erro é resolvido aqui, sem
        # re-levantar, senão o around_action de RLS faz rollback do last_error.
        begin
          result = community.publish(
            message:   message,
            space:     b[:space],
            title:     b[:title].presence || post.title,
            topic_ids: Array(b[:topic_ids])
          )
        rescue Connectors::FluentCommunity::ConnectionError => e
          post.update_columns(last_error: e.message.to_s.slice(0, 500), updated_at: Time.current)
          return render_unreachable(e)
        rescue Connectors::FluentCommunity::PublishError => e
          post.update_columns(last_error: e.message.to_s.slice(0, 500), updated_at: Time.current)
          return render_failed(e)
        end

        post.mark_shared_to_community!(result, message: message)
        record_audit!(post, result)

        render json: { ok: true, community: result }, status: :created
      end

      private

      def integration
        @integration ||= current_workspace.integrations
                                          .find_by(integration_type: "fluent_community", status: "connected")
      end

      def community
        @community ||= begin
          raise NotConnected, NOT_CONNECTED_MSG if integration.blank?

          PlanFeatures.require!(current_workspace, :connector_fluent_community)
          Connectors::FluentCommunity.new(integration.config)
        end
      end

      def find_post!
        current_workspace.blog_posts.find(params.require(:id))
      end

      def publish_params
        params.require(:community).permit(:message, :space, :title, topic_ids: [])
      end

      def record_ai_job!(kind, ai_result)
        AiJob.create!(
          workspace_id:    current_workspace.id,
          task_kind:       kind,
          status:          "done",
          model:           ai_result.model.to_s,
          prompt_tokens:   ai_result.input_tokens,
          output_tokens:   ai_result.output_tokens,
          cost_usd_actual: ai_result.cost_usd,
          payload:         {},
          finished_at:     Time.current
        )
      rescue StandardError => e
        Rails.logger.error("[Community] ai_job (#{kind}) falhou: #{e.class}: #{e.message}")
      end

      # O post já existe no feed: falhar aqui faria o usuário reenviar e
      # duplicar. Loga e segue.
      def record_audit!(post, result)
        AuditLog.create!(
          workspace_id: current_workspace.id,
          user_id:      current_app_user.id,
          action:       "community.post_published",
          metadata:     { blog_post_id: post.id, community_post_id: result[:id],
                          url: result[:url], space: result[:space] },
          ip:           request.remote_ip,
          user_agent:   request.user_agent.to_s.first(512)
        )
      rescue StandardError => e
        Rails.logger.error("[Community] audit_log falhou: #{e.class}: #{e.message}")
      end

      def render_not_connected(e)
        render json: { error: "community_not_connected", message: e.message }, status: :unprocessable_entity
      end

      def render_unreachable(e)
        Rails.logger.warn("[Community] conexão falhou: #{e.message}")
        render json: { error: "community_unreachable", message: e.message }, status: :unprocessable_entity
      end

      def render_failed(e)
        Rails.logger.error("[Community] publicação falhou: #{e.message}")
        render json: { error: "community_publish_failed", message: e.message }, status: :unprocessable_entity
      end
    end
  end
end
