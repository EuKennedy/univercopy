require "rails_helper"

RSpec.describe "API v1 community", type: :request do
  let(:user)      { create(:app_user) }
  let(:workspace) { create(:workspace, owner: user, plan: "ultra") }
  let(:json)      { { "CONTENT_TYPE" => "application/json", "ACCEPT" => "application/json" } }
  let(:base)      { "/api/v1/workspaces/#{workspace.slug}/community" }

  def auth_as(u)
    allow_any_instance_of(AuthBridge).to receive(:current_app_user).and_return(u)
    allow_any_instance_of(AuthBridge).to receive(:current_session)
      .and_return({ "user_id" => u.id }.with_indifferent_access)
  end

  def body = JSON.parse(response.body)

  def connect_community!
    i = workspace.integrations.new(integration_type: "fluent_community", status: "connected")
    i.config = {
      "base_url" => "https://comunidade.test", "username" => "editor",
      "application_password" => "senha app", "default_space" => "start-here"
    }
    i.save!
    i
  end

  def stub_connector(**stubs)
    fake = instance_double(Connectors::FluentCommunity)
    allow(fake).to receive(:default_space).and_return("start-here")
    stubs.each { |m, v| v.is_a?(StandardError) ? allow(fake).to receive(m).and_raise(v) : allow(fake).to receive(m).and_return(v) }
    allow(Connectors::FluentCommunity).to receive(:new).and_return(fake)
    fake
  end

  # Post já publicado no blog — pré-requisito pra anunciar na comunidade.
  def published_post(**attrs)
    workspace.blog_posts.create!({
      title:      "Rotina de skincare",
      content:    "<p>Texto do artigo</p>",
      origin:     "univercopy",
      status:     "published",
      wp_post_id: 10,
      url:        "https://blog.test/rotina",
    }.merge(attrs))
  end

  before { auth_as(user) }

  # ------------------------------------------------------------------
  describe "GET /community/status" do
    it "connected=false sem integração" do
      get "#{base}/status", headers: json
      expect(body).to include("connected" => false, "reachable" => false)
    end

    it "connected + reachable quando a comunidade responde" do
      connect_community!
      stub_connector(test_connection: { ok: true, site: "https://comunidade.test", spaces: 4 })

      get "#{base}/status", headers: json

      expect(body).to include("connected" => true, "reachable" => true, "spaces_count" => 4)
      expect(body["default_space"]).to eq("start-here")
    end

    it "connected mas reachable=false quando a credencial perde acesso ao portal" do
      connect_community!
      stub_connector(test_connection: Connectors::FluentCommunity::ConnectionError.new("sem acesso (403)"))

      get "#{base}/status", headers: json

      expect(response).to have_http_status(:ok) # status é diagnóstico, não erro
      expect(body).to include("connected" => true, "reachable" => false)
      expect(body["message"]).to include("sem acesso")
    end
  end

  # ------------------------------------------------------------------
  describe "GET /community/spaces" do
    it "lista os spaces publicáveis" do
      connect_community!
      stub_connector(spaces: [{ id: 2, title: "Comece Aqui", slug: "start-here", type: "community", privacy: "public" }])

      get "#{base}/spaces", headers: json

      expect(response).to have_http_status(:ok)
      expect(body["spaces"].map { |s| s["slug"] }).to eq(["start-here"])
      expect(body["default_space"]).to eq("start-here")
    end

    it "422 sem comunidade conectada" do
      get "#{base}/spaces", headers: json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(body["error"]).to eq("community_not_connected")
    end
  end

  # ------------------------------------------------------------------
  describe "POST /community/posts/:id/message" do
    let!(:post_record) { published_post }

    it "gera o texto sem publicar nada" do
      expect(Connectors::FluentCommunity).not_to receive(:new)

      ai = Struct.new(:model, :input_tokens, :output_tokens, :cost_usd, keyword_init: true)
                 .new(model: "sonnet", input_tokens: 100, output_tokens: 50, cost_usd: 0.02)
      allow(Ai::CommunityWriter).to receive(:call)
        .and_return(Ai::CommunityWriter::Result.new(text: "Chamada curta com link", ai_result: ai))

      post "#{base}/posts/#{post_record.id}/message", headers: json

      expect(response).to have_http_status(:ok)
      expect(body["message"]).to eq("Chamada curta com link")
      expect(post_record.reload.community_post_id).to be_nil
    end

    it "registra o custo num AiJob" do
      ai = Struct.new(:model, :input_tokens, :output_tokens, :cost_usd, keyword_init: true)
                 .new(model: "sonnet", input_tokens: 100, output_tokens: 50, cost_usd: 0.02)
      allow(Ai::CommunityWriter).to receive(:call)
        .and_return(Ai::CommunityWriter::Result.new(text: "T", ai_result: ai))

      expect {
        post "#{base}/posts/#{post_record.id}/message", headers: json
      }.to change { workspace.ai_jobs.where(task_kind: "community_message").count }.by(1)
    end

    it "404 em post de outro workspace" do
      other  = create(:workspace, owner: create(:app_user))
      alheio = other.blog_posts.create!(title: "X", origin: "wordpress", status: "published", wp_post_id: 3)

      post "#{base}/posts/#{alheio.id}/message", headers: json
      expect(response).to have_http_status(:not_found)
    end
  end

  # ------------------------------------------------------------------
  describe "POST /community/posts/:id/publish" do
    let!(:integration)  { connect_community! }
    let!(:post_record)  { published_post }
    let(:feed_result)   { { id: 900, url: "https://comunidade.test/feed/900", slug: "f900", space: "start-here" } }

    def do_publish(message: "Olha o artigo novo", space: "start-here")
      post "#{base}/posts/#{post_record.id}/publish",
           params: { community: { message: message, space: space } }.to_json, headers: json
    end

    it "publica e guarda o rastro no post do blog" do
      fake = stub_connector(publish: feed_result)

      do_publish

      expect(response).to have_http_status(:created)
      expect(fake).to have_received(:publish).with(
        hash_including(message: "Olha o artigo novo", space: "start-here", title: "Rotina de skincare")
      )
      expect(post_record.reload).to have_attributes(
        community_post_id: 900,
        community_url:     "https://comunidade.test/feed/900",
        community_space:   "start-here",
        community_message: "Olha o artigo novo"
      )
      expect(post_record.community_published_at).to be_present
    end

    it "registra auditoria" do
      stub_connector(publish: feed_result)

      expect { do_publish }
        .to change { workspace.audit_logs.where(action: "community.post_published").count }.by(1)
    end

    it "recusa o segundo anúncio do mesmo post — feed duplicado" do
      stub_connector(publish: feed_result)
      do_publish

      do_publish
      expect(response).to have_http_status(:unprocessable_entity)
      expect(body["error"]).to eq("already_shared")
      expect(body["url"]).to eq("https://comunidade.test/feed/900")
    end

    it "recusa rascunho que ainda não foi pro blog — o post da comunidade leva o link do artigo" do
      rascunho = workspace.blog_posts.create!(title: "Só rascunho", origin: "univercopy", status: "draft")

      post "#{base}/posts/#{rascunho.id}/publish",
           params: { community: { message: "oi", space: "start-here" } }.to_json, headers: json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(body["error"]).to eq("not_shareable")
    end

    it "recusa mensagem vazia antes de chamar a comunidade" do
      expect(Connectors::FluentCommunity).not_to receive(:new)

      do_publish(message: "   ")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(body["error"]).to eq("empty_message")
    end

    it "usa o título do post quando a chamada não manda um" do
      fake = stub_connector(publish: feed_result)

      do_publish

      expect(fake).to have_received(:publish).with(hash_including(title: "Rotina de skincare"))
    end

    it "grava o motivo no post quando a comunidade recusa, e mantém publicável" do
      stub_connector(publish: Connectors::FluentCommunity::PublishError.new("selecione ao menos um tópico"))

      do_publish

      expect(response).to have_http_status(:unprocessable_entity)
      expect(body["error"]).to eq("community_publish_failed")

      post_record.reload
      expect(post_record.last_error).to include("selecione ao menos um tópico")
      expect(post_record.community_post_id).to be_nil
      expect(post_record).to be_shareable_to_community  # dá pra tentar de novo
    end

    it "grava o motivo quando a conexão falha" do
      stub_connector(publish: Connectors::FluentCommunity::ConnectionError.new("timeout"))

      do_publish

      expect(body["error"]).to eq("community_unreachable")
      expect(post_record.reload.last_error).to include("timeout")
    end

    it "422 sem comunidade conectada" do
      integration.destroy!

      do_publish
      expect(body["error"]).to eq("community_not_connected")
    end
  end

  # ------------------------------------------------------------------
  describe "gating de plano" do
    it "402 quando o plano não libera o conector" do
      connect_community!
      allow(PlanFeatures).to receive(:allow?).and_call_original
      allow(PlanFeatures).to receive(:allow?).with(anything, :connector_fluent_community).and_return(false)

      get "#{base}/spaces", headers: json

      expect(response).to have_http_status(:payment_required)
      expect(body["error"]).to eq("feature_locked")
    end
  end

  describe "autenticação" do
    it "401 sem sessão" do
      allow_any_instance_of(AuthBridge).to receive(:current_app_user).and_return(nil)
      allow_any_instance_of(AuthBridge).to receive(:current_session).and_return(nil)

      get "#{base}/status", headers: json
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
