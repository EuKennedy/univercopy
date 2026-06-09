# Seed das bibliotecas globais UniverCopy (44 estilos / 17 frameworks /
# 7 categorias / 59 piece_types). Idempotente — re-rodar é seguro.
#
# Fonte: portado 1:1 do protótipo legacy (db/02_seed.sql). Cada item é
# instrumento curado que altera a saída do gerador — não mexer sem critério.

# ---------------------------------------------------------------------
# ESTILOS (44 copywriters/escolas)
# ---------------------------------------------------------------------
ActiveRecord::Base.connection.execute(<<~SQL)
  INSERT INTO styles(key,name,era,grp,description,principles,when_to_use,created_at,updated_at) VALUES
  ('schwartz','Eugene Schwartz','1950-80','dr','Mestre dos estágios de consciência e sofisticação do mercado. Não cria desejo — canaliza o desejo de massa que já existe.','["Estágios de consciência do prospect","Sofisticação do mercado","Canalizar o desejo, não criar","Headline entra na conversa da mente"]'::jsonb,'Definir o ângulo e a headline conforme o momento do público.',now(),now()),
  ('halbert','Gary Halbert','1970-2000','dr','O mais lido dos copywriters de resposta direta. Direto, conversacional e movido a história. Acreditava no "mercado faminto".','["Starving crowd > copy","Tom de pessoa para pessoa","Histórias que prendem","A-pile / B-pile"]'::jsonb,'Cartas de venda e e-mails que soam pessoais.',now(),now()),
  ('hopkins','Claude Hopkins','1900-30','dr','Pioneiro da "publicidade científica". Reason-why, prova e especificidade. Testava tudo.','["Reason-why copy","Especificidade vence generalidade","Demonstre o mecanismo","Teste e meça"]'::jsonb,'Copy que precisa provar e demonstrar.',now(),now()),
  ('kennedy','Dan Kennedy','1980-2020','dr','Resposta direta sem rodeios. Oferta irresistível, urgência, garantia e CTA forte.','["Oferta irresistível","Urgência e escassez","Garantia que remove o risco","Message-Market-Media"]'::jsonb,'Ofertas, promoções e fechamento de infoproduto.',now(),now()),
  ('sugarman','Joe Sugarman','1970-2000','dr','Criador do conceito de "slippery slide": cada frase existe para fazer você ler a próxima.','["Slippery slide","Primeira frase curtíssima","Gatilhos psicológicos","Fluxo de leitura contínuo"]'::jsonb,'Long-form que precisa de fluidez e engajamento.',now(),now()),
  ('collier','Robert Collier','1920-50','dr','Mestre das cartas de venda. Ensinou a "entrar na conversa que já existe na mente do prospect".','["Entrar na conversa interna","Conexão contextual","Emoção antes da razão","Carta como diálogo"]'::jsonb,'E-mail/carta com forte conexão de contexto.',now(),now()),
  ('caples','John Caples','1920-90','dr','Autoridade em headlines testadas. Apelo a interesse próprio, notícia e curiosidade.','["Headlines testadas","Self-interest em primeiro lugar","Notícia e curiosidade","Manchete que promete recompensa"]'::jsonb,'Criar e testar manchetes.',now(),now()),
  ('bencivenga','Gary Bencivenga','1970-2010','dr','Considerado um dos maiores copywriters vivos. Prega que prova vence persuasão — o segredo é credibilidade.','["Prova acima de promessa","Credibilidade vence ceticismo","Benefício + evidência","Teste rigoroso"]'::jsonb,'Converter público cético com provas.',now(),now()),
  ('carlton','John Carlton','1980-2020','dr','O "copywriter mais implacável". Famoso pelo anúncio do golfista de uma perna só — gancho + história que vende.','["Gancho irresistível","História que vende","Linguagem de rua","Oferta clara"]'::jsonb,'Ganchos fortes e cartas de venda diretas.',now(),now()),
  ('makepeace','Clayton Makepeace','1980-2010','dr','Um dos maiores nomes de copy financeira e de saúde. Copy movida a emoção e grandes promessas com prova.','["Emoção em primeiro lugar","Grande promessa","Prova robusta","Ritmo de leitura"]'::jsonb,'Ofertas de alta conversão em saúde e finanças.',now(),now()),
  ('schwab','Victor Schwab','1930-60','dr','Autor de "How to Write a Good Advertisement". Sintetizou os 5 fundamentos do anúncio que vende.','["Atrair atenção","Mostrar a vantagem","Provar","Persuadir","Pedir a ação"]'::jsonb,'Estrutura clássica e testada de anúncio.',now(),now()),
  ('sackheim','Maxwell Sackheim','1920-60','dr','Criador do Book-of-the-Month Club e do clássico "Do You Make These Mistakes in English?". Mestre da curiosidade.','["Headline de curiosidade","Oferta de continuidade","Persistência (regra dos 7)","Resposta mensurável"]'::jsonb,'Headlines de curiosidade e ofertas recorrentes.',now(),now()),
  ('jekennedy','John E. Kennedy','1900-10','dr','Definiu a publicidade como "salesmanship in print" (um vendedor no papel) — base de toda a resposta direta.','["Anúncio = vendedor","Razão para comprar (reason-why)","Foco na venda, não no entretenimento"]'::jsonb,'Fundamento: tratar a copy como um vendedor.',now(),now()),
  ('stone','Bob Stone','1960-90','dr','Lenda do marketing direto. Criou a fórmula de carta em 7 passos, começando pelo maior benefício.','["Liderar com o maior benefício","Expandir o benefício","Provar","Dizer o que se perde","Pedir ação"]'::jsonb,'Mala direta e estrutura de carta de vendas.',now(),now()),
  ('bird','Drayton Bird','1960-2020','dr','Maior nome do marketing direto britânico, discípulo de Ogilvy. Clareza obsessiva e foco em vender.','["Clareza acima de tudo","Relevância para o leitor","Testar e medir","Vender, não impressionar"]'::jsonb,'Marketing direto claro e persuasivo.',now(),now()),
  ('lasker','Albert Lasker','1900-40','dr','Pai da publicidade moderna (Lord & Thomas). Popularizou o "reason-why" como motor da venda.','["Reason-why","Salesmanship in print","Estratégia antes da arte"]'::jsonb,'Fundamentar a venda por argumento.',now(),now()),
  ('ogilvy','David Ogilvy','1950-90','brand','O "pai da publicidade". Pesquisa, fatos e elegância. Headlines fortes e copy longa que respeita o leitor.','["Pesquisa antes de escrever","O consumidor não é idiota","Headline carrega 80% do peso","Fatos e benefícios concretos"]'::jsonb,'Marca premium e anúncios baseados em benefícios.',now(),now()),
  ('bernbach','Bill Bernbach','1950-80','brand','Pai da revolução criativa (DDB). Provou que criatividade vende — "Think Small" (VW) e "We try harder" (Avis).','["A grande ideia","Criatividade a serviço da venda","Respeito à inteligência do público","Execução impecável"]'::jsonb,'Conceito criativo disruptivo de marca.',now(),now()),
  ('burnett','Leo Burnett','1930-70','brand','Criou ícones eternos: Marlboro Man, Tigre Tony, Gigante Verde. Buscava o "drama inerente" do produto.','["Drama inerente do produto","Personagens-ícone","Emoção arquetípica","Simplicidade"]'::jsonb,'Construir ícones e símbolos de marca.',now(),now()),
  ('reeves','Rosser Reeves','1940-60','brand','Criador da USP (Proposta Única de Venda). "Melts in your mouth, not in your hand" (M&M''s).','["Uma proposta única","Benefício que o concorrente não oferece","Repetição / martelo","Foco na conversão"]'::jsonb,'Achar e martelar a proposta única.',now(),now()),
  ('rubicam','Raymond Rubicam','1920-40','brand','Cofundador da Young & Rubicam. Uniu impacto criativo a pesquisa e qualidade.','["Impacto (resista ao familiar)","Pesquisa + criação","Qualidade e originalidade"]'::jsonb,'Marca de impacto sustentada por pesquisa.',now(),now()),
  ('wells','Mary Wells Lawrence','1960-90','brand','Primeira mulher CEO de empresa na bolsa de NY. Campanhas ousadas: Braniff, Alka-Seltzer, "I love NY".','["Ousadia memorável","Experiência de marca","Humor e charme","Coragem criativa"]'::jsonb,'Campanhas ousadas e inesquecíveis.',now(),now()),
  ('lois','George Lois','1960-2000','brand','Mestre da "big idea" provocadora. Capas da Esquire e o icônico "I want my MTV".','["Big idea provocadora","Choque cultural","Coragem","Ideia antes da execução"]'::jsonb,'Ideia ousada que vira conversa cultural.',now(),now()),
  ('abbott','David Abbott','1970-2000','brand','O maior redator britânico de long copy. Inteligência e elegância (The Economist, Volvo).','["Long copy que prende","Inteligência e elegância","Verdade sobre o produto","Respeito ao leitor"]'::jsonb,'Long copy elegante e inteligente.',now(),now()),
  ('hegarty','John Hegarty','1980-2010','brand','Cofundador da BBH. "When the world zigs, zag" — diferenciação como religião (Levi''s, Audi).','["Diferenciação radical","A ideia em uma frase","Marca com atitude","Menos é mais"]'::jsonb,'Posicionar a marca contra a manada.',now(),now()),
  ('wieden','Dan Wieden','1980-2010','brand','Cofundador da Wieden+Kennedy. Criou o "Just Do It" da Nike — marca como atitude e cultura.','["Marca-atitude","Voz cultural autêntica","Coragem para arriscar","Verdade emocional"]'::jsonb,'Manifestos e voz de marca.',now(),now()),
  ('clow','Lee Clow','1980-2010','brand','Mente por trás do "1984" e do "Think Different" da Apple. Manifestos que definem marcas.','["Manifesto de marca","Simplicidade icônica","Emoção + design","Pensar diferente"]'::jsonb,'Manifestos e grandes lançamentos.',now(),now()),
  ('gossage','Howard Gossage','1950-60','brand','O "Sócrates de São Francisco". Anúncios que dialogam e respeitam o leitor, com humor e interação.','["Conversa, não monólogo","Respeito e humor","Engajar, não interromper"]'::jsonb,'Anúncios que dialogam e engajam.',now(),now()),
  ('resor','Helen L. Resor','1910-40','brand','Pioneira entre as redatoras (JWT). Criou o apelo emocional/sensorial: "A skin you love to touch".','["Apelo emocional e sensorial","Aspiração","Voz autêntica"]'::jsonb,'Apelo emocional e aspiracional.',now(),now()),
  ('wiebe','Joanna Wiebe','2010-hoje','modern','Fundadora da Copyhackers e mãe do "conversion copywriting". Copy nasce da voz do cliente.','["Voz do cliente (VoC)","Copy baseada em dados","Clareza > esperteza","Teste de conversão"]'::jsonb,'Copy de conversão digital baseada em pesquisa.',now(),now()),
  ('georgi','Stefan Georgi','2015-hoje','modern','Um dos copywriters modernos que mais faturam. Criador do método RMBC para VSLs e cartas.','["Método RMBC","Mecanismo único","Lead forte","Prova e história"]'::jsonb,'VSLs e cartas de venda modernas.',now(),now()),
  ('benson','Jon Benson','2000-hoje','modern','Criador da VSL (Video Sales Letter). Estruturou o roteiro de vídeo que vende.','["Roteiro de VSL","Loop aberto","Mecanismo único","CTA repetido"]'::jsonb,'Roteiros de vídeo de vendas.',now(),now()),
  ('brunson','Russell Brunson','2010-hoje','modern','Fundador do ClickFunnels. Mestre em funis e na "Epiphany Bridge" — vender pela história de origem.','["Epiphany Bridge","Funil de valor","História de origem","Oferta escada"]'::jsonb,'Funis e narrativa de origem.',now(),now()),
  ('redwards','Ray Edwards','2000-hoje','modern','Criador do framework PASTOR — uma das estruturas de copy mais usadas hoje.','["PASTOR","Problema → Oferta → Resposta","História e transformação","Clareza ética"]'::jsonb,'Estruturar copy completa (PASTOR).',now(),now()),
  ('kern','Frank Kern','2000-hoje','modern','Lenda do marketing digital. "Results in Advance" — entregar valor antes de vender.','["Valor antecipado","Storytelling pessoal","Naturalidade","Relacionamento"]'::jsonb,'Lançamentos e copy de marketing digital.',now(),now()),
  ('riestrout','Al Ries & Jack Trout','1970-2000','strategy','Autores de "Posicionamento". A batalha não é no produto, é na mente — seja dono de uma palavra.','["Posicionamento","Ser dono de uma palavra","Ser o primeiro (ou criar categoria)","Foco"]'::jsonb,'Definir o posicionamento na mente do cliente.',now(),now()),
  ('cialdini','Robert Cialdini','1980-hoje','strategy','Autor de "As Armas da Persuasão". Sistematizou os princípios que levam ao "sim".','["Reciprocidade","Escassez","Autoridade","Prova social","Compromisso e coerência","Afinidade"]'::jsonb,'Aplicar gatilhos de persuasão éticos.',now(),now()),
  ('godin','Seth Godin','2000-hoje','strategy','Autor de "Vaca Roxa" e do marketing de permissão. Seja notável ou seja invisível.','["Seja notável (remarkable)","Marketing de permissão","Fale para a tribo","Conte uma história verdadeira"]'::jsonb,'Tornar a ideia/produto notável.',now(),now()),
  ('sharp','Byron Sharp','2010-hoje','strategy','Autor de "How Brands Grow". Crescimento por disponibilidade mental e física, baseado em evidência.','["Alcance amplo","Disponibilidade mental e física","Ativos distintivos","Penetração > lealdade"]'::jsonb,'Crescimento de marca baseado em evidência.',now(),now()),
  ('olivetto','Washington Olivetto','1980-2010','br','Maior nome da propaganda brasileira (W/Brasil). Emoção e brasilidade: "Primeiro Sutiã" (Valisère) e o Garoto Bombril.','["Emoção brasileira","Conceito memorável","Humor e afeto","Storytelling de marca"]'::jsonb,'Campanhas emocionais com cara de Brasil.',now(),now()),
  ('nizan','Nizan Guanaes','1980-2010','br','Força criativa do Grupo ABC / DM9. Campanhas de grande impacto e ambição.','["Grande impacto","Ambição criativa","Marca com causa","Energia"]'::jsonb,'Campanhas de marca de alto impacto.',now(),now()),
  ('jribeiro','Júlio Ribeiro','1970-2000','br','Fundador da Talent e referência em planejamento e posicionamento no Brasil ("Fazer Acontecer").','["Planejamento estratégico","Posicionamento","Foco no consumidor","Disciplina"]'::jsonb,'Estratégia e posicionamento à brasileira.',now(),now()),
  ('duailibi','Roberto Duailibi','1960-2000','br','Um dos pais da propaganda moderna brasileira (o "D" da DPZ). Criação clássica e elegante.','["Criação clássica","Conceito + estética","Marca institucional","Bom gosto"]'::jsonb,'Criação clássica e institucional.',now(),now()),
  ('serpa','Marcello Serpa','1990-2010','br','Diretor de criação da AlmapBBDO, multipremiado em Cannes. Conceito visual forte com copy enxuta.','["Conceito visual","Menos texto, mais ideia","Impacto gráfico","Elegância"]'::jsonb,'Conceito visual potente com copy mínima.',now(),now())
  ON CONFLICT (key) DO NOTHING;
