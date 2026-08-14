require "rails_helper"

# Endpoints do acervo de blog ("Meus posts") + o gancho de sync.
# Nenhuma chamada real ao WordPress: o conector é dublado onde aparece.
RSpec.describe "API v1 blog posts", type: :request do
  let(:user)      { create(:app_user) }
  let(:workspace) { create(:workspace, owner: user, plan: "ultra") }
  let(:json)      { { "CONTENT_TYPE" => "application/json", "ACCEPT" => "application/json" } }
  let(:base)      { "/api/v1/workspaces/#{workspace.slug}/blog" }

  def auth_as(u)
    allow_any_instance_of(AuthBridge).to receive(:current_app_user).and_return(u)
    allow_any_instance_of(AuthBridge).to receive(:current_session)
      .and_return({ "user_id" => u.id }.with_indifferent_access)
  end

  def body = JSON.parse(response.body)

  def connect_wordpress!(ws = workspace)
    i = ws.integrations.new(integration_type: "wordpress", status: "connected")
    i.config = { "base_url" => "https://blog.test", "username" => "editor", "application_password" => "senha app" }
    i.save!
    i
  end

  def stub_publish(result)
    fake = instance_double(Connectors::Wordpress)
    allow(fake).to receive(:publish).and_return(result)
    allow(Connectors::Wordpress).to receive(:new).and_return(fake)
    fake
  end

  before { auth_as(user) }

  # ------------------------------------------------------------------
  describe "GET /blog/posts" do
    before do
      workspace.blog_posts.create!(title: "Rascunho local", origin: "univercopy", status: "draft")
      workspace.blog_posts.create!(title: "Publicado nosso", origin: "univercopy", status: "published", wp_post_id: 1)
      workspace.blog_posts.create!(title: "Veio do blog", origin: "wordpress", status: "published", wp_post_id: 2)
    end

    it "lista tudo com contadores por origem e status" do
      get "#{base}/posts", headers: json

      expect(response).to have_http_status(:ok)
      expect(body["posts"].size).to eq(3)
      expect(body["counts"]).to eq(
        "total" => 3, "drafts" => 1, "univercopy" => 2, "wordpress" => 1
      )
    end

    it "não devolve o corpo dos posts na listagem" do
      get "#{base}/posts", headers: json
      expect(body["posts"].first).not_to have_key("content")
    end

    it "marca como editável só o rascunho nascido aqui" do
      get "#{base}/posts", headers: json

      editaveis = body["posts"].select { |p| p["editable"] }.map { |p| p["title"] }
      expect(editaveis).to eq(["Rascunho local"])
    end

    it "filtra por origem" do
      get "#{base}/posts?origin=wordpress", headers: json
      expect(body["posts"].map { |p| p["title"] }).to eq(["Veio do blog"])
    end

    it "filtra por status" do
      get "#{base}/posts?status=draft", headers: json
      expect(body["posts"].map { |p| p["title"] }).to eq(["Rascunho local"])
    end

    it "ignora filtro fora da lista branca em vez de estourar" do
      get "#{base}/posts?origin=medium&status=qualquer", headers: json
      expect(response).to have_http_status(:ok)
      expect(body["posts"].size).to eq(3)
    end

    it "busca por título" do
      get "#{base}/posts?q=veio", headers: json
      expect(body["posts"].map { |p| p["title"] }).to eq(["Veio do blog"])
    end

    it "escapa curinga do ILIKE — '%' busca o caractere, não tudo" do
      workspace.blog_posts.create!(title: "Desconto de 50% hoje", origin: "univercopy", status: "draft")

      get "#{base}/posts?q=50%25", headers: json
      expect(body["posts"].map { |p| p["title"] }).to eq(["Desconto de 50% hoje"])
    end

    it "não enxerga o acervo de outro workspace" do
      other = create(:workspace, owner: create(:app_user))
      other.blog_posts.create!(title: "Segredo do vizinho", origin: "wordpress", status: "published", wp_post_id: 77)

      get "#{base}/posts", headers: json
      expect(body["posts"].map { |p| p["title"] }).not_to include("Segredo do vizinho")
    end
  end

  # ------------------------------------------------------------------
  describe "GET /blog/posts/:id" do
    it "devolve o detalhe com corpo e taxonomias" do
      post = workspace.blog_posts.create!(
        title: "Com corpo", content: "<p>texto</p>", origin: "univercopy",
        status: "draft", category_ids: [3], tag_ids: [9], brief: "tema"
      )

      get "#{base}/posts/#{post.id}", headers: json

      expect(response).to have_http_status(:ok)
      expect(body["post"]).to include(
        "content" => "<p>texto</p>", "brief" => "tema",
        "category_ids" => [3], "tag_ids" => [9]
      )
    end

    it "404 em post de outro workspace" do
      other = create(:workspace, owner: create(:app_user))
      alheio = other.blog_posts.create!(title: "X", origin: "wordpress", status: "published", wp_post_id: 5)

      get "#{base}/posts/#{alheio.id}", headers: json
      expect(response).to have_http_status(:not_found)
    end
  end

  # ------------------------------------------------------------------
  describe "POST /blog/posts" do
    it "salva rascunho local sem tocar no WordPress" do
      expect(Connectors::Wordpress).not_to receive(:new)

      post "#{base}/posts",
           params: { post: { title: "Novo", content: "<p>oi</p>", brief: "tema" } }.to_json,
           headers: json

      expect(response).to have_http_status(:created)
      expect(body["post"]).to include("origin" => "univercopy", "status" => "draft", "editable" => true)
      expect(body["post"]["wp_post_id"]).to be_nil
    end

    it "registra o autor" do
      post "#{base}/posts", params: { post: { title: "Novo" } }.to_json, headers: json
      expect(BlogPost.find(body["post"]["id"]).created_by).to eq(user.id)
    end

    it "descarta id de taxonomia zerado e limita a quantidade" do
      post "#{base}/posts",
           params: { post: { title: "T", category_ids: [3, 0, 3, 7], tag_ids: (1..40).to_a } }.to_json,
           headers: json

      expect(body["post"]["category_ids"]).to eq([3, 7])
      expect(body["post"]["tag_ids"].size).to eq(20)
    end

    it "422 sem título" do
      post "#{base}/posts", params: { post: { content: "só corpo" } }.to_json, headers: json
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  # ------------------------------------------------------------------
  describe "PATCH /blog/posts/:id" do
    it "atualiza rascunho local" do
      record = workspace.blog_posts.create!(title: "Antes", origin: "univercopy", status: "draft")

      patch "#{base}/posts/#{record.id}",
            params: { post: { title: "Depois", content: "<p>novo</p>" } }.to_json, headers: json

      expect(response).to have_http_status(:ok)
      expect(record.reload.title).to eq("Depois")
    end

    it "422 not_editable em post que já está no WordPress" do
      record = workspace.blog_posts.create!(
        title: "Publicado", origin: "univercopy", status: "published", wp_post_id: 12
      )

      patch "#{base}/posts/#{record.id}", params: { post: { title: "Tentativa" } }.to_json, headers: json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(body["error"]).to eq("not_editable")
      expect(record.reload.title).to eq("Publicado")
    end

    it "422 not_editable em post trazido pelo sync" do
      record = workspace.blog_posts.create!(
        title: "Do blog", origin: "wordpress", status: "published", wp_post_id: 13
      )

      patch "#{base}/posts/#{record.id}", params: { post: { title: "X" } }.to_json, headers: json
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  # ------------------------------------------------------------------
  describe "DELETE /blog/posts/:id" do
    it "remove só a cópia local" do
      record = workspace.blog_posts.create!(title: "Some", origin: "univercopy", status: "draft")

      expect {
        delete "#{base}/posts/#{record.id}", headers: json
      }.to change { workspace.blog_posts.count }.by(-1)

      expect(response).to have_http_status(:ok)
    end

    it "404 em post de outro workspace" do
      other  = create(:workspace, owner: create(:app_user))
      alheio = other.blog_posts.create!(title: "X", origin: "wordpress", status: "published", wp_post_id: 8)

      delete "#{base}/posts/#{alheio.id}", headers: json
      expect(response).to have_http_status(:not_found)
      expect(BlogPost.exists?(alheio.id)).to be(true)
    end
  end

  # ------------------------------------------------------------------
  describe "POST /blog/posts/:id/publish" do
    let!(:integration) { connect_wordpress! }
    let!(:record) do
      workspace.blog_posts.create!(
        title: "Pronto pra ir", content: "<p>corpo</p>", origin: "univercopy",
        status: "draft", category_ids: [3], tag_ids: [9]
      )
    end

    it "publica no WordPress e marca o registro local como publicado" do
      fake = stub_publish({ id: 4242, url: "https://blog.test/pronto", status: "publish" })

      post "#{base}/posts/#{record.id}/publish", params: { status: "publish" }.to_json, headers: json

      expect(response).to have_http_status(:created)
      expect(fake).to have_received(:publish).with(
        hash_including(title: "Pronto pra ir", status: "publish", category_ids: [3], tag_ids: [9])
      )
      expect(record.reload).to have_attributes(
        status: "published", wp_post_id: 4242, wp_status: "publish", url: "https://blog.test/pronto"
      )
    end

    it "envia como rascunho do WordPress quando pedido" do
      fake = stub_publish({ id: 7, url: nil, status: "draft" })

      post "#{base}/posts/#{record.id}/publish", params: { status: "draft" }.to_json, headers: json

      expect(fake).to have_received(:publish).with(hash_including(status: "draft"))
      expect(record.reload.wp_status).to eq("draft")
    end

    it "cai para draft — nunca publish — quando o status vem inválido" do
      fake = stub_publish({ id: 7, url: nil, status: "draft" })

      post "#{base}/posts/#{record.id}/publish", params: { status: "publish_now" }.to_json, headers: json

      expect(fake).to have_received(:publish).with(hash_including(status: "draft"))
    end

    it "grava o motivo no rascunho quando o WordPress recusa, e o mantém publicável" do
      fake = instance_double(Connectors::Wordpress)
      allow(fake).to receive(:publish).and_raise(Connectors::Wordpress::PublishError, "título obrigatório")
      allow(Connectors::Wordpress).to receive(:new).and_return(fake)

      post "#{base}/posts/#{record.id}/publish", params: { status: "publish" }.to_json, headers: json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(body["error"]).to eq("blog_publish_failed")

      record.reload
      expect(record.last_error).to include("título obrigatório")
      expect(record.status).to eq("draft")   # segue como rascunho, dá pra tentar de novo
      expect(record).to be_editable
    end

    it "registra auditoria da publicação" do
      stub_publish({ id: 99, url: "https://blog.test/x", status: "publish" })

      expect {
        post "#{base}/posts/#{record.id}/publish", params: { status: "publish" }.to_json, headers: json
      }.to change { workspace.audit_logs.where(action: "blog.post_publish").count }.by(1)
    end

    it "422 not_editable ao tentar republicar o que já foi" do
      record.update!(status: "published", wp_post_id: 1)

      post "#{base}/posts/#{record.id}/publish", params: { status: "publish" }.to_json, headers: json
      expect(body["error"]).to eq("not_editable")
    end
  end

  describe "POST /blog/posts/:id/publish sem WordPress conectado" do
    it "422 blog_not_connected" do
      record = workspace.blog_posts.create!(title: "T", content: "c", origin: "univercopy", status: "draft")

      post "#{base}/posts/#{record.id}/publish", params: { status: "publish" }.to_json, headers: json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(body["error"]).to eq("blog_not_connected")
    end
  end

  # ------------------------------------------------------------------
  describe "POST /blog/publish (editor) — espelho no acervo" do
    let!(:integration) { connect_wordpress! }

    it "arquiva em Meus posts o que subiu pelo editor" do
      stub_publish({ id: 55, url: "https://blog.test/do-editor", status: "publish" })

      expect {
        post "#{base}/publish",
             params: { post: { title: "Do editor", content: "<p>c</p>", status: "publish" } }.to_json,
             headers: json
      }.to change { workspace.blog_posts.count }.by(1)

      arquivado = workspace.blog_posts.order(:created_at).last
      expect(arquivado).to have_attributes(
        origin: "univercopy", status: "published", wp_post_id: 55, wp_status: "publish"
      )
      expect(body["archived"]).to be_present
    end

    it "responde 201 mesmo se arquivar falhar — o post já existe no WordPress" do
      stub_publish({ id: 56, url: nil, status: "draft" })
      allow_any_instance_of(BlogPost).to receive(:save!).and_raise(ActiveRecord::StatementInvalid, "disco cheio")

      post "#{base}/publish",
           params: { post: { title: "T", content: "c", status: "draft" } }.to_json, headers: json

      expect(response).to have_http_status(:created)
      expect(body["archived"]).to be_nil
    end
  end

  # ------------------------------------------------------------------
  describe "POST /blog/sync" do
    it "enfileira o job de sincronização" do
      integration = connect_wordpress!

      expect {
        post "#{base}/sync", headers: json
      }.to have_enqueued_job(Connectors::SyncBlogPostsJob)
        .with(workspace_id: workspace.id, user_id: user.id, integration_id: integration.id)

      expect(response).to have_http_status(:accepted)
      expect(body["sync"]).to eq("queued")
    end

    it "422 blog_not_connected sem integração" do
      post "#{base}/sync", headers: json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(body["error"]).to eq("blog_not_connected")
    end
  end

  # ------------------------------------------------------------------
  describe "autenticação" do
    it "401 sem sessão" do
      allow_any_instance_of(AuthBridge).to receive(:current_app_user).and_return(nil)
      allow_any_instance_of(AuthBridge).to receive(:current_session).and_return(nil)

      get "#{base}/posts", headers: json
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
