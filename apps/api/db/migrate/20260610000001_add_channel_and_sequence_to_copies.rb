# Multi-channel campaigns. Channel = canal de distribuição (email, whatsapp,
# sms, meta_ads, google_ads...). Sequência = copies da mesma campanha + canal,
# ordenadas por sequence_index. piece_types ganha `channel` (grouping no
# catálogo). copies ganha `channel` + `sequence_index`.
#
# Sem mudança de RLS: colunas herdam as policies existentes das tabelas.
# Popula dados aqui (e não só no seeds) porque o deploy roda `db:prepare`, que
# em DB existente só aplica migrations pendentes — não re-semeia. Idempotente.
class AddChannelAndSequenceToCopies < ActiveRecord::Migration[8.1]
  def up
    add_column :piece_types, :channel, :string unless column_exists?(:piece_types, :channel)
    add_column :copies, :channel, :string unless column_exists?(:copies, :channel)
    add_column :copies, :sequence_index, :integer unless column_exists?(:copies, :sequence_index)

    add_index :copies, %i[workspace_id campaign_id channel sequence_index],
              name: "idx_copies_campaign_sequence", if_not_exists: true
    add_index :piece_types, :channel, if_not_exists: true

    # Categorias novas (WhatsApp/SMS) — idempotente. Não depende de FK.
    execute <<~SQL
      INSERT INTO categories(workspace_id,key,name,icon,color,created_at,updated_at) VALUES
      (NULL,'whatsapp','WhatsApp','message-circle','#22c55e',now(),now()),
      (NULL,'sms','SMS','smartphone','#06b6d4',now(),now())
      ON CONFLICT (workspace_id, key) DO NOTHING;
    SQL

    # Piece types novos (WhatsApp + SMS) — idempotente.
    #
    # SÓ roda em base que JÁ tem as bibliotecas globais. Numa base nova (CI,
    # dev do zero) as migrations rodam ANTES do seeds, então `frameworks` e
    # `styles` estão vazias — e inserir piece_type apontando pra 'AIDA' ou
    # 'kennedy' viola a FK e derruba o `db:prepare` inteiro, junto com todas
    # as migrations seguintes. Era exatamente isso que quebrava o CI.
    #
    # Pular não perde nada: o seeds.rb cria estes MESMOS piece_types, com as
    # bibliotecas semeadas antes deles. O bloco existe só para a base que já
    # está de pé em produção, onde `db:prepare` aplica migration pendente sem
    # re-semear.
    if libraries_seeded?
      execute <<~SQL
        INSERT INTO piece_types(key,category_key,name,description,structure,default_framework,default_style,length_hint,created_at,updated_at) VALUES
        ('whatsapp:promo','whatsapp','Mensagem promocional','Disparo de oferta no WhatsApp.','Abertura pessoal → oferta → CTA + link','AIDA','kennedy','2-4 linhas',now(),now()),
        ('whatsapp:sequencia','whatsapp','Sequência de mensagens (passo)','Passo de uma cadência de WhatsApp.','Continuidade do contexto → valor/lembrete → CTA','PAS (Problema-Agitação-Solução)','collier','2-4 linhas',now(),now()),
        ('whatsapp:carrinho','whatsapp','Recuperação de carrinho','Recupera quem não finalizou no WhatsApp.','Lembrete amigável → remover atrito → CTA + link','PAS (Problema-Agitação-Solução)','collier','2-3 linhas',now(),now()),
        ('whatsapp:boas-vindas','whatsapp','Boas-vindas','Primeiro contato após opt-in.','Acolhimento → o que esperar → CTA','BAB (Antes-Depois-Ponte)','collier','2-3 linhas',now(),now()),
        ('sms:promo','sms','SMS promocional','Mensagem curta de oferta.','Oferta direta → CTA + link curto','AIDA','kennedy','até 160 caracteres',now(),now()),
        ('sms:lembrete','sms','SMS de lembrete','Lembrete de prazo/evento.','Lembrete → prazo → ação','PAS (Problema-Agitação-Solução)','collier','até 160 caracteres',now(),now())
        ON CONFLICT (key) DO NOTHING;
      SQL
    else
      say "bibliotecas globais ainda não semeadas — piece_types de WhatsApp/SMS ficam para o db:seed"
    end

    # Mapeia cada piece_type ao canal. `ads` divide em meta_ads/google_ads.
    execute <<~SQL
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
    execute <<~SQL
      UPDATE copies c SET channel = pt.channel
      FROM piece_types pt
      WHERE c.piece_type_key = pt.key AND c.channel IS NULL;
    SQL
  end

  def down
    remove_index :copies, name: "idx_copies_campaign_sequence", if_exists: true
    remove_index :piece_types, :channel, if_exists: true
    remove_column :copies, :sequence_index, if_exists: true
    remove_column :copies, :channel, if_exists: true
    remove_column :piece_types, :channel, if_exists: true
  end

  private

  # As duas tabelas que os piece_types abaixo referenciam por FK
  # (default_framework → frameworks.key, default_style → styles.key).
  def libraries_seeded?
    select_value("SELECT EXISTS (SELECT 1 FROM frameworks)") &&
      select_value("SELECT EXISTS (SELECT 1 FROM styles)")
  end
end
