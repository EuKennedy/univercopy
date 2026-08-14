require "rails_helper"

# O lote do agente. O foco aqui é o acervo: todo post que o agente gera precisa
# sobreviver em "Meus posts", inclusive — principalmente — quando a publicação
# no WordPress falha depois de o texto já ter custado dinheiro.
RSpec.describe Blog::AgentRunJob, type: :job do
  let(:user)      { create(:app_user) }
  let(:workspace) { create(:workspace, owner: user, plan: "ultra") }

  let!(:integration) do
    i = workspace.integrations.new(integration_type: "wordpress", status: "connected")
    i.config = { "base_url" => "https://blog.test", "username" => "editor", "application_password" => "senha" }
    i.save!
    i
  end

  let(:ai_job) do
    workspace.ai_jobs.create!(task_kind: "blog_agent_run", status: "queued", payload: {})
  end

  let(:plan) do
    {
      "posts"          => [{ "topic" => "Rotina de skincare" }],
      "status"         => "draft",
      "generate_cover" => false,
      "category_ids"   => [3],
      "tag_ids"        => [9],
      "notes"          => "tom acolhedor",
    }
  end

  # Texto sempre dublado: gerar de verdade chamaria Anthropic/OpenAI.
  def stub_writer(title: "Título gerado", content: "<p>Corpo gerado</p>")
    result = Struct.new(:cost_usd, :model, :input_tokens, :output_tokens, keyword_init: true)
                   .new(cost_usd: 0.01, model: "sonnet", input_tokens: 10, output_tokens: 20)

    allow(Ai::BlogWriter).to receive(:title)
      .and_return(Ai::BlogWriter::Result.new(text: title, ai_result: result))
    allow(Ai::BlogWriter).to receive(:content)
      .and_return(Ai::BlogWriter::Result.new(text: content, ai_result: result))
  end

  def stub_wordpress(publish_result: nil, publish_error: nil)
    fake = instance_double(Connectors::Wordpress)
    if publish_error
      allow(fake).to receive(:publish).and_raise(publish_error)
    else
      allow(fake).to receive(:publish).and_return(publish_result)
    end
    allow(Connectors::Wordpress).to receive(:new).and_return(fake)
    fake
  end

  def perform!(with_plan = plan)
    described_class.new.perform(
      workspace_id: workspace.id, ai_job_id: ai_job.id, user_id: user.id, plan: with_plan
    )
  end

  describe "caminho feliz" do
    before do
      stub_writer
      stub_wordpress(publish_result: { id: 321, url: "https://blog.test/rotina", status: "draft" })
    end

    it "grava o post no acervo e o marca como publicado" do
      expect { perform! }.to change { workspace.blog_posts.count }.by(1)

      record = workspace.blog_posts.last
      expect(record).to have_attributes(
        origin:     "univercopy",
        status:     "published",
        title:      "Título gerado",
        content:    "<p>Corpo gerado</p>",
        wp_post_id: 321,
        wp_status:  "draft",
        url:        "https://blog.test/rotina",
        created_by: user.id
      )
    end

    it "guarda o tema que originou o post e o lote de onde veio" do
      perform!

      record = workspace.blog_posts.last
      expect(record.brief).to include("Rotina de skincare").and include("tom acolhedor")
      expect(record.ai_job_id).to eq(ai_job.id)
      expect(record.category_ids).to eq([3])
      expect(record.tag_ids).to eq([9])
    end

    it "liga o registro do acervo ao progresso do lote" do
      perform!

      entry = ai_job.reload.result["posts"].first
      expect(entry["status"]).to eq("done")
      expect(entry["blog_post_id"]).to eq(workspace.blog_posts.last.id)
    end

    it "fecha o ai_job como done" do
      perform!
      expect(ai_job.reload.status).to eq("done")
    end
  end

  describe "quando o WordPress recusa a publicação" do
    before do
      stub_writer
      stub_wordpress(publish_error: Connectors::Wordpress::ConnectionError.new("timeout no WordPress"))
    end

    it "preserva o texto gerado como rascunho — republicável em Meus posts" do
      expect { perform! }.to change { workspace.blog_posts.count }.by(1)

      record = workspace.blog_posts.last
      expect(record.status).to eq("draft")
      expect(record.content).to eq("<p>Corpo gerado</p>")
      expect(record).to be_editable
    end

    it "anota o motivo da falha no próprio rascunho" do
      perform!
      expect(workspace.blog_posts.last.last_error).to include("timeout no WordPress")
    end

    it "não levanta exceção — retry republicaria o que já subiu" do
      expect { perform! }.not_to raise_error
    end

    it "contabiliza a falha no lote" do
      perform!

      state = ai_job.reload.result
      expect(state["failed"]).to eq(1)
      expect(state["completed"]).to eq(0)
      expect(ai_job.status).to eq("error")
    end
  end

  describe "vários posts no lote" do
    it "uma falha no meio não impede os outros de irem ao ar" do
      stub_writer

      fake = instance_double(Connectors::Wordpress)
      chamadas = 0
      allow(fake).to receive(:publish) do
        chamadas += 1
        raise Connectors::Wordpress::PublishError, "recusado" if chamadas == 2

        { id: 100 + chamadas, url: "https://blog.test/#{chamadas}", status: "draft" }
      end
      allow(Connectors::Wordpress).to receive(:new).and_return(fake)

      tres = plan.merge("posts" => [
        { "topic" => "A" }, { "topic" => "B" }, { "topic" => "C" }
      ])

      expect { perform!(tres) }.to change { workspace.blog_posts.count }.by(3)

      # Os três textos sobrevivem; só o que falhou continua rascunho.
      expect(workspace.blog_posts.where(status: "published").count).to eq(2)
      expect(workspace.blog_posts.where(status: "draft").count).to eq(1)
      expect(ai_job.reload.result).to include("completed" => 2, "failed" => 1)
    end
  end

  describe "quando o teto de custo estoura no meio do lote" do
    it "para, marca os restantes como skipped e não gera mais nada" do
      stub_writer
      stub_wordpress(publish_result: { id: 1, url: nil, status: "draft" })

      chamadas = 0
      allow(AiCostCap).to receive(:require!) do
        chamadas += 1
        raise CapReached.new(kind: :ai_monthly_cost_usd, workspace_id: workspace.id, limit: 5, used: 6) if chamadas > 1
      end

      dois = plan.merge("posts" => [{ "topic" => "A" }, { "topic" => "B" }])
      perform!(dois)

      expect(workspace.blog_posts.count).to eq(1)
      expect(ai_job.reload.result["posts"].last["status"]).to eq("skipped")
    end
  end

  describe "plano vazio" do
    it "encerra com erro sem chamar IA nem WordPress" do
      expect(Ai::BlogWriter).not_to receive(:title)

      perform!(plan.merge("posts" => []))

      expect(ai_job.reload.status).to eq("error")
      expect(ai_job.error).to eq("plano sem posts")
    end
  end

  describe "resiliência do acervo" do
    it "publica no WordPress mesmo se gravar o rascunho local falhar" do
      stub_writer
      fake = stub_wordpress(publish_result: { id: 9, url: nil, status: "draft" })
      allow_any_instance_of(BlogPost).to receive(:save!).and_raise(ActiveRecord::StatementInvalid, "disco cheio")

      perform!

      expect(fake).to have_received(:publish)
      expect(ai_job.reload.result["completed"]).to eq(1)
    end
  end
end
