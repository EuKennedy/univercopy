# Espelha o blog do WordPress conectado na tabela `blog_posts`. Roda ao
# conectar a integração e sob demanda pelo botão de re-sincronizar.
#
# Idempotente: upsert por (workspace_id, wp_post_id). Rodar duas vezes seguidas
# não duplica nem cria linha nova — atualiza a existente.
#
# RLS COM user_id, como o SyncProductsJob: sem o app.user_id a policy
# is_member() esconde as linhas já gravadas, o find_or_initialize acha que tudo
# é novo e o índice único estoura no segundo sync.

module Connectors
  class SyncBlogPostsJob < ApplicationJob
    queue_as :default

    def perform(workspace_id:, user_id:, integration_id:)
      with_workspace_rls(workspace_id, user_id: user_id) do
        integration = Integration.find(integration_id)
        unless integration.integration_type == "wordpress"
          raise ArgumentError, "sync de blog exige integração wordpress, veio #{integration.integration_type}"
        end

        upserted = 0
        Connectors::Wordpress.new(integration.config).each_post do |attrs|
          upsert_post!(workspace_id, attrs)
          upserted += 1
        end

        integration.update!(status: "connected", last_error: nil, last_sync_at: Time.current)
        Rails.logger.info({ blog_sync: "ok", workspace_id:, integration_id:, upserted: }.to_json)
      end
    rescue StandardError => e
      with_workspace_rls(workspace_id, user_id: user_id) do
        Integration.where(id: integration_id).update_all(status: "error", last_error: e.message.slice(0, 500))
      end
      Rails.logger.error({ blog_sync: "fail", workspace_id:, integration_id:, error: e.message }.to_json)
      raise
    end

    private

    # Um post que NÓS geramos e publicamos volta no sync com wp_post_id
    # conhecido. Ele continua sendo `origin: univercopy` — a origem é histórica
    # e não muda porque o post agora também mora no WordPress. Só linha nova
    # nasce como `wordpress`.
    #
    # `status` fica "published" em qualquer post que tenha wp_post_id: ele saiu
    # daqui. Se está no ar ou não, quem responde é `wp_status`.
    def upsert_post!(workspace_id, attrs)
      post = BlogPost.find_or_initialize_by(workspace_id: workspace_id, wp_post_id: attrs[:wp_post_id])
      post.origin = "wordpress" if post.new_record?

      post.assign_attributes(attrs.except(:wp_post_id))
      post.status     = "published"
      post.synced_at  = Time.current
      post.last_error = nil
      post.save!
    rescue ActiveRecord::RecordNotUnique
      # Corrida entre dois syncs do mesmo workspace: a outra thread criou a
      # linha entre o find e o save. Atualiza a que ganhou.
      BlogPost.find_by!(workspace_id: workspace_id, wp_post_id: attrs[:wp_post_id])
              .update!(attrs.except(:wp_post_id).merge(status: "published", synced_at: Time.current))
    end
  end
end