SQL

# ---------------------------------------------------------------------
# FRAMEWORKS (17 estruturas de copy)
# ---------------------------------------------------------------------
ActiveRecord::Base.connection.execute(<<~SQL)
  INSERT INTO frameworks(key,name,structure,created_at,updated_at) VALUES
  ('AIDA','AIDA','Atenção → Interesse → Desejo → Ação',now(),now()),
  ('AIDCA (AIDA + Convicção)','AIDCA (AIDA + Convicção)','Atenção → Interesse → Desejo → Convicção → Ação',now(),now()),
  ('PAS (Problema-Agitação-Solução)','PAS (Problema-Agitação-Solução)','Problema → Agitação → Solução',now(),now()),
  ('PASTOR','PASTOR','Problema → Amplificação → História/Solução → Transformação (depoimentos) → Oferta → Resposta (CTA)',now(),now()),
  ('BAB (Antes-Depois-Ponte)','BAB (Antes-Depois-Ponte)','Estado Antes → Estado Depois → Ponte (o produto)',now(),now()),
  ('4 Ps','4 Ps','Promessa → Imagem (Picture) → Prova → Empurrão (Push)',now(),now()),
  ('PPPP (Picture-Promise-Prove-Push)','PPPP (Picture-Promise-Prove-Push)','Imagem → Promessa → Prova → Empurrão',now(),now()),
  ('FAB (Feature-Advantage-Benefit)','FAB (Feature-Advantage-Benefit)','Característica → Vantagem → Benefício',now(),now()),
  ('Star-Story-Solution','Star-Story-Solution','Estrela (protagonista) → História → Solução',now(),now()),
  ('QUEST','QUEST','Qualificar → Entender → Educar → Estimular → Transição (CTA)',now(),now()),
  ('ACCA','ACCA','Consciência → Compreensão → Convicção → Ação',now(),now()),
  ('4 U''s (headline)','4 U''s (headline)','Útil → Urgente → Único → Ultraespecífico',now(),now()),
  ('USP (Proposta Única de Venda)','USP (Proposta Única de Venda)','Proposta única → Benefício exclusivo → Martelo (repetição)',now(),now()),
  ('Slippery Slide (Sugarman)','Slippery Slide (Sugarman)','Primeira frase curtíssima → cada frase puxa a próxima → fechamento',now(),now()),
  ('Epiphany Bridge (Brunson)','Epiphany Bridge (Brunson)','História de origem → epifania → nova oportunidade → oferta',now(),now()),
  ('5 Estágios de Consciência (Schwartz)','5 Estágios de Consciência (Schwartz)','Inconsciente → consciente do problema → da solução → do produto → totalmente consciente',now(),now()),
  ('Fórmula de 7 passos (Bob Stone)','Fórmula de 7 passos (Bob Stone)','Maior benefício → expandir → o que recebe → provar → o que perde se não agir → resumir → pedir ação',now(),now())
  ON CONFLICT (key) DO NOTHING;
