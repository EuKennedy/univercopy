module Api
  module V1
    # Publicação no blog WordPress via SSH + WP-CLI (Connectors::WordpressSsh).
    #
    # Escopo atual: instância única configurada por ENV (blog da Lizzon). Quando
    # virar multi-tenant, a config sai do ENV e passa pra `integrations` com a
    # TENANT_CREDENTIALS_KEY, e este controller passa a resolver o conector pelo
    # workspace em vez de `from_env`.
    #
    # rescue_from é avaliado na ordem REVERSA da declaração — como a BaseController
    # declara o catch-all StandardError primeiro, estes aqui são checados antes.
    class BlogPostsController < WorkspaceScopedController
      rescue_from Connectors::WordpressSsh::ConfigError,     with: :render_blog_unconfigured
      rescue_from Connectors::WordpressSsh::ConnectionError, with: :render_blog_unreachable
      rescue_from Connectors::WordpressSsh::PublishError,    with: :render_blog_failed

      # GET /workspaces/:slug/blog/status — o admin usa pra decidir se mostra o
      # formulário ou o aviso de "não configurado".
      def status
        unless Connectors::WordpressSsh.configured?
          return render json: { configured: false, reachable: false }
        end

        # Configurado mas fora do ar é um estado diferente de não-configurado —
        # o admin mostra mensagens distintas. Por isso não deixamos o rescue_from
        # transformar isso num 502 genérico.
        begin
          result = connector.test_connection
          render json: { configured: true, reachable: true, wp_version: result[:wp_version], host: result[:host] }
        rescue Connectors::WordpressSsh::ConnectionError, Connectors::WordpressSsh::PublishError => e
          Rails.logger.warn("[BlogPosts] status indisponível: #{e.message}")
          render json: { configured: true, reachable: false, message: e.message }
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

      def connector
        @connector ||= Connectors::WordpressSsh.from_env
      end

      def publish_params
        params.require(:post).permit(:title, :content, :excerpt, :status, category_ids: [])
      end

      # Rastro de quem mandou o quê pro blog externo. Guarda só metadados —
      # o corpo do post não entra no log.
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
        # O post já foi criado no WordPress. Falhar o request aqui faria o
        # usuário reenviar e duplicar o post — loga e segue.
        Rails.logger.error("[BlogPosts] audit_log falhou: #{e.class}: #{e.message}")
      end

      def render_blog_unconfigured(e)
        render json: {
          error:   "blog_unconfigured",
          message: "Integração com o blog não configurada nesta instância — #{e.message}",
        }, status: :unprocessable_entity
      end

      def render_blog_unreachable(e)
        Rails.logger.error("[BlogPosts] host inacessível: #{e.message}")
        render json: {
          error:   "blog_unreachable",
          message: "Não consegui falar com o servidor do blog: #{e.message}",
        }, status: :bad_gateway
      end

      def render_blog_failed(e)
        Rails.logger.error("[BlogPosts] wp-cli falhou: #{e.message}")
        render json: {
          error:   "blog_publish_failed",
          message: e.message,
        }, status: :unprocessable_entity
      end
    end
  end
end
