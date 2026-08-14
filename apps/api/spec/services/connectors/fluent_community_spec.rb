require "rails_helper"

RSpec.describe Connectors::FluentCommunity do
  let(:base_url)  { "https://comunidade.test" }
  let(:config) do
    {
      "base_url" => base_url, "username" => "editor",
      "application_password" => "abcd efgh ijkl", "default_space" => "start-here"
    }
  end
  let(:connector)  { described_class.new(config) }
  let(:spaces_url) { "#{base_url}/wp-json/fluent-community/v2/spaces/all-spaces" }
  let(:feeds_url)  { "#{base_url}/wp-json/fluent-community/v2/feeds" }

  before { allow_test_hosts! }

  def json_response(body, status: 200)
    { status: status, body: body.to_json, headers: { "Content-Type" => "application/json" } }
  end

  describe "construção" do
    it "recusa config sem credencial em vez de falhar no primeiro request" do
      expect { described_class.new("base_url" => base_url) }
        .to raise_error(described_class::ConnectionError, /obrigatórios/)
    end
  end

  describe "#spaces" do
    it "devolve só spaces do tipo community — curso e grupo não recebem post de feed" do
      stub_request(:get, spaces_url).to_return(json_response([
        { "id" => 2,  "title" => "Comece Aqui",  "slug" => "start-here",  "type" => "community",   "privacy" => "public" },
        { "id" => 9,  "title" => "Liso Express", "slug" => "liso",        "type" => "course",      "privacy" => "private" },
        { "id" => 1,  "title" => "Bem-vinda",    "slug" => "get-started", "type" => "space_group", "privacy" => "public" },
        { "id" => 25, "title" => "Lizzon",       "slug" => "loja",        "type" => "sidebar_link", "privacy" => "public" },
        { "id" => 7,  "title" => "Anúncios",     "slug" => "announcements", "type" => "community", "privacy" => "private" },
      ]))

      expect(connector.spaces.map { |s| s[:slug] }).to eq(%w[start-here announcements])
    end

    it "decodifica entidade HTML no título" do
      stub_request(:get, spaces_url).to_return(json_response([
        { "id" => 2, "title" => "Dicas &amp; Truques", "slug" => "dicas", "type" => "community", "privacy" => "public" },
      ]))

      expect(connector.spaces.first[:title]).to eq("Dicas & Truques")
    end

    it "aceita a resposta embrulhada em { spaces: [...] }" do
      stub_request(:get, spaces_url).to_return(json_response(
        "spaces" => [{ "id" => 2, "title" => "A", "slug" => "a", "type" => "community", "privacy" => "public" }]
      ))

      expect(connector.spaces.size).to eq(1)
    end

    it "aceita a resposta agrupada por space_group" do
      stub_request(:get, spaces_url).to_return(json_response(
        "space_groups" => [
          { "id" => 1, "spaces" => [{ "id" => 2, "title" => "A", "slug" => "a", "type" => "community", "privacy" => "public" }] },
          { "id" => 4, "spaces" => [{ "id" => 5, "title" => "B", "slug" => "b", "type" => "course",    "privacy" => "public" }] },
        ]
      ))

      expect(connector.spaces.map { |s| s[:slug] }).to eq(["a"])
    end
  end

  describe "#test_connection" do
    it "valida lendo os spaces — mesma policy que governa a publicação" do
      stub_request(:get, spaces_url).to_return(json_response([
        { "id" => 2, "title" => "A", "slug" => "a", "type" => "community", "privacy" => "public" },
      ]))

      expect(connector.test_connection).to include(ok: true, site: base_url, spaces: 1)
    end

    it "403 vira mensagem sobre acesso ao portal, não sobre senha errada" do
      stub_request(:get, spaces_url).to_return(json_response({ "message" => "no access" }, status: 403))

      # É o erro que mais confunde: admin do WordPress que nunca entrou na
      # comunidade tem credencial válida e mesmo assim é recusado.
      expect { connector.test_connection }
        .to raise_error(described_class::ConnectionError, /membro do portal/i)
    end

    it "404 aponta que o plugin pode não estar NESTE site" do
      stub_request(:get, spaces_url).to_return(json_response({}, status: 404))

      expect { connector.test_connection }
        .to raise_error(described_class::ConnectionError, /plugin está ativo NESTE site/)
    end

    it "401 fala de credencial" do
      stub_request(:get, spaces_url).to_return(json_response({ "message" => "bad auth" }, status: 401))

      expect { connector.test_connection }
        .to raise_error(described_class::ConnectionError, /credenciais recusadas/i)
    end

    it "resposta não-JSON aponta WAF" do
      stub_request(:get, spaces_url).to_return(status: 200, body: "<html>blocked</html>")

      expect { connector.test_connection }
        .to raise_error(described_class::ConnectionError, /não-JSON/i)
    end
  end

  describe "#publish" do
    let(:created) { { "feed" => { "id" => 900, "permalink" => "#{base_url}/feed/900", "slug" => "post-900" } } }

    it "manda message e space e devolve o post criado" do
      stub_request(:post, feeds_url).to_return(json_response(created, status: 201))

      result = connector.publish(message: "Olha isso", space: "start-here")

      expect(result).to include(id: 900, url: "#{base_url}/feed/900", space: "start-here")
      expect(
        a_request(:post, feeds_url).with { |r| JSON.parse(r.body).slice("message", "space") ==
          { "message" => "Olha isso", "space" => "start-here" } }
      ).to have_been_made
    end

    it "cai no default_space da config quando a chamada não escolhe um" do
      stub_request(:post, feeds_url).to_return(json_response(created, status: 201))

      connector.publish(message: "Olha isso")

      expect(a_request(:post, feeds_url).with { |r| JSON.parse(r.body)["space"] == "start-here" })
        .to have_been_made
    end

    it "recusa sem space, em vez de deixar o plugin responder erro genérico" do
      sem_default = described_class.new(config.except("default_space"))

      expect { sem_default.publish(message: "oi") }
        .to raise_error(described_class::PublishError, /space obrigatório/)
    end

    it "recusa mensagem vazia" do
      expect { connector.publish(message: "   ", space: "a") }
        .to raise_error(described_class::PublishError, /mensagem obrigatória/)
    end

    it "recusa acima do teto do plugin antes de gastar o round-trip" do
      expect { connector.publish(message: "x" * 15_001, space: "a") }
        .to raise_error(described_class::PublishError, /excede 15000/)

      expect(a_request(:post, feeds_url)).not_to have_been_made
    end

    it "corta o título em 192 caracteres — é o teto da coluna" do
      stub_request(:post, feeds_url).to_return(json_response(created, status: 201))

      connector.publish(message: "oi", space: "a", title: "T" * 300)

      expect(a_request(:post, feeds_url).with { |r| JSON.parse(r.body)["title"].length == 192 })
        .to have_been_made
    end

    it "omite topic_ids quando não há nenhum, em vez de mandar array vazio" do
      stub_request(:post, feeds_url).to_return(json_response(created, status: 201))

      connector.publish(message: "oi", space: "a", topic_ids: [])

      expect(a_request(:post, feeds_url).with { |r| !JSON.parse(r.body).key?("topic_ids") })
        .to have_been_made
    end

    it "422 do plugin vira PublishError com o motivo dele" do
      stub_request(:post, feeds_url).to_return(
        json_response({ "message" => "Please select at least one topic" }, status: 422)
      )

      expect { connector.publish(message: "oi", space: "a") }
        .to raise_error(described_class::PublishError, /select at least one topic/)
    end

    it "aceita resposta sem envelope `feed`" do
      stub_request(:post, feeds_url).to_return(
        json_response({ "id" => 12, "permalink" => "#{base_url}/f/12", "slug" => "f12" }, status: 201)
      )

      expect(connector.publish(message: "oi", space: "a")[:id]).to eq(12)
    end
  end

  describe "SSRF" do
    before { enforce_ssrf_guard! }

    it "recusa base_url apontando para a rede interna" do
      interno = described_class.new(config.merge("base_url" => "http://169.254.169.254"))

      expect { interno.spaces }.to raise_error(Security::SsrfBlocked)
    end
  end
end