SQL

# ---------------------------------------------------------------------
# CATEGORIAS GLOBAIS (7)
# Icon como nome do ícone Lucide (sem emoji); UI renderiza via <Icon name=...>.
# ---------------------------------------------------------------------
ActiveRecord::Base.connection.execute(<<~SQL)
  INSERT INTO categories(workspace_id,key,name,icon,color,created_at,updated_at) VALUES
  (NULL,'ecom','E-commerce','shopping-cart','#6366f1',now(),now()),
  (NULL,'pv','Página de Vendas','file-text','#ec4899',now(),now()),
  (NULL,'ads','Anúncios','megaphone','#f59e0b',now(),now()),
  (NULL,'email','E-mail','mail','#10b981',now(),now()),
  (NULL,'social','Redes Sociais','smartphone','#8b5cf6',now(),now()),
  (NULL,'marca','Institucional / Marca','landmark','#14b8a6',now(),now()),
  (NULL,'seo','SEO / Blog','search','#0ea5e9',now(),now()),
  (NULL,'whatsapp','WhatsApp','message-circle','#22c55e',now(),now()),
  (NULL,'sms','SMS','smartphone','#06b6d4',now(),now())
  ON CONFLICT (workspace_id, key) DO NOTHING;
SQL

# ---------------------------------------------------------------------
# PIECE TYPES (59 — catálogo de peças, com style/framework default)
# ---------------------------------------------------------------------
ActiveRecord::Base.connection.execute(<<~SQL)
  INSERT INTO piece_types(key,category_key,name,description,structure,default_framework,default_style,length_hint,created_at,updated_at) VALUES
  ('ecom:desc-loja','ecom','Descrição do e-commerce / Sobre a loja','Texto institucional da home/sobre que apresenta a loja.','História → missão → diferenciais → convite','Star-Story-Solution','olivetto','120-220 palavras',now(),now()),
  ('ecom:desc-categoria','ecom','Descrição de categoria','Texto da página de categoria, com apelo e SEO.','Intro da categoria → variedade/benefícios → SEO natural → CTA navegar','AIDA','ogilvy','60-120 palavras',now(),now()),
  ('ecom:desc-prod-curta','ecom','Descrição de produto (curta)','Descrição objetiva para a vitrine do produto.','Gancho de benefício → 2-3 características → fecho','FAB (Feature-Advantage-Benefit)','ogilvy','40-80 palavras',now(),now()),
  ('ecom:desc-prod-longa','ecom','Descrição de produto (detalhada)','Descrição completa, persuasiva e com prova.','Abertura sensorial → benefícios → especificações (reason-why) → prova → CTA','FAB (Feature-Advantage-Benefit)','hopkins','120-250 palavras',now(),now()),
  ('ecom:sobre-produto','ecom','Sobre o produto (storytelling)','Narrativa que conecta o produto à vida do cliente.','História/origem → problema que resolve → uso no dia a dia','Star-Story-Solution','halbert','80-150 palavras',now(),now()),
  ('ecom:bullets','ecom','Bullets de benefícios','Lista de bullets persuasivos (fascinations).','Cada bullet = benefício + curiosidade','4 U''s (headline)','sugarman','4-7 bullets',now(),now()),
  ('ecom:titulo-prod','ecom','Título de produto (otimizado)','Título de vitrine claro e com keyword.','Produto + atributo único + benefício/keyword','USP (Proposta Única de Venda)','reeves','até 60 caracteres',now(),now()),
  ('ecom:seo-meta','ecom','Título SEO + meta description','Tags para ranquear e atrair o clique.','Keyword no início → benefício → CTA','USP (Proposta Única de Venda)','ogilvy','título ~60c / meta ~155c',now(),now()),
  ('ecom:ficha','ecom','Ficha técnica (texto)','Especificações traduzidas em vantagens.','Especificação + a vantagem de cada uma','FAB (Feature-Advantage-Benefit)','hopkins','lista',now(),now()),
  ('ecom:faq-prod','ecom','FAQ do produto','Perguntas frequentes que tratam objeções.','Pergunta real → resposta clara que remove objeção','ACCA','bird','5-8 perguntas',now(),now()),
  ('ecom:selos','ecom','Garantia, frete e selos','Texto que remove o risco da compra.','Risco removido → garantia → frete/entrega','PAS (Problema-Agitação-Solução)','kennedy','curto',now(),now()),
  ('ecom:banner','ecom','Headline de coleção / banner','Chamada curta para campanha ou coleção.','Gancho sazonal/benefício + CTA','4 U''s (headline)','caples','1-2 linhas',now(),now()),
  ('ecom:prova','ecom','Prova social / destaque de avaliações','Texto que transforma avaliações em prova.','Número/depoimento → credibilidade','ACCA','bencivenga','curto',now(),now()),
  ('pv:headline','pv','Headline + sub-headline','A promessa que para o scroll.','Grande benefício → sub que esclarece e prova','4 U''s (headline)','caples','1-3 linhas',now(),now()),
  ('pv:lead','pv','Lead / abertura (gancho)','Primeiros parágrafos que prendem o leitor.','Gancho → tensão → promessa de leitura','Slippery Slide (Sugarman)','sugarman','80-150 palavras',now(),now()),
  ('pv:promessa','pv','Promessa / grande ideia','A grande ideia central da oferta.','Desejo do mercado → mecanismo → promessa única','USP (Proposta Única de Venda)','schwartz','curto',now(),now()),
  ('pv:problema','pv','Problema + agitação','Mostra a dor e amplifica o custo de não agir.','Problema → agitação → vislumbre da saída','PAS (Problema-Agitação-Solução)','kennedy','120-200 palavras',now(),now()),
  ('pv:solucao','pv','Solução / mecanismo único','Apresenta o produto como a ponte e por que funciona.','Virada → mecanismo único → como funciona','PASTOR','georgi','120-220 palavras',now(),now()),
  ('pv:beneficios','pv','Blocos de benefícios','Os ganhos concretos, em blocos.','Característica → vantagem → benefício, por bloco','FAB (Feature-Advantage-Benefit)','ogilvy','3-6 blocos',now(),now()),
  ('pv:depoimentos','pv','Prova social / depoimentos','Texto de transição e enquadramento dos depoimentos.','Resultado + identificação + credibilidade','ACCA','bencivenga','curto',now(),now()),
  ('pv:objecoes','pv','Quebra de objeções','Responde os "mas..." que travam a compra.','Objeção → reformulação → prova','ACCA','bird','lista',now(),now()),
  ('pv:oferta','pv','Oferta / stack de valor','Empilha o valor e ancora o preço.','O que recebe → valor de cada item → preço ancorado','PASTOR','kennedy','médio',now(),now()),
  ('pv:garantia','pv','Garantia','Remove o risco e o inverte quando possível.','Promessa → prazo → reversão de risco','PAS (Problema-Agitação-Solução)','kennedy','curto',now(),now()),
  ('pv:cta','pv','CTA / botões','Chamadas para ação claras e fortes.','Ação + benefício imediato','AIDCA (AIDA + Convicção)','kennedy','várias variações',now(),now()),
  ('pv:urgencia','pv','Urgência / escassez','Motivo legítimo para agir agora.','Prazo/limite → consequência → ação','AIDCA (AIDA + Convicção)','kennedy','curto',now(),now()),
  ('pv:faq-oferta','pv','FAQ da oferta','Perguntas que destravam a decisão.','Pergunta → resposta que reforça a oferta','ACCA','bird','5-8 perguntas',now(),now()),
  ('pv:vsl','pv','Roteiro de VSL','Roteiro de vídeo de vendas.','História de origem → epifania → mecanismo → oferta → CTA','Epiphany Bridge (Brunson)','benson','longo',now(),now()),
  ('pv:ps','pv','P.S. (pós-escrito)','Reforço final com a essência da oferta.','Resumo do benefício + urgência + CTA','PAS (Problema-Agitação-Solução)','halbert','curto',now(),now()),
  ('ads:meta-primary','ads','Anúncio Meta (texto principal)','O corpo do anúncio para Facebook/Instagram.','Gancho → interesse → desejo → CTA','AIDA','halbert','2-5 linhas',now(),now()),
  ('ads:meta-headline','ads','Headline + descrição (Meta)','Título e descrição abaixo do criativo.','Benefício único + CTA','4 U''s (headline)','caples','curto',now(),now()),
  ('ads:google-search','ads','Google Search (títulos + descrições)','Anúncios de rede de pesquisa.','Keyword + USP nos títulos → benefício + CTA nas descrições','USP (Proposta Única de Venda)','reeves','títulos 30c / descr. 90c',now(),now()),
  ('ads:video-ad','ads','Roteiro de anúncio em vídeo','Script de vídeo curto para ads.','Hook (3s) → problema/benefício → prova → CTA','AIDA','wieden','15-45s',now(),now()),
  ('ads:variacoes','ads','Variações de criativo (copy curta)','Múltiplas variações para teste A/B.','Mesma oferta, ângulos diferentes','4 U''s (headline)','lois','3-6 variações',now(),now()),
  ('email:assunto','email','Linha de assunto (variações)','Assuntos que aumentam a taxa de abertura.','Curiosidade / benefício / urgência (ângulos variados)','4 U''s (headline)','sackheim','várias variações',now(),now()),
  ('email:preheader','email','Preheader','Complemento do assunto na caixa de entrada.','Reforça/complementa o assunto','4 U''s (headline)','caples','1 linha',now(),now()),
  ('email:boas-vindas','email','E-mail de boas-vindas','Primeiro contato após o cadastro.','Acolhimento → o que esperar → próximo passo','BAB (Antes-Depois-Ponte)','collier','curto',now(),now()),
  ('email:carrinho','email','Carrinho abandonado','Recupera quem não finalizou a compra.','Lembrete amigável → remover atrito → CTA','PAS (Problema-Agitação-Solução)','collier','curto',now(),now()),
  ('email:oferta-email','email','E-mail de oferta / promoção','E-mail de campanha promocional.','Gancho → oferta → prova → CTA + prazo','AIDA','kennedy','médio',now(),now()),
  ('email:nutricao','email','Sequência de nutrição (passo)','E-mail de relacionamento e educação.','História/insight → valor → ponte para a oferta','Star-Story-Solution','kern','médio',now(),now()),
  ('email:newsletter','email','Newsletter','Conteúdo recorrente que engaja a base.','Gancho → conteúdo útil → 1 CTA','AIDA','godin','médio',now(),now()),
  ('email:pos-compra','email','Pós-compra / recompra','Encanta e estimula nova compra.','Agradecer → uso/onboarding → próxima oferta','BAB (Antes-Depois-Ponte)','collier','curto',now(),now()),
  ('social:legenda','social','Legenda de post (feed)','Legenda que engaja e converte no feed.','Gancho → desenvolvimento → CTA','AIDA','godin','80-150 palavras',now(),now()),
  ('social:carrossel','social','Roteiro de carrossel','Sequência de cards que prende até o fim.','Card 1 gancho → cards de valor → card CTA','Slippery Slide (Sugarman)','sugarman','5-10 cards',now(),now()),
  ('social:reels','social','Roteiro de Reels / Stories','Script curto para vídeo vertical.','Hook (3s) → conteúdo → CTA','AIDA','wieden','15-45s',now(),now()),
  ('social:bio','social','Bio do perfil','Bio que posiciona e converte.','Quem ajuda → como → CTA/link','USP (Proposta Única de Venda)','godin','curto',now(),now()),
  ('social:headline-criativo','social','Headline de criativo','Texto sobre a arte do post/anúncio.','Gancho visual + benefício','4 U''s (headline)','lois','1-2 linhas',now(),now()),
  ('marca:sobre-nos','marca','Sobre nós / quem somos','A página institucional da marca.','Origem → propósito → diferenciais → convite','Star-Story-Solution','olivetto','150-300 palavras',now(),now()),
  ('marca:mvv','marca','Missão, visão e valores','Os pilares da marca em texto.','Missão → visão → valores (1 frase cada)','FAB (Feature-Advantage-Benefit)','jribeiro','curto',now(),now()),
  ('marca:tagline','marca','Slogan / tagline','A assinatura da marca em poucas palavras.','Essência + diferencial em 3-7 palavras','USP (Proposta Única de Venda)','bernbach','várias opções',now(),now()),
  ('marca:manifesto','marca','Manifesto de marca','A declaração de crença da marca.','No que acreditamos → contra o quê → convite','AIDA','clow','médio',now(),now()),
  ('marca:historia','marca','História da marca','A narrativa de origem da marca.','Começo → desafio → virada → hoje','Star-Story-Solution','halbert','médio',now(),now()),
  ('marca:bio-marca','marca','Bio / apresentação curta','Apresentação para mídia e parcerias.','Quem somos → o que fazemos → prova','USP (Proposta Única de Venda)','godin','curto',now(),now()),
  ('seo:titulo-blog','seo','Título de artigo (SEO)','Título que ranqueia e atrai o clique.','Keyword + promessa + número/ângulo','4 U''s (headline)','caples','até 60 caracteres',now(),now()),
  ('seo:meta-blog','seo','Meta description','Resumo que ganha o clique na busca.','Promessa + keyword + CTA','USP (Proposta Única de Venda)','ogilvy','~155 caracteres',now(),now()),
  ('seo:intro-blog','seo','Introdução de artigo','Abertura que prende e promete valor.','Gancho → problema → o que o leitor vai ganhar','AIDA','sugarman','80-120 palavras',now(),now()),
  ('seo:outline','seo','Pauta / estrutura do artigo','O esqueleto de tópicos (H2/H3).','Tópicos por intenção de busca + perguntas','AIDA','wiebe','lista',now(),now()),
  ('seo:artigo','seo','Artigo otimizado (corpo)','Conteúdo longo, útil e ranqueável.','Intro → seções (H2) → conclusão → CTA','AIDA','ogilvy','longo',now(),now()),
  ('seo:cta-blog','seo','CTA de conteúdo (lead magnet)','Conversão dentro do artigo.','Benefício do material → CTA','AIDCA (AIDA + Convicção)','kern','curto',now(),now()),
  ('seo:faq-seo','seo','FAQ (rich snippet)','Perguntas para featured snippets.','Pergunta → resposta direta e concisa','ACCA','bird','5-8 perguntas',now(),now()),
  ('whatsapp:promo','whatsapp','Mensagem promocional','Disparo de oferta no WhatsApp.','Abertura pessoal → oferta → CTA + link','AIDA','kennedy','2-4 linhas',now(),now()),
  ('whatsapp:sequencia','whatsapp','Sequência de mensagens (passo)','Passo de uma cadência de WhatsApp.','Continuidade do contexto → valor/lembrete → CTA','PAS (Problema-Agitação-Solução)','collier','2-4 linhas',now(),now()),
  ('whatsapp:carrinho','whatsapp','Recuperação de carrinho','Recupera quem não finalizou no WhatsApp.','Lembrete amigável → remover atrito → CTA + link','PAS (Problema-Agitação-Solução)','collier','2-3 linhas',now(),now()),
  ('whatsapp:boas-vindas','whatsapp','Boas-vindas','Primeiro contato após opt-in.','Acolhimento → o que esperar → CTA','BAB (Antes-Depois-Ponte)','collier','2-3 linhas',now(),now()),
  ('sms:promo','sms','SMS promocional','Mensagem curta de oferta.','Oferta direta → CTA + link curto','AIDA','kennedy','até 160 caracteres',now(),now()),
  ('sms:lembrete','sms','SMS de lembrete','Lembrete de prazo/evento.','Lembrete → prazo → ação','PAS (Problema-Agitação-Solução)','collier','até 160 caracteres',now(),now())
  ON CONFLICT (key) DO NOTHING;
