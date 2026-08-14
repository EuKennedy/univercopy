require "rails_helper"

# Cobertura do `each_post` — a leitura do blog que alimenta o acervo local.
# Tudo via WebMock: nenhum destes exemplos toca um WordPress de verdade.
RSpec.describe Connectors::Wordpress, "#each_post" do
  let(:base_url) { "https://blog.test" }
  let(:config) do
    { "base_url" => base_url, "username" => "editor", "application_password" => "abcd efgh ijkl" }
  end
  let(:connector) { described_class.new(config) }
  let(:posts_url) { "#{base_url}/wp-json/wp/v2/posts" }

  def wp_post(id:, **overrides)
    {
      "id"             => id,
      "date_gmt"       => "2026-08-01T12:00:00",
      "modified_gmt"   => "2026-08-02T09:30:00",
      "slug"           => "post-#{id}",
      "status"         => "publish",
      "link"           => "#{base_url}/post-#{id}",
      "title"          => { "raw" => "Título #{id}", "rendered" => "Título #{id} renderizado" },
      "content"        => { "raw" => "<p>Corpo #{id}</p>", "rendered" => "<p>Corpo renderizado</p>" },
      "excerpt"        => { "raw" => "Resumo #{id}", "rendered" => "Resumo renderizado" },
      "categories"     => [3, 7],
      "tags"           => [11],
      "featured_media" => 500 + id,
    }.merge(overrides)
  end

  def stub_page(page, body, total_pages: 1)
    stub_request(:get, posts_url)
      .with(query: hash_including({ "page" => page.to_s }))
      .to_return(
        status:  200,
        body:    body.to_json,
        headers: { "Content-Type" => "application/json", "X-WP-TotalPages" => total_pages.to_s }
      )
  end

  def collect
    [].tap { |out| connector.each_post { |p| out << p } }
  end

  describe "normalização" do
    before { stub_page(1, [wp_post(id: 10)]) }

    it "prefere o markup original (raw) ao HTML já renderizado" do
      post = collect.first

      # `raw` é o que volta pro nosso editor sem shortcode expandido.
      expect(post[:title]).to eq("Título 10")
      expect(post[:content]).to eq("<p>Corpo 10</p>")
      expect(post[:excerpt]).to eq("Resumo 10")
    end

    it "mapeia identificadores, taxonomias e capa" do
      post = collect.first

      expect(post).to include(
        wp_post_id:        10,
        slug:              "post-10",
        wp_status:         "publish",
        url:               "#{base_url}/post-10",
        category_ids:      [3, 7],
        tag_ids:           [11],
        featured_media_id: 510
      )
    end

    it "lê as datas como UTC, não como fuso da aplicação" do
      post = collect.first

      expect(post[:published_at]).to eq(Time.utc(2026, 8, 1, 12, 0, 0))
      expect(post[:wp_modified_at]).to eq(Time.utc(2026, 8, 2, 9, 30, 0))
    end
  end

  describe "campos ausentes ou em formato inesperado" do
    it "cai no `rendered` quando o hardening do site não devolve `raw`" do
      stub_page(1, [wp_post(id: 1, "title" => { "rendered" => "Só renderizado" })])
      expect(collect.first[:title]).to eq("Só renderizado")
    end

    it "aceita string crua no lugar do hash" do
      stub_page(1, [wp_post(id: 1, "title" => "Título plano")])
      expect(collect.first[:title]).to eq("Título plano")
    end

    it "trata featured_media 0 como ausência de capa, não como id 0" do
      stub_page(1, [wp_post(id: 1, "featured_media" => 0)])
      expect(collect.first[:featured_media_id]).to be_nil
    end

    it "devolve nil em data vazia ou inválida em vez de estourar" do
      stub_page(1, [wp_post(id: 1, "date_gmt" => "", "modified_gmt" => "não é data")])
      post = collect.first
      expect(post[:published_at]).to be_nil
      expect(post[:wp_modified_at]).to be_nil
    end
  end

  describe "paginação" do
    it "percorre todas as páginas indicadas pelo X-WP-TotalPages" do
      stub_page(1, [wp_post(id: 1), wp_post(id: 2)], total_pages: 3)
      stub_page(2, [wp_post(id: 3)],                 total_pages: 3)
      stub_page(3, [wp_post(id: 4)],                 total_pages: 3)

      expect(collect.map { |p| p[:wp_post_id] }).to eq([1, 2, 3, 4])
    end

    it "para numa página vazia mesmo que o header prometa mais" do
      stub_page(1, [wp_post(id: 1)], total_pages: 9)
      stub_page(2, [],               total_pages: 9)

      expect(collect.size).to eq(1)
    end

    it "pede context=edit e status=any — rascunho e privado também entram no acervo" do
      stub_page(1, [wp_post(id: 1)])
      collect

      expect(
        a_request(:get, posts_url).with(query: hash_including({ "context" => "edit", "status" => "any" }))
      ).to have_been_made
    end

    it "ordena por id ascendente para não pular post com o blog recebendo publicações" do
      stub_page(1, [wp_post(id: 1)])
      collect

      expect(
        a_request(:get, posts_url).with(query: hash_including({ "orderby" => "id", "order" => "asc" }))
      ).to have_been_made
    end

    it "restringe os campos pedidos — sem _fields o WP devolve dezenas de MB" do
      stub_page(1, [wp_post(id: 1)])
      collect

      expect(
        a_request(:get, posts_url).with { |req| req.uri.query.include?("_fields") }
      ).to have_been_made
    end
  end

  describe "erros" do
    it "traduz 401 em mensagem sobre credencial" do
      stub_request(:get, posts_url).to_return(
        status: 401, body: { "message" => "Senha incorreta" }.to_json,
        headers: { "Content-Type" => "application/json" }
      )

      expect { collect }.to raise_error(described_class::ConnectionError, /credenciais recusadas/i)
    end

    it "traduz 403 em mensagem sobre permissão de edição" do
      stub_request(:get, posts_url).to_return(status: 403, body: "{}", headers: { "Content-Type" => "application/json" })

      expect { collect }.to raise_error(described_class::ConnectionError, /sem permissão/i)
    end

    it "explica resposta não-JSON, que é o sintoma de WAF na frente da REST" do
      stub_request(:get, posts_url).to_return(status: 200, body: "<html>bloqueado pelo firewall</html>")

      expect { collect }.to raise_error(described_class::ConnectionError, /não-JSON/i)
    end
  end
end
