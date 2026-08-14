require "rails_helper"

RSpec.describe BlogPost, type: :model do
  let(:workspace) { create(:workspace) }

  def build_post(**attrs)
    described_class.new({ workspace: workspace, title: "Título" }.merge(attrs))
  end

  describe "validações" do
    it "exige título" do
      expect(build_post(title: nil)).not_to be_valid
    end

    it "aceita apenas origens conhecidas" do
      expect(build_post(origin: "univercopy")).to be_valid
      expect(build_post(origin: "wordpress")).to be_valid
      expect(build_post(origin: "medium")).not_to be_valid
    end

    it "aceita apenas status locais conhecidos" do
      expect(build_post(status: "draft")).to be_valid
      expect(build_post(status: "published")).to be_valid
      expect(build_post(status: "revisao")).not_to be_valid
    end

    it "aceita wp_status em branco mas rejeita valor fora da lista do WordPress" do
      expect(build_post(wp_status: nil)).to be_valid
      expect(build_post(wp_status: "")).to be_valid
      expect(build_post(wp_status: "future")).to be_valid
      expect(build_post(wp_status: "trashed")).not_to be_valid
    end
  end

  describe "#editable?" do
    it "é verdadeiro só para rascunho nascido no UniverCopy" do
      expect(build_post(origin: "univercopy", status: "draft")).to be_editable
    end

    it "é falso depois de publicado — quem manda no post agora é o WordPress" do
      expect(build_post(origin: "univercopy", status: "published")).not_to be_editable
    end

    it "é falso para post trazido pelo sync, mesmo que o WordPress o tenha como rascunho" do
      expect(build_post(origin: "wordpress", status: "published", wp_status: "draft")).not_to be_editable
    end
  end

  describe "#mark_published!" do
    it "grava o retorno do conector e limpa o erro anterior" do
      post = described_class.create!(
        workspace: workspace, title: "T", status: "draft", origin: "univercopy",
        last_error: "timeout na tentativa anterior"
      )

      post.mark_published!({ id: 4242, url: "https://blog.test/post", status: "publish" })

      expect(post.reload).to have_attributes(
        status:     "published",
        wp_post_id: 4242,
        url:        "https://blog.test/post",
        wp_status:  "publish",
        last_error: nil
      )
      expect(post.published_at).to be_present
    end

    it "aceita publicação como rascunho no WordPress sem virar 'no ar'" do
      post = described_class.create!(workspace: workspace, title: "T", status: "draft")
      post.mark_published!({ id: 7, url: nil, status: "draft" })

      # status local diz "saiu daqui"; wp_status diz "ainda não está no ar".
      expect(post.status).to eq("published")
      expect(post.wp_status).to eq("draft")
    end
  end

  describe "scopes" do
    before do
      described_class.create!(workspace: workspace, title: "A", origin: "univercopy", status: "draft")
      described_class.create!(workspace: workspace, title: "B", origin: "univercopy", status: "published", wp_post_id: 1)
      described_class.create!(workspace: workspace, title: "C", origin: "wordpress",  status: "published", wp_post_id: 2)
    end

    it "separa por origem e por status" do
      expect(described_class.univercopy.count).to eq(2)
      expect(described_class.from_wordpress.count).to eq(1)
      expect(described_class.drafts.count).to eq(1)
    end
  end

  describe "índice único parcial em (workspace_id, wp_post_id)" do
    it "impede dois registros para o mesmo post do WordPress" do
      described_class.create!(workspace: workspace, title: "A", wp_post_id: 99)

      expect {
        described_class.create!(workspace: workspace, title: "B", wp_post_id: 99)
      }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it "permite vários rascunhos locais, que não têm wp_post_id" do
      expect {
        3.times { |i| described_class.create!(workspace: workspace, title: "Rascunho #{i}", wp_post_id: nil) }
      }.to change(described_class, :count).by(3)
    end
  end
end
