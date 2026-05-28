# Ingere um documento (DNA scrape, Q&A do onboarding, brief de campanha,
# etc) no RAG. Persiste rag_documents + rag_chunks.
#
# Embedding (coluna `vector(1536)`) fica NULL até Rag::Embedder rodar na
# Fase 3.D — separação permite ingest sincrono e embed assíncrono.
#
# Sempre roda dentro de transação RLS (caller passa workspace_id).

module Rag
  class Ingester
    Result = Struct.new(:document, :chunks_count, :status, keyword_init: true)

    def self.call(workspace:, source_kind:, source_ref: nil, title: nil, text:, metadata: {})
      new.call(workspace:, source_kind:, source_ref:, title:, text:, metadata:)
    end

    def call(workspace:, source_kind:, source_ref:, title:, text:, metadata:)
      raise ArgumentError, "text obrigatório" if text.blank?

      document = RagDocument.create!(
        workspace_id: workspace.id,
        source_kind:  source_kind,
        source_ref:   source_ref,
        title:        title,
        full_text:    text,
        metadata:     metadata,
        status:       "pending",
      )

      chunks = Rag::Chunker.chunk(text)
      now    = Time.current

      if chunks.any?
        rows = chunks.map do |c|
          {
            workspace_id:    workspace.id,
            rag_document_id: document.id,
            idx:             c.idx,
            content:         c.content,
            token_count:     c.token_count,
            metadata:        { char_range: c.char_range }.to_json,
            created_at:      now,
            updated_at:      now,
          }
        end
        RagChunk.insert_all!(rows)
      end

      document.update!(status: "chunked")
      Result.new(document: document, chunks_count: chunks.length, status: "chunked")
    end
  end
end
