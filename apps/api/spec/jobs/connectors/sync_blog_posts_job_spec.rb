require "rails_helper"

RSpec.describe Connectors::SyncBlogPostsJob, type: :job do
  let(:user)      { create(:app_user) }
  let(:workspace) { create(:workspace, owner: user, plan: "ultra") }

  let(:integration) do
    ApplicationRecord.with_workspace_rls(workspace.id, user_id: user.id) do
      i = workspace.integrations.new(integration_type: "wordpress", status: "connected")
      i.config = { "base_url" => "https://blog.test", "username" => "editor", "application_password" => "senha app" }
      i.save!
      i
    end
  end

  def wp_attrs(id:, **overrides)
    {
      wp_post_id:        id,
      title:             "Post #{id}",
      content:           "<p>Corpo #{id}</p>",
      excerpt:           "Resumo #{id}",
      slug:              "post-#{id}",
      wp_status:         "publish",
      url:               "https://blog.test/post-#{id}",
      category_ids:      [3],
      tag_ids:           [9],
      featured_media_id: nil,
      published_at:      Time.utc(2026, 8, 1),
      wp_modified_at:    Time.utc(2026, 8, 2),
    }.merge(overrides)
  end

  # Substitui o conector inteiro: a leitura HTTP já é coberta pelo spec do
  # Connectors::Wordpress. Aqui o que importa é o que o job faz com o resultado.
  def stub_connector(posts)
    fake = instance_double(Connectors::Wordpress)
    allow(fake).to receive(:each_post) { |&blk| posts.each(&blk) }
    allow(Connectors::Wordpress).to receive(:new).and_return(fake)
    fake
  end

  def perform!
    described_class.new.perform(
      workspace_id: workspace.id, user_id: user.id, integration_id: integration.id
    )
  end

  def posts
    ApplicationRecord.with_workspace_rls(workspace.id, user_id: user.id) { yield_posts }
  end

  def yield_posts
    BlogPost.where(workspace_id: workspace.id).order(:wp_post_id).to_a
  end

  describe "importação" do
    it "grava cada post do blog com origem wordpress e status published" do
      stub_connector([wp_attrs(id: 1), wp_attrs(id: 2)])

      expect { perform! }.to change {
        ApplicationRecord.with_workspace_rls(workspace.id, user_id: user.id) { BlogPost.count }
      }.by(2)

      first = posts.first
      expect(first).to have_attributes(
        origin: "wordpress", status: "published", wp_post_id: 1,
        title: "Post 1", slug: "post-1", wp_status: "publish"
      )
      expect(first.synced_at).to be_present
    end

    it "preserva rascunho e privado do WordPress em wp_status" do
      stub_connector([wp_attrs(id: 1, wp_status: "draft"), wp_attrs(id: 2, wp_status: "private")])
      perform!

      # Local é sempre "published" (já existe no WP); wp_status guarda a nuance.
      expect(posts.map(&:status)).to eq(%w[published published])
      expect(posts.map(&:wp_status)).to eq(%w[draft private])
    end

    it "atualiza integration.last_sync_at e limpa erro anterior" do
      integration.update!(status: "error", last_error: "falha antiga")
      stub_connector([wp_attrs(id: 1)])
      perform!

      integration.reload
      expect(integration.status).to eq("connected")
      expect(integration.last_error).to be_nil
      expect(integration.last_sync_at).to be_present
    end
  end

  describe "idempotência" do
    it "rodar duas vezes não duplica — faz upsert por wp_post_id" do
      stub_connector([wp_attrs(id: 1), wp_attrs(id: 2)])
      perform!
      perform!

      expect(posts.size).to eq(2)
    end

    it "traz para o acervo as alterações feitas no WordPress" do
      stub_connector([wp_attrs(id: 1, title: "Antes")])
      perform!

      stub_connector([wp_attrs(id: 1, title: "Depois", wp_status: "draft")])
      perform!

      expect(posts.first.title).to eq("Depois")
      expect(posts.first.wp_status).to eq("draft")
    end

    it "NÃO reescreve a origem de um post que nasceu aqui e depois foi publicado" do
      local = ApplicationRecord.with_workspace_rls(workspace.id, user_id: user.id) do
        workspace.blog_posts.create!(
          title: "Nosso post", origin: "univercopy", status: "published",
          wp_post_id: 1, brief: "tema original"
        )
      end

      stub_connector([wp_attrs(id: 1, title: "Nosso post editado no WP")])
      perform!

      local.reload
      expect(local.origin).to eq("univercopy")  # a origem é histórica, não muda
      expect(local.title).to eq("Nosso post editado no WP")
      expect(local.brief).to eq("tema original")
      expect(posts.size).to eq(1)
    end
  end

  describe "isolamento entre workspaces" do
    it "não toca no acervo de outro workspace com o mesmo wp_post_id" do
      other_user = create(:app_user)
      other_ws   = create(:workspace, owner: other_user)
      other_post = ApplicationRecord.with_workspace_rls(other_ws.id, user_id: other_user.id) do
        other_ws.blog_posts.create!(title: "Do vizinho", origin: "wordpress", status: "published", wp_post_id: 1)
      end

      stub_connector([wp_attrs(id: 1, title: "Do nosso blog")])
      perform!

      expect(other_post.reload.title).to eq("Do vizinho")
    end
  end

  describe "falhas" do
    it "marca a integração com erro e propaga para o retry do ActiveJob" do
      fake = instance_double(Connectors::Wordpress)
      allow(fake).to receive(:each_post).and_raise(Connectors::Wordpress::ConnectionError, "timeout no WordPress")
      allow(Connectors::Wordpress).to receive(:new).and_return(fake)

      expect { perform! }.to raise_error(Connectors::Wordpress::ConnectionError)

      integration.reload
      expect(integration.status).to eq("error")
      expect(integration.last_error).to include("timeout no WordPress")
    end

    it "recusa integração que não é wordpress em vez de sincronizar lixo" do
      woo = ApplicationRecord.with_workspace_rls(workspace.id, user_id: user.id) do
        i = workspace.integrations.new(integration_type: "woocommerce", status: "connected")
        i.config = { "base_url" => "https://loja.test" }
        i.save!
        i
      end

      expect {
        described_class.new.perform(workspace_id: workspace.id, user_id: user.id, integration_id: woo.id)
      }.to raise_error(ArgumentError, /wordpress/)
    end
  end
end
