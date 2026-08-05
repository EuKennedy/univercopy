# Agente conversacional que planeja lotes de posts pro blog.
#
# Não gera post nenhum — ele só CONVERSA até fechar um plano. A geração e a
# publicação acontecem no Blog::AgentRunJob, depois de confirmação explícita
# do usuário na tela. Essa separação é de propósito: publicar em blog ao vivo
# não pode depender do modelo interpretar um "sim" no meio de uma frase.
#
# Entrada: histórico de mensagens + o que existe de verdade no blog do
# workspace (categorias, tags, se há OpenAI configurada).
# Saída: { reply, plan, ready } — `ready` significa "plano completo, aguardando
# confirmação", nunca "pode publicar".
#
# Sem estado no servidor: o cliente devolve o histórico a cada turno. Um
# lote de posts é uma sessão curta; não vale uma tabela pra isso.

module Ai
  class BlogAgent
    MAX_TOKENS   = 2_000
    MAX_MESSAGES = 40      # teto de histórico por conversa
    MAX_CHARS    = 4_000   # teto por mensagem
    MAX_POSTS    = 10      # teto por lote — espelhado no job e no controller

    Result = Struct.new(:reply, :plan, :ready, :ai_result, keyword_init: true)

    LOCALE_LABEL = {
      "pt-BR" => "Português do Brasil",
      "en-US" => "Inglês (Estados Unidos)",
      "es-AR" => "Espanhol (Argentina)",
      "fr-FR" => "Francês",
    }.freeze

    def self.call(**kwargs)
      new(**kwargs).call
    end

    def initialize(workspace:, messages:, categories: [], tags: [], has_openai: false, model: :auto)
      @workspace  = workspace
      @messages   = sanitize(messages)
      @categories = Array(categories)
      @tags       = Array(tags)
      @has_openai = has_openai
      @model      = (model.presence || :auto).to_sym
    end

    def call
      raise ArgumentError, "conversa vazia" if @messages.empty?

      ai = Ai::AnthropicClient.call(
        prompt:      transcript,
        system:      system_prompt,
        model:       @model,
        task:        :generate_copy,
        max_tokens:  MAX_TOKENS,
        temperature: 0.4 # planejamento pede consistência, não criatividade
      )

      parsed = Ai::JsonExtractor.parse(ai.text)
      plan   = normalize_plan(parsed["plan"])

      Result.new(
        reply:     parsed["reply"].to_s.strip.presence || fallback_reply,
        plan:      plan,
        # Só é "ready" se o modelo disser E o plano realmente fechar. O modelo
        # às vezes se declara pronto com o plano pela metade.
        ready:     parsed["ready"] == true && plan_complete?(plan),
        ai_result: ai
      )
    end

    private

    def sanitize(messages)
      Array(messages)
        .last(MAX_MESSAGES)
        .filter_map do |m|
          role    = m["role"] || m[:role]
          content = (m["content"] || m[:content]).to_s.strip
          next if content.blank?
          next unless %w[user assistant].include?(role.to_s)

          { role: role.to_s, content: content.slice(0, MAX_CHARS) }
        end
    end

    # Transcrição em texto simples: o AnthropicClient do projeto recebe um
    # prompt único, não um array de turnos.
    def transcript
      lines = @messages.map do |m|
        speaker = m[:role] == "user" ? "USUÁRIO" : "VOCÊ"
        "#{speaker}: #{m[:content]}"
      end

      <<~TXT
        Conversa até aqui:

        #{lines.join("\n\n")}

        Responda ao último turno do USUÁRIO seguindo as regras do sistema.
        Devolva SOMENTE o objeto JSON.
      TXT
    end

    def system_prompt
      dna    = @workspace.active_brand_dna
      locale = LOCALE_LABEL[@workspace.default_locale.to_s] || LOCALE_LABEL["pt-BR"]

      <<~SYS
        Você é o agente de conteúdo do UniverCopy. Sua função é planejar um lote
        de posts para o blog WordPress da marca abaixo, conversando com o usuário
        até que o plano esteja completo. Fale em #{locale}.

        #{brand_block(dna)}

        CATEGORIAS QUE EXISTEM NO BLOG (use os IDs, não invente):
        #{term_list(@categories)}

        TAGS QUE EXISTEM NO BLOG (use os IDs, não invente):
        #{term_list(@tags)}

        GERAÇÃO DE CAPA: #{@has_openai ? 'disponível' : 'INDISPONÍVEL (não há chave da OpenAI cadastrada — nunca prometa capa)'}

        COMO CONDUZIR:
        - Faça UMA pergunta por vez. Nunca despeje um questionário.
        - Descubra, nesta ordem de prioridade: os temas dos posts; quantos posts;
          se é para salvar como rascunho ou publicar direto; se quer capa gerada;
          em quais categorias e tags entram.
        - Se o usuário já deu a informação, NÃO pergunte de novo.
        - Se ele der vários temas, cada tema vira um post — confirme a contagem.
        - Máximo de #{MAX_POSTS} posts por lote. Se pedirem mais, explique o teto
          e proponha dividir em lotes.
        - Padrão é RASCUNHO. Só marque "publish" se o usuário pedir explicitamente
          para publicar direto. Na dúvida, pergunte.
        - Quando tiver tudo, resuma o plano em texto curto e pergunte se pode gerar.
        - Não invente dado, número ou promessa que a marca não sustenta.

        FORMATO DA RESPOSTA — devolva SOMENTE este JSON, sem cercas de markdown:
        {
          "reply": "sua fala para o usuário, em #{locale}",
          "ready": false,
          "plan": {
            "posts": [{ "topic": "tema do post", "angle": "ângulo ou foco (opcional)" }],
            "status": "draft",
            "generate_cover": false,
            "category_ids": [],
            "tag_ids": [],
            "notes": "observações que devem guiar a escrita (opcional)"
          }
        }

        Preencha `plan` com o que já souber a cada turno, mesmo incompleto.
        Só coloque "ready": true quando `posts` tiver ao menos um item E você já
        tiver resumido o plano e perguntado se pode gerar. "ready" significa
        "plano fechado, aguardando confirmação" — quem publica é o usuário
        clicando no botão, não você.
      SYS
    end

    def brand_block(dna)
      return "MARCA: (DNA ainda não preenchido — escreva de forma neutra e pergunte o que precisar)" if dna.blank?

      lines = ["MARCA:"]
      lines << "- Nome: #{dna.marca}"                     if dna.marca.present?
      lines << "- Posicionamento: #{dna.posicionamento}"  if dna.posicionamento.present?
      lines << "- Tom de voz: #{dna.tom}"                 if dna.tom.present?
      lines << "- Público: #{dna.publico}"                if dna.publico.present?
      lines << "- Evitar: #{list(dna.evitar)}"            if list(dna.evitar).present?
      lines.join("\n")
    end

    def term_list(terms)
      return "(nenhuma)" if terms.blank?

      terms.first(60).map { |t| "- #{t[:id] || t['id']}: #{t[:name] || t['name']}" }.join("\n")
    end

    def list(value)
      Array(value).map { |v| v.is_a?(Hash) ? v.values.join(" — ") : v.to_s }
                  .map(&:strip).reject(&:blank?).join("; ")
    end

    def fallback_reply
      "Me conta um pouco mais sobre o que você quer publicar."
    end

    # Blinda o plano que veio do modelo: tipos, tetos e IDs que existem mesmo.
    def normalize_plan(raw)
      raw = {} unless raw.is_a?(Hash)

      valid_categories = @categories.map { |t| (t[:id] || t["id"]).to_i }.to_set
      valid_tags       = @tags.map { |t| (t[:id] || t["id"]).to_i }.to_set

      posts = Array(raw["posts"]).filter_map do |p|
        next unless p.is_a?(Hash)

        topic = p["topic"].to_s.strip
        next if topic.blank?

        { "topic" => topic.slice(0, 500), "angle" => p["angle"].to_s.strip.slice(0, 500).presence }.compact
      end.first(MAX_POSTS)

      {
        "posts"          => posts,
        "status"         => %w[draft publish].include?(raw["status"].to_s) ? raw["status"].to_s : "draft",
        # Nunca prometer capa sem chave configurada.
        "generate_cover" => raw["generate_cover"] == true && @has_openai,
        "category_ids"   => Array(raw["category_ids"]).map(&:to_i).select { |id| valid_categories.include?(id) }.uniq,
        "tag_ids"        => Array(raw["tag_ids"]).map(&:to_i).select { |id| valid_tags.include?(id) }.uniq,
        "notes"          => raw["notes"].to_s.strip.slice(0, 2_000).presence,
      }.compact
    end

    def plan_complete?(plan)
      plan["posts"].present?
    end
  end
end