SQL

# ---------------------------------------------------------------------
# CANAIS (channel) — taxonomia de distribuição para campanhas multi-canal.
# Mapeia cada piece_type ao seu canal. `ads` é dividido em meta_ads/google_ads.
# ---------------------------------------------------------------------
ActiveRecord::Base.connection.execute(<<~SQL)
  UPDATE piece_types SET channel = CASE
    WHEN key LIKE 'ecom:%'     THEN 'ecommerce'
    WHEN key LIKE 'pv:%'       THEN 'landing'
    WHEN key LIKE 'email:%'    THEN 'email'
    WHEN key LIKE 'social:%'   THEN 'social'
    WHEN key LIKE 'marca:%'    THEN 'brand'
    WHEN key LIKE 'seo:%'      THEN 'seo'
    WHEN key LIKE 'whatsapp:%' THEN 'whatsapp'
    WHEN key LIKE 'sms:%'      THEN 'sms'
    WHEN key = 'ads:google-search' THEN 'google_ads'
    WHEN key LIKE 'ads:%'      THEN 'meta_ads'
    ELSE channel
  END;
SQL

# Backfill de copies existentes: channel herdado do piece_type.
ActiveRecord::Base.connection.execute(<<~SQL)
  UPDATE copies c SET channel = pt.channel
  FROM piece_types pt
  WHERE c.piece_type_key = pt.key AND c.channel IS NULL;
SQL

styles_count  = Style.count
fw_count      = Framework.count
pt_count      = PieceType.count
cat_count     = Category.where(workspace_id: nil).count
puts "[seed] styles=#{styles_count} frameworks=#{fw_count} piece_types=#{pt_count} global_categories=#{cat_count}"
