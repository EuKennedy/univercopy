require "rails_helper"

# Cobertura de request dos endpoints v1 (CRUD, auth, gating de plano, RLS-scope,
# serialização). AI endpoints (generate/dna improve/page audit) não entram aqui
# pois dependem de chamada externa Anthropic (coberto por E2E ao vivo).
RSpec.describe "API v1 endpoints", type: :request do
  let(:user)      { create(:app_user) }
  let(:workspace) { create(:workspace, owner: user, plan: "ultra") }
  let(:json)      { { "CONTENT_TYPE" => "application/json", "ACCEPT" => "application/json" } }

  def auth_as(u)
    allow_any_instance_of(AuthBridge).to receive(:current_app_user).and_return(u)
    allow_any_instance_of(AuthBridge).to receive(:current_session)
      .and_return({ "user_id" => u.id }.with_indifferent_access)
  end

  def body = JSON.parse(response.body)

  describe "autenticação" do
    it "401 sem sessão" do
      get "/api/v1/workspaces", headers: json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "bibliotecas globais" do
    before { auth_as(user) }

    %w[styles frameworks piece-types categories].each do |lib|
      it "GET /#{lib} → 200 com chave" do
        get "/api/v1/#{lib}", headers: json
        expect(response).to have_http_status(:ok)
        expect(body.keys).to include(lib.tr("-", "_"))
      end
    end
  end

  describe "conta /me" do
    before { auth_as(user) }

    it "GET retorna prefs e PATCH atualiza" do
      get "/api/v1/me", headers: json
      expect(body["email"]).to eq(user.email)

      patch "/api/v1/me", params: { preferred_ai_model: "opus" }.to_json, headers: json
      expect(response).to have_http_status(:ok)
      expect(body["preferred_ai_model"]).to eq("opus")
    end
  end

  describe "workspaces" do
    before { auth_as(user); workspace }

    it "index lista o workspace do usuário" do
      get "/api/v1/workspaces", headers: json
      expect(body["workspaces"].map { |w| w["slug"] }).to include(workspace.slug)
    end

    it "overview retorna counts zerados" do
      get "/api/v1/workspaces/#{workspace.slug}/overview", headers: json
      expect(response).to have_http_status(:ok)
      expect(body["counts"]).to include("copies" => 0, "products" => 0)
    end

    it "plan retorna snapshot ultra com features liberadas" do
      get "/api/v1/workspaces/#{workspace.slug}/plan", headers: json
      expect(body.dig("snapshot", "plan")).to eq("ultra")
      expect(body.dig("snapshot", "features", "ai_intelligence")).to eq(true)
    end
  end

  describe "copies CRUD" do
    before { auth_as(user) }

    it "cria → lista → versiona → muda status → exclui" do
      post "/api/v1/workspaces/#{workspace.slug}/copies",
           params: { title: "Headline", content: "Corpo da copy" }.to_json, headers: json
      expect(response).to have_http_status(:created)
      id = body["id"]
      expect(body.dig("current_version", "content")).to eq("Corpo da copy")
      expect(body["status"]).to eq("rascunho")

      get "/api/v1/workspaces/#{workspace.slug}/copies", headers: json
      expect(body["copies"].map { |c| c["id"] }).to include(id)

      patch "/api/v1/workspaces/#{workspace.slug}/copies/#{id}",
            params: { status: "aprovado" }.to_json, headers: json
      expect(body["status"]).to eq("aprovado")

      post "/api/v1/workspaces/#{workspace.slug}/copies/#{id}/versions",
           params: { content: "Versão 2", note: "ajuste" }.to_json, headers: json
      expect(response).to have_http_status(:created)

      get "/api/v1/workspaces/#{workspace.slug}/copies/#{id}/versions", headers: json
      expect(body["versions"].size).to eq(2)

      delete "/api/v1/workspaces/#{workspace.slug}/copies/#{id}", headers: json
      expect(response).to have_http_status(:ok)
    end

    it "404 em id inexistente" do
      get "/api/v1/workspaces/#{workspace.slug}/copies/#{SecureRandom.uuid}", headers: json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "gating de plano (campanhas)" do
    before { auth_as(user) }

    it "entry → 402 feature_locked" do
      entry = create(:workspace, owner: user, plan: "entry")
      post "/api/v1/workspaces/#{entry.slug}/campaigns",
           params: { campaign: { name: "Black Friday" } }.to_json, headers: json
      expect(response).to have_http_status(:payment_required)
      expect(body["error"]).to eq("feature_locked")
      expect(body["feature"]).to eq("campaigns")
    end

    it "ultra → 201 cria campanha" do
      post "/api/v1/workspaces/#{workspace.slug}/campaigns",
           params: { campaign: { name: "Black Friday" } }.to_json, headers: json
      expect(response).to have_http_status(:created)
      expect(body["name"]).to eq("Black Friday")
    end
  end

  describe "canais (channels)" do
    before { auth_as(user) }

    it "GET /channels lista canais com peças" do
      get "/api/v1/channels", headers: json
      expect(response).to have_http_status(:ok)
      keys = body["channels"].map { |c| c["key"] }
      expect(keys).to include("email", "whatsapp", "sms", "meta_ads", "google_ads")
      whatsapp = body["channels"].find { |c| c["key"] == "whatsapp" }
      expect(whatsapp).to include("name", "icon", "color", "piece_types")
    end
  end

  describe "campanha: sequências multi-canal" do
    before { auth_as(user) }

    it "show agrupa copies por canal, ordenado por sequence_index" do
      campaign = workspace.campaigns.create!(name: "Black Friday", created_by: user.id)
      # passos fora de ordem pra provar o sort
      [["email", 2, "Email 2"], ["email", 1, "Email 1"], ["whatsapp", 1, "Zap 1"]].each do |ch, idx, title|
        copy = workspace.copies.create!(campaign_id: campaign.id, channel: ch, sequence_index: idx, title: title, created_by: user.id)
        CopyVersion.create!(copy_id: copy.id, n: 1, content: "#{title} corpo", is_current: true, author_id: user.id)
      end

      get "/api/v1/workspaces/#{workspace.slug}/campaigns/#{campaign.id}", headers: json
      expect(response).to have_http_status(:ok)
      seqs = body["sequences"]
      email = seqs.find { |s| s["channel"] == "email" }
      expect(email["steps"].map { |c| c["sequence_index"] }).to eq([1, 2])
      expect(email["steps"].first["current_content_preview"]).to eq("Email 1 corpo")
      expect(seqs.map { |s| s["channel"] }).to include("whatsapp")
    end

    it "generate_sequence rejeita canal inválido com 422" do
      campaign = workspace.campaigns.create!(name: "C", created_by: user.id)
      post "/api/v1/workspaces/#{workspace.slug}/campaigns/#{campaign.id}/sequence",
           params: { channel: "bogus", steps: 2 }.to_json, headers: json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(body["error"]).to eq("invalid_channel")
    end

    it "copy create persiste channel" do
      post "/api/v1/workspaces/#{workspace.slug}/copies",
           params: { title: "Zap", content: "oi", channel: "whatsapp" }.to_json, headers: json
      expect(response).to have_http_status(:created)
      id = body["id"]
      expect(Copy.find(id).channel).to eq("whatsapp")
    end
  end

  describe "produtos" do
    before { auth_as(user) }

    it "index vazio retorna lista + total 0" do
      get "/api/v1/workspaces/#{workspace.slug}/products", headers: json
      expect(body["products"]).to eq([])
      expect(body["total"]).to eq(0)
    end
  end

  describe "integrações" do
    before { auth_as(user) }

    it "index lista conectores com flags de plano (woo liberado no ultra)" do
      get "/api/v1/workspaces/#{workspace.slug}/integrations", headers: json
      woo = body["connectors"].find { |c| c["type"] == "woocommerce" }
      expect(woo["allowed"]).to eq(true)
      expect(woo["status"]).to eq("disconnected")
    end
  end
end
