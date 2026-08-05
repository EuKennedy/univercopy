module Api
  module V1
    # Publicação no blog WordPress via REST API v2 (Connectors::Wordpress).
    #
    # As credenciais são por workspace: ficam na tabela `integrations` cifradas
    # com a TENANT_CREDENTIALS_KEY e são cadastradas em Configurações →
    # Integrações. Não existe variável de ambiente global aqui — cada workspace
    # aponta para o seu próprio WordPress.
    #
    # rescue_from é avaliado na ordem REVERSA da declaração — como a
    # BaseController declara o catch-all StandardError primeiro, estes são
    # checados antes.
    class BlogPostsController < WorkspaceScopedController
      # Erro próprio (e não ConnectionError) pra tela distinguir "nunca
      # conectou" de "conectou mas o site não respondeu" e conseguir linkar
      # direto pra Integrações.
      class NotConnected < StandardError; end

      NOT_CONNECTED_MSG = "Nenhum WordPress conectado neste workspace. " \
                          "Conecte em Configurações → Integrações.".freeze

      rescue_from Connectors::Wordpress::ConnectionError, with: :render_blog_unreachable
      rescue_from Connectors::Wordpress::PublishError,    with: :render_blog_failed
      rescue_from NotConnected,                           with: :render_blog_not_connected

      # GET /workspaces/:slug/blog/status — a tela usa pra decidir entre mostrar
      # o formulário ou mandar o usuário conectar em Integrações.
      def status
        return render json: { connected: false, reachable: false } if integration.blank?

        # Conectado-mas-fora-do-ar é estado diferente de não-conectado: a tela
        # mostra mensagens distintas. Por isso não deixamos virar 502 genérico.
        begin
          result = connector.test_connection
          render json: { connected: true, reachable: true, site: result[:site] }
        rescue Connectors::Wordpress::ConnectionError => e
          Rails.logger.warn("[BlogPosts] WordPress indisponível: #{e.message}")
          render json: { connected: true, reachable: false, site: integration.config["base_url"], message: e.message }
        end
      end

      # GET /workspaces/:slug/blog/categories
      def categories
        render json: { categories: connector.categories }
      end

      # POST /workspaces/:slug/blog/publish
      # status: "draft" (salvar rascunho) ou "publish" (publicar agora).
      def publish
        p = publish_params

        result = connector.publish(
          title:        p[:title],
          content:      p[:content],
          status:       p[:status].presence || "draft",
          excerpt:      p[:excerpt],
          category_ids: Array(p[:category_ids])
        )

        record_audit!(result)

        render json: { ok: true, post: result }, status: :created
      end

      private

      def integration
        @integration ||= current_workspace.integrations.find_by(integration_type: "wordpress", status: "connected")
      end

      def connector
        @connector ||= begin
          raise NotConnected, NOT_CONNECTED_MSG if integration.blank?

          PlanFeatures.require!(current_workspace, :connector_wordpress)
          Connectors::Wordpress.new(integration.config)
        end
      end

      def publish_params
        params.require(:post).permit(:title, :content, :excerpt, :status, category_ids: [])
      end

      # Rastro de quem mandou o quê pro blog. Guarda só metadados — o corpo do
      # post não entra no log.
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
        # O post já existe no WordPress. Falhar o request aqui faria o usuário
        # reenviar e duplicar o post — loga e segue.
        Rails.logger.error("[BlogPosts] audit_log falhou: #{e.class}: #{e.message}")
      end

      def render_blog_not_connected(e)
        render json: { error: "blog_not_connected", message: e.message }, status: :unprocessable_entity
      end

      def render_blog_unreachable(e)
        Rails.logger.warn("[BlogPosts] conexão falhou: #{e.message}")
        render json: { error: "blog_unreachable", message: e.message }, status: :unprocessable_entity
      end

      def render_blog_failed(e)
        Rails.logger.error("[BlogPosts] publicação falhou: #{e.message}")
        render json: { error: "blog_publish_failed", message: e.message }, status: :unprocessable_entity
      end
    end
  end
end
