require "rails_helper"

# Conectar o WordPress passa a importar o blog. Este spec cobre o gancho:
# quem dispara, com que argumentos, e que o conector errado não cai no job errado.
RSpec.describe "API v1 integrações — sync do blog", type: :request do
  let(:user)      { create(:app_user) }
  let(:workspace) { create(:workspace, owner: user, plan: "ultra") }
  let(:json)      { { "CONTENT_TYPE" => "application/json", "ACCEPT" => "application/json" } }
  let(:base)      { "/api/v1/workspaces/#{workspace.slug}/integrations" }

  def auth_as(u)
    allow_any_instance_of(AuthBridge).to receive(:current_app_user).and_return(u)
    allow_any_instance_of(AuthBridge).to receive(:current_session)
      .and_return({ "user_id" => u.id }.with_indifferent_access)
  end

  def body = JSON.parse(response.body)

  let(:credentials) do
    { base_url: "https://blog.test", username: "editor", application_password: "abcd efgh ijkl" }
  end

  def stub_wordpress_ok
    fake = instance_double(Connectors::Wordpress)
    allow(fake).to receive(:test_connection).and_return({ ok: true, total: 3, site: "https://blog.test" })
    allow(Connectors::Wordpress).to receive(:new).and_return(fake)
    fake
  end

  before { auth_as(user) }

  describe "POST /integrations/wordpress" do
    it "conecta e já enfileira a importação do blog" do
      stub_wordpress_ok

      expect {
        post "#{base}/wordpress", params: { wordpress: credentials }.to_json, headers: json
      }.to have_enqueued_job(Connectors::SyncBlogPostsJob)

      expect(response).to have_http_status(:created)
      expect(body).to include("ok" => true, "status" => "connected", "sync" => "queued")
    end

    it "passa workspace, usuário e integração para o job" do
      stub_wordpress_ok
      post "#{base}/wordpress", params: { wordpress: credentials }.to_json, headers: json

      integration = workspace.integrations.find_by!(integration_type: "wordpress")
      expect(Connectors::SyncBlogPostsJob).to have_been_enqueued.with(
        workspace_id: workspace.id, user_id: user.id, integration_id: integration.id
      )
    end

    it "não enfileira nada quando a credencial é recusada" do
      fake = instance_double(Connectors::Wordpress)
      allow(fake).to receive(:test_connection).and_raise(Connectors::Wordpress::ConnectionError, "401")
      allow(Connectors::Wordpress).to receive(:new).and_return(fake)

      expect {
        post "#{base}/wordpress", params: { wordpress: credentials }.to_json, headers: json
      }.not_to have_enqueued_job(Connectors::SyncBlogPostsJob)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(workspace.integrations.where(integration_type: "wordpress")).to be_empty
    end

    it "402 quando o plano não libera o conector" do
      entry = create(:workspace, owner: user, plan: "entry")
      allow(PlanFeatures).to receive(:allow?).and_call_original
      allow(PlanFeatures).to receive(:allow?).with(anything, :connector_wordpress).and_return(false)

      post "/api/v1/workspaces/#{entry.slug}/integrations/wordpress",
           params: { wordpress: credentials }.to_json, headers: json

      expect(response).to have_http_status(:payment_required)
      expect(body["error"]).to eq("feature_locked")
    end
  end

  describe "POST /integrations/:type/sync" do
    it "wordpress → job de posts, não de produtos" do
      i = workspace.integrations.new(integration_type: "wordpress", status: "connected")
      i.config = credentials.transform_keys(&:to_s)
      i.save!

      expect { post "#{base}/wordpress/sync", headers: json }
        .to have_enqueued_job(Connectors::SyncBlogPostsJob)
      expect(Connectors::SyncProductsJob).not_to have_been_enqueued

      expect(body["sync"]).to eq("queued")
    end

    it "woocommerce → job de produtos, não de posts" do
      i = workspace.integrations.new(integration_type: "woocommerce", status: "connected")
      i.config = { "base_url" => "https://loja.test", "consumer_key" => "ck", "consumer_secret" => "cs" }
      i.save!

      expect { post "#{base}/woocommerce/sync", headers: json }
        .to have_enqueued_job(Connectors::SyncProductsJob)
      expect(Connectors::SyncBlogPostsJob).not_to have_been_enqueued
    end

    it "422 not_syncable em conector que não sincroniza nada" do
      post "#{base}/openai/sync", headers: json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(body["error"]).to eq("not_syncable")
    end
  end
end
