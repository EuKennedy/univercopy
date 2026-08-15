module Api
  module V1
    # Publicação no blog WordPress via REST API v2, com geração assistida por IA.
    #
    # Duas credenciais, ambas POR WORKSPACE e cifradas na tabela `integrations`
    # (TENANT_CREDENTIALS_KEY): o WordPress (usuário + senha de aplicação) e a
    # OpenAI (chave, usada só para gerar a capa). Nenhuma delas vem de ENV.
    #
    # Texto (título e corpo) usa o Anthropic que já move o resto do produto;
    # imagem usa OpenAI porque é o pedido do produto. Toda geração passa por
    # PlanFeatures + AiCostCap e vira um AiJob para o custo entrar na conta.
    #
    # rescue_from é avaliado na ordem REVERSA da declaração — a BaseController
    # declara o catch-all StandardError primeiro, então estes vêm antes.
    class BlogPostsController < WorkspaceScopedController
      class NotConnected   < StandardError; end
      class OpenAiMissing  < StandardError; end

      NOT_CONNECTED_MSG = "Nenhum WordPress conectado neste workspace. " \
                          "Conecte em Configurações → Integrações.".freeze
      OPENAI_MISSING_MSG = "Nenhuma chave da OpenAI cadastrada neste workspace. " \
                           "Cadastre em Configurações → Integrações para gerar capas.".freeze

      rescue_from Connectors::Wordpress::ConnectionError, with: :render_blog_unreachable
      rescue_from Connectors::Wordpress::PublishError,    with: :render_blog_failed
      rescue_from Connectors::OpenAi::ConnectionError,    with: :render_openai_failed
      rescue_from Connectors::OpenAi::GenerationError,    with: :render_openai_failed
      rescue_from NotConnected,                           with: :render_blog_not_connected
      rescue_from OpenAiMissing,                          with: :render_openai_missing

      # ---------------------------------------------------------------
      # Estado e taxonomias
      # ---------------------------------------------------------------

      # GET /blog/status
      def status
        return render json: base_status(connected: false) if wp_integration.blank?

        begin
          result = wp.test_connection
          render json: base_status(connected: true, reachable: true, site: result[:site])
        rescue Connectors::Wordpress::ConnectionError => e
          Rails.logger.warn("[BlogPosts] WordPress indisponível: #{e.message}")
          render json: base_status(connected: true, site: wp_integration.config["base_url"]).merge(message: e.message)
        end
      end

      # GET /blog/categories
      def categories
        render json: { categories: wp.categories }
      end

      # GET /blog/tags
      def tags
        render json: { tags: wp.tags }
      end

      # POST /blog/categories — botão "+" da tela.
      def create_category
        render json: { term: wp.create_category(term_params[:name]) }, status: :created
      end

      # POST /blog/tags — botão "+" da tela.
      def create_tag
        render json: { term: wp.create_tag(term_params[:name]) }, status: :created
      end

      # ---------------------------------------------------------------
      # Geração com IA
      # ---------------------------------------------------------------

      # POST /blog/generate/title  body: { brief?, model? }
      def generate_title
        guard_text_generation!
        b = generate_params

        result = Ai::BlogWriter.title(workspace: current_workspace, brief: b[:brief], model: b[:model])
        record_ai_job!("blog_title", result.ai_result)

        render json: { title: result.text, cost: AiCostCap.report(current_workspace) }
      end

      # POST /blog/generate/content  body: { title?, brief?, model? }
      def generate_content
        guard_text_generation!
        b = generate_params

        result = Ai::BlogWriter.content(
          workspace: current_workspace, title: b[:title], brief: b[:brief], model: b[:model]
        )
        record_ai_job!("blog_content", result.ai_result)

        render json: { content: result.text, cost: AiCostCap.report(current_workspace) }
      end

      # POST /blog/cover/generate  body: { title?, prompt?, size?, quality? }
      # Gera na OpenAI e já sobe pra biblioteca de mídia do WordPress — assim o
      # navegador recebe só uma URL em vez de megabytes de base64.
      def generate_cover
        PlanFeatures.require!(current_workspace, :ai_cover_image)
        AiCostCap.require!(current_workspace)

        b      = cover_params
        prompt = b[:prompt].presence ||
                 Ai::BlogWriter.cover_prompt(workspace: current_workspace, title: b[:title], extra: b[:brief])

        image = openai.generate_image(
          prompt:  prompt,
          size:    b[:size].presence    || Connectors::OpenAi::DEFAULT_SIZE,
          quality: b[:quality].presence || Connectors::OpenAi::DEFAULT_QUALITY
        )

        record_image_job!(prompt, image)

        media = wp.upload_media(
          data:     image[:data],
          filename: "capa-#{Time.current.to_i}.#{image[:format]}",
          mime:     image[:mime],
          alt:      b[:title]
        )

        render json: { media: media, prompt: prompt, cost: AiCostCap.report(current_workspace) }, status: :created
      end

      # POST /blog/cover/upload  body: { filename, mime, data_base64 }
      # Capa vinda do computador do usuário.
      def upload_cover
        b = upload_params

        mime = b[:mime].to_s
        unless ALLOWED_IMAGE_MIMES.include?(mime)
          return render json: { error: "unsupported_media", message: "Formato não suportado: #{mime}. Use JPEG, PNG ou WebP." },
                        status: :unprocessable_entity
        end

        data = decode_base64(b[:data_base64])
        return render json: { error: "invalid_upload", message: "Arquivo inválido ou vazio." }, status: :unprocessable_entity if data.blank?

        media = wp.upload_media(data: data, filename: b[:filename].presence || "capa", mime: mime, alt: b[:alt])
        render json: { media: media }, status: :created
      end

      # ---------------------------------------------------------------
      # Agente — planeja um lote de posts conversando, depois executa
      # ---------------------------------------------------------------

      # POST /blog/agent/message  body: { messages: [{role, content}] }
      # Só conversa. Não gera nem publica nada.
      def agent_message
        guard_text_generation!

        result = Ai::BlogAgent.call(
          workspace:  current_workspace,
          messages:   agent_message_params,
          categories: wp.categories,
          tags:       wp.tags,
          has_openai: openai_integration.present?
        )
        record_ai_job!("blog_agent", result.ai_result)

        render json: {
          reply: result.reply,
          plan:  result.plan,
          ready: result.ready,
          cost:  AiCostCap.report(current_workspace),
        }
      end

      # POST /blog/agent/run  body: { plan: {...} }
      # Confirmação explícita do usuário. Enfileira e devolve o job pra polling.
      def agent_run
        guard_text_generation!
        wp # levanta NotConnected antes de enfileirar, em vez de falhar no worker

        plan = sanitized_plan
        if plan["posts"].blank?
          return render json: { error: "empty_plan", message: "O plano não tem nenhum post." },
                        status: :unprocessable_entity
        end

        ai_job = AiJob.create!(
          workspace_id: current_workspace.id,
          task_kind:    "blog_agent_run",
          status:       "queued",
          payload:      { posts: plan["posts"].size, status: plan["status"], cover: plan["generate_cover"] }
        )

        Blog::AgentRunJob.perform_later(
          workspace_id: current_workspace.id,
          ai_job_id:    ai_job.id,
          user_id:      current_app_user.id,
          plan:         plan
        )

        render json: { job: ai_job_payload(ai_job) }, status: :accepted
      end

      # GET /blog/agent/run/:id — polling do progresso.
      def agent_run_status
        job = current_workspace.ai_jobs.find_by!(id: params[:id])
        render json: { job: ai_job_payload(job) }
      end

      # ---------------------------------------------------------------
      # Acervo local — "Meus posts"
      # ---------------------------------------------------------------

      # GET /blog/posts?origin=&status=&q=
      # Lista sem o corpo dos posts: 500 posts com HTML inteiro viram megabytes
      # numa tela que só mostra título e data. O corpo vem no #post.
      def posts
        scope = current_workspace.blog_posts.recent
        scope = scope.where(origin: params[:origin]) if BlogPost::ORIGINS.include?(params[:origin].to_s)
        scope = scope.where(status: params[:status]) if BlogPost::STATUSES.include?(params[:status].to_s)

        if (q = params[:q].to_s.strip).present?
          scope = scope.where("title ILIKE ?", "%#{sanitize_like(q)}%")
        end

        render json: {
          posts:  scope.limit(POSTS_PAGE_SIZE).map { |p| post_summary(p) },
          counts: {
            total:      current_workspace.blog_posts.count,
            drafts:     current_workspace.blog_posts.drafts.count,
            univercopy: current_workspace.blog_posts.univercopy.count,
            wordpress:  current_workspace.blog_posts.from_wordpress.count,
          },
          last_sync_at: wp_integration&.last_sync_at,
        }
      end

      # GET /blog/posts/:id — detalhe com corpo, pra abrir no editor.
      def post
        render json: { post: post_detail(find_post!) }
      end

      # POST /blog/posts — salva rascunho local, sem tocar no WordPress.
      def create_draft
        record = current_workspace.blog_posts.create!(
          draft_params.merge(origin: "univercopy", status: "draft", created_by: current_app_user.id)
        )
        render json: { post: post_detail(record) }, status: :created
      end

      # PATCH /blog/posts/:id
      def update_draft
        record = find_post!
        return render_not_editable unless record.editable?

        record.update!(draft_params)
        render json: { post: post_detail(record) }
      end

      # DELETE /blog/posts/:id — apaga só a cópia local. Post que já foi pro
      # WordPress continua lá; remover de lá é decisão que se toma no WordPress.
      def destroy_draft
        find_post!.destroy!
        render json: { ok: true }
      end

      # POST /blog/posts/:id/publish — manda um rascunho local pro WordPress.
      # body: { status?: draft|publish }
      def publish_draft
        record = find_post!
        return render_not_editable unless record.editable?

        # O erro é tratado AQUI, sem re-levantar, de propósito. O
        # `around_action` de RLS envolve a action numa transação: deixar a
        # exceção subir até o rescue_from faria rollback e apagaria justamente
        # o `last_error` que acabamos de gravar. Guardar o motivo no rascunho é
        # o que permite a quem abre "Meus posts" ver por que o post não subiu,
        # sem ter que caçar log.
        begin
          result = wp.publish(
            title:          record.title,
            content:        record.content,
            status:         publish_status_param,
            excerpt:        record.excerpt,
            category_ids:   Array(record.category_ids),
            tag_ids:        Array(record.tag_ids),
            featured_media: record.featured_media_id
          )
        rescue Connectors::Wordpress::ConnectionError => e
          record.update_columns(last_error: e.message.to_s.slice(0, 500), updated_at: Time.current)
          return render_blog_unreachable(e)
        rescue Connectors::Wordpress::PublishError => e
          record.update_columns(last_error: e.message.to_s.slice(0, 500), updated_at: Time.current)
          return render_blog_failed(e)
        end

        record.mark_published!(result)
        record_audit!(result)

        render json: { ok: true, post: post_detail(record) }, status: :created
      end

      # POST /blog/sync — re-importa o blog do WordPress sob demanda.
      def sync
        raise NotConnected, NOT_CONNECTED_MSG if wp_integration.blank?

        PlanFeatures.require!(current_workspace, :connector_wordpress)
        Connectors::SyncBlogPostsJob.perform_later(
          workspace_id:   current_workspace.id,
          user_id:        current_app_user.id,
          integration_id: wp_integration.id
        )
        render json: { ok: true, sync: "queued" }, status: :accepted
      end

      # ---------------------------------------------------------------
      # Publicação direta (editor)
      # ---------------------------------------------------------------

      # POST /blog/publish
      def publish
        p = publish_params

        result = wp.publish(
          title:          p[:title],
          content:        p[:content],
          status:         p[:status].presence || "draft",
          excerpt:        p[:excerpt],
          category_ids:   Array(p[:category_ids]),
          tag_ids:        Array(p[:tag_ids]),
          featured_media: p[:featured_media]
        )

        record_audit!(result)
        # Espelha no acervo local: tudo que sai daqui aparece em "Meus posts",
        # independente de ter vindo do editor ou do agente.
        record = archive_published!(p, result)

        render json: { ok: true, post: result, archived: record && post_summary(record) }, status: :created
      end

      private

      POSTS_PAGE_SIZE = 200

      ALLOWED_IMAGE_MIMES = %w[image/jpeg image/png image/webp].freeze
      # 8MB — mesmo teto do cliente e do bodySizeLimit do server action.
      MAX_UPLOAD_BYTES    = 8 * 1_048_576

      def base_status(connected:, reachable: false, site: nil)
        { connected: connected, reachable: reachable, site: site, openai: openai_integration.present? }
      end

      # --- conectores ---

      def wp_integration
        @wp_integration ||= current_workspace.integrations.find_by(integration_type: "wordpress", status: "connected")
      end

      def openai_integration
        @openai_integration ||= current_workspace.integrations.find_by(integration_type: "openai", status: "connected")
      end

      def wp
        @wp ||= begin
          raise NotConnected, NOT_CONNECTED_MSG if wp_integration.blank?

          PlanFeatures.require!(current_workspace, :connector_wordpress)
          Connectors::Wordpress.new(wp_integration.config)
        end
      end

      def openai
        @openai ||= begin
          raise OpenAiMissing, OPENAI_MISSING_MSG if openai_integration.blank?

          PlanFeatures.require!(current_workspace, :connector_openai)
          Connectors::OpenAi.new(openai_integration.config)
        end
      end

      def guard_text_generation!
        PlanFeatures.require!(current_workspace, :ai_blog_writer)
        AiCostCap.require!(current_workspace)
      end

      # --- params ---

      def publish_params
        params.require(:post)
              .permit(:title, :content, :excerpt, :status, :featured_media, category_ids: [], tag_ids: [])
      end

      def generate_params
        params.fetch(:generate, {}).permit(:title, :brief, :model)
      end

      def cover_params
        params.fetch(:cover, {}).permit(:title, :brief, :prompt, :size, :quality)
      end

      def upload_params
        params.require(:cover).permit(:filename, :mime, :alt, :data_base64)
      end

      def term_params
        params.require(:term).permit(:name)
      end

      # Só entra no hash o que o cliente REALMENTE mandou. Semântica de PATCH:
      # campo ausente fica como está, campo enviado vazio é limpeza de verdade
      # — descartar valor vazio impediria o usuário de tirar todas as
      # categorias ou apagar o resumo.
      def draft_params
        raw = params.require(:post).permit(
          :title, :content, :excerpt, :brief, :featured_media, :featured_media_url,
          category_ids: [], tag_ids: []
        )
        out = {}

        out[:title]              = raw[:title].to_s.strip.slice(0, 500)             if raw.key?(:title)
        out[:content]            = raw[:content].to_s                               if raw.key?(:content)
        out[:excerpt]            = raw[:excerpt].to_s.strip.presence                if raw.key?(:excerpt)
        out[:brief]              = raw[:brief].to_s.strip.slice(0, 2_000).presence  if raw.key?(:brief)
        out[:featured_media_url] = raw[:featured_media_url].to_s.strip.presence     if raw.key?(:featured_media_url)

        if raw.key?(:featured_media)
          media = raw[:featured_media].to_i
          out[:featured_media_id] = media.positive? ? media : nil
        end

        %i[category_ids tag_ids].each do |key|
          next unless raw.key?(key)

          out[key] = Array(raw[key]).map(&:to_i).reject(&:zero?).uniq.first(20)
        end

        out
      end

      # Status do WordPress, não o nosso. Só draft ou publish — quem manda é a
      # tela, e "publish" só sai daqui se o usuário clicou em publicar.
      def publish_status_param
        wanted = params[:status].to_s.strip
        Connectors::Wordpress::ALLOWED_STATUSES.include?(wanted) ? wanted : "draft"
      end

      def find_post!
        current_workspace.blog_posts.find(params.require(:id))
      end

      # `%` e `_` são curingas no ILIKE — sem escapar, buscar por "50%" varre
      # tudo que começa com 50.
      def sanitize_like(term)
        term.gsub(/[\\%_]/) { |c| "\\#{c}" }
      end

      # Grava no acervo o que acabou de subir pelo editor. Falha aqui não pode
      # derrubar a resposta: o post JÁ existe no WordPress e um 500 faria o
      # usuário reenviar e duplicar.
      #
      # SAVEPOINT (`requires_new: true`) porque o around_action de RLS envolve a
      # action numa transação: sem ele, um erro de banco aqui a abortaria e nem
      # o COMMIT no fim da action passaria — o rescue viraria enfeite e o
      # usuário levaria 500 com o post já publicado.
      def archive_published!(input, result)
        ApplicationRecord.transaction(requires_new: true) do
          build_archived_post!(input, result)
        end
      rescue StandardError => e
        Rails.logger.error("[BlogPosts] arquivar post publicado falhou: #{e.class}: #{e.message}")
        nil
      end

      def build_archived_post!(input, result)
        current_workspace.blog_posts.create!(
          origin:             "univercopy",
          status:             "published",
          title:              input[:title].to_s.strip.slice(0, 500),
          content:            input[:content].to_s,
          excerpt:            input[:excerpt].to_s.strip.presence,
          category_ids:       Array(input[:category_ids]).map(&:to_i),
          tag_ids:            Array(input[:tag_ids]).map(&:to_i),
          featured_media_id:  input[:featured_media].to_i.positive? ? input[:featured_media].to_i : nil,
          wp_post_id:         result[:id],
          url:                result[:url],
          wp_status:          result[:status],
          published_at:       Time.current,
          created_by:         current_app_user.id
        )
      end

      def post_summary(record)
        {
          id:                 record.id,
          origin:             record.origin,
          title:              record.title,
          excerpt:            record.excerpt,
          status:             record.status,
          wp_status:          record.wp_status,
          wp_post_id:         record.wp_post_id,
          url:                record.url,
          slug:               record.slug,
          featured_media_url: record.featured_media_url,
          editable:           record.editable?,
          last_error:         record.last_error,
          published_at:       record.published_at,
          updated_at:         record.updated_at,
          # Anúncio na comunidade: `shareable` é o que decide se a tela mostra
          # o botão; `community_url` é o que ela mostra quando já saiu.
          shareable:          record.shareable_to_community?,
          community_url:      record.community_url,
          community_space:    record.community_space,
        }
      end

      def post_detail(record)
        post_summary(record).merge(
          content:           record.content,
          brief:             record.brief,
          category_ids:      Array(record.category_ids),
          tag_ids:           Array(record.tag_ids),
          featured_media_id: record.featured_media_id,
          synced_at:         record.synced_at,
          wp_modified_at:    record.wp_modified_at,
        )
      end

      def render_not_editable
        render json: {
          error:   "not_editable",
          message: "Este post já está no WordPress. Edite-o por lá.",
        }, status: :unprocessable_entity
      end

      def agent_message_params
        params.require(:messages).map { |m| m.permit(:role, :content).to_h }
      end

      # O plano volta do cliente, então NADA nele é confiável. Reconstruímos
      # campo a campo com tipo, teto e lista branca — o cliente só escolhe
      # dentro do que o servidor aceita.
      def sanitized_plan
        raw = params.require(:plan).permit(
          :status, :generate_cover, :notes,
          category_ids: [], tag_ids: [],
          posts: %i[topic angle]
        )

        posts = Array(raw[:posts]).filter_map do |p|
          topic = p[:topic].to_s.strip
          next if topic.blank?

          { "topic" => topic.slice(0, 500), "angle" => p[:angle].to_s.strip.slice(0, 500).presence }.compact
        end.first(Ai::BlogAgent::MAX_POSTS)

        {
          "posts"          => posts,
          "status"         => %w[draft publish].include?(raw[:status].to_s) ? raw[:status].to_s : "draft",
          # Capa só se houver chave — o cliente não decide isso sozinho.
          "generate_cover" => ActiveModel::Type::Boolean.new.cast(raw[:generate_cover]).present? && openai_integration.present?,
          "category_ids"   => Array(raw[:category_ids]).map(&:to_i).reject(&:zero?).uniq.first(20),
          "tag_ids"        => Array(raw[:tag_ids]).map(&:to_i).reject(&:zero?).uniq.first(20),
          "notes"          => raw[:notes].to_s.strip.slice(0, 2_000).presence,
        }.compact
      end

      def ai_job_payload(job)
        {
          id:          job.id,
          status:      job.status,
          task_kind:   job.task_kind,
          cost_usd:    job.cost_usd_actual || job.cost_usd_estimated,
          error:       job.error,
          started_at:  job.started_at,
          finished_at: job.finished_at,
          result:      job.result,
        }
      end

      # Base64 do navegador pode vir como data URL. Rejeita o que passar do teto
      # antes de decodificar, pra não alocar memória à toa.
      def decode_base64(raw)
        payload = raw.to_s.sub(/\Adata:[^;]+;base64,/, "")
        return nil if payload.blank?
        return nil if payload.bytesize > (MAX_UPLOAD_BYTES * 4 / 3) + 1024

        decoded = Base64.decode64(payload)
        decoded.presence
      rescue ArgumentError
        nil
      end

      # --- registro de custo e auditoria ---

      def record_ai_job!(kind, ai_result)
        AiJob.create!(
          workspace_id:     current_workspace.id,
          task_kind:        kind,
          status:           "done",
          model:            ai_result.model.to_s,
          prompt_tokens:    ai_result.input_tokens,
          output_tokens:    ai_result.output_tokens,
          cost_usd_actual:  ai_result.cost_usd,
          payload:          {},
          finished_at:      Time.current
        )
      rescue StandardError => e
        Rails.logger.error("[BlogPosts] ai_job (#{kind}) falhou: #{e.class}: #{e.message}")
      end

      def record_image_job!(prompt, image)
        AiJob.create!(
          workspace_id:    current_workspace.id,
          task_kind:       "blog_cover",
          status:          "done",
          model:           Connectors::OpenAi::MODEL,
          prompt_tokens:   image[:usage]["input_tokens"],
          output_tokens:   image[:usage]["output_tokens"],
          cost_usd_actual: image[:cost_usd],
          payload:         { prompt: prompt.to_s.slice(0, 1000) },
          finished_at:     Time.current
        )
      rescue StandardError => e
        Rails.logger.error("[BlogPosts] ai_job (blog_cover) falhou: #{e.class}: #{e.message}")
      end

      def record_audit!(result)
        AuditLog.create!(
          workspace_id: current_workspace.id,
          user_id:      current_app_user.id,
          action:       "blog.post_#{result[:status]}",
          metadata:     { post_id: result[:id], url: result[:url], status: result[:status] },
          ip:           request.remote_ip,
          user_agent:   request.user_agent.to_s.first(512)
        )
      rescue StandardError => e
        # O post já existe no WordPress. Falhar aqui faria o usuário reenviar e
        # duplicar o post — loga e segue.
        Rails.logger.error("[BlogPosts] audit_log falhou: #{e.class}: #{e.message}")
      end

      # --- erros ---

      def render_blog_not_connected(e)
        render json: { error: "blog_not_connected", message: e.message }, status: :unprocessable_entity
      end

      def render_openai_missing(e)
        render json: { error: "openai_not_connected", message: e.message }, status: :unprocessable_entity
      end

      def render_blog_unreachable(e)
        Rails.logger.warn("[BlogPosts] conexão falhou: #{e.message}")
        render json: { error: "blog_unreachable", message: e.message }, status: :unprocessable_entity
      end

      def render_blog_failed(e)
        Rails.logger.error("[BlogPosts] publicação falhou: #{e.message}")
        render json: { error: "blog_publish_failed", message: e.message }, status: :unprocessable_entity
      end

      def render_openai_failed(e)
        Rails.logger.error("[BlogPosts] OpenAI falhou: #{e.message}")
        render json: { error: "cover_generation_failed", message: e.message }, status: :bad_gateway
      end
    end
  end
end
