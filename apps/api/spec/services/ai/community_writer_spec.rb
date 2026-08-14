require "rails_helper"

RSpec.describe Ai::CommunityWriter do
  let(:workspace) { create(:workspace) }

  # Captura o que foi mandado pro provedor sem chamar provedor nenhum.
  def capture_call
    captured = {}
    result   = Struct.new(:text, :model, :input_tokens, :output_tokens, :cost_usd, :stop_reason, keyword_init: true)
                     .new(text: "Chamada gerada", model: "sonnet", input_tokens: 10, output_tokens: 20, cost_usd: 0.01)

    allow(Ai::TextRouter).to receive(:call) do |**kwargs|
      captured.merge!(kwargs)
      result
    end

    yield
    captured
  end

  describe "prompt" do
    it "manda o assunto do artigo sem a marcação HTML" do
      sent = capture_call do
        described_class.call(
          workspace: workspace,
          title:     "Rotina de skincare",
          content:   "<h2>Passo 1</h2><p>Limpe o rosto <strong>com calma</strong>.</p>"
        )
      end

      expect(sent[:prompt]).to include("Rotina de skincare")
      expect(sent[:prompt]).to include("Limpe o rosto com calma")
      # HTML no feed do Fluent Community renderiza como marcação literal.
      expect(sent[:prompt]).not_to include("<h2>")
      expect(sent[:prompt]).not_to include("<strong>")
    end

    it "recorta o corpo — artigo inteiro em toda chamada é token queimado" do
      sent = capture_call do
        described_class.call(workspace: workspace, title: "T", content: "palavra " * 5_000)
      end

      trecho = sent[:prompt][/CONTEÚDO DO ARTIGO \(resumido\): (.*)/, 1].to_s
      expect(trecho.length).to be <= 3_000
    end

    it "inclui o link do artigo quando existe" do
      sent = capture_call do
        described_class.call(workspace: workspace, title: "T", url: "https://blog.test/artigo")
      end

      expect(sent[:prompt]).to include("https://blog.test/artigo")
    end

    it "não inventa instrução de link quando não há url" do
      sent = capture_call { described_class.call(workspace: workspace, title: "T") }

      expect(sent[:prompt]).to include("Termine convidando pra leitura.")
    end

    it "pede markdown e limita o tamanho — o feed não renderiza HTML" do
      sent = capture_call { described_class.call(workspace: workspace, title: "T") }

      expect(sent[:prompt]).to include("Markdown simples")
      expect(sent[:prompt]).to include(described_class::TARGET_CHARS.to_s)
    end

    it "omite a seção de conteúdo quando o post está sem corpo" do
      sent = capture_call { described_class.call(workspace: workspace, title: "T", content: nil) }

      expect(sent[:prompt]).not_to include("CONTEÚDO DO ARTIGO")
    end
  end

  describe "system prompt" do
    it "carrega o DNA da marca em uso" do
      dna = workspace.active_brand_dna
      dna.update!(marca: "Lizzon", tom: "acolhedor e direto", evitar: ["promessa de cura"])

      sent = capture_call { described_class.call(workspace: workspace, title: "T") }

      expect(sent[:system]).to include("Lizzon")
      expect(sent[:system]).to include("acolhedor e direto")
      expect(sent[:system]).to include("promessa de cura")
    end

    it "sempre proíbe inventar dado" do
      sent = capture_call { described_class.call(workspace: workspace, title: "T") }
      expect(sent[:system]).to include("Nunca invente dado")
    end
  end

  describe "saída" do
    it "tira a cerca de markdown que o modelo às vezes envolve" do
      cercado = Struct.new(:text, :model, :input_tokens, :output_tokens, :cost_usd, :stop_reason, keyword_init: true)
                      .new(text: "```markdown\nTexto do post\n```", model: "sonnet",
                           input_tokens: 1, output_tokens: 1, cost_usd: 0.0)
      allow(Ai::TextRouter).to receive(:call).and_return(cercado)

      expect(described_class.call(workspace: workspace, title: "T").text).to eq("Texto do post")
    end

    it "devolve o resultado da IA junto, pra quem chama contabilizar o custo" do
      out = nil
      capture_call { out = described_class.call(workspace: workspace, title: "T") }

      expect(out.text).to eq("Chamada gerada")
      expect(out.ai_result.cost_usd).to eq(0.01)
      expect(out.ai_result.model).to eq("sonnet")
    end
  end
end
