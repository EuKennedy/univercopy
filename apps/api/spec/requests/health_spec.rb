require "rails_helper"

RSpec.describe "Health probes", type: :request do
  describe "GET /up" do
    it "responds 200 OK with service metadata" do
      get "/up"
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body).to include("ok" => true, "service" => "univercopy-api")
    end
  end

  describe "GET /api/v1/health" do
    it "responds 200 OK" do
      get "/api/v1/health"
      expect(response).to have_http_status(:ok)
    end
  end
end
