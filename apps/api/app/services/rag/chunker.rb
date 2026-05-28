# Chunker simples por parágrafos com janela deslizante. Mantém parágrafos
# inteiros (não corta no meio) salvo quando passam o tamanho máximo —
# nesse caso quebra por sentença.
#
# Otimizado pra português — separa em ".", "!", "?", "…". Mantém
# `metadata: { idx, char_range }` por chunk pra debug/retrieval.

module Rag
  class Chunker
    TARGET_TOKENS  = 320           # ~1200 chars no PT
    MAX_TOKENS     = 480
    OVERLAP_TOKENS = 60

    CHARS_PER_TOKEN = 4            # aproximação para PT — não é tokenização real

    Chunk = Struct.new(:idx, :content, :char_range, :token_count, keyword_init: true)

    def self.chunk(text)
      new.chunk(text)
    end

    def chunk(text)
      clean = text.to_s.gsub(/[ \t]+/, " ").gsub(/\n{3,}/, "\n\n").strip
      return [] if clean.empty?

      paragraphs = clean.split(/\n{2,}/).map(&:strip).reject(&:empty?)

      chunks = []
      buf = +""
      buf_start = 0
      cursor = 0

      paragraphs.each do |para|
        para_tokens = approx_tokens(para)
        buf_tokens  = approx_tokens(buf)

        if para_tokens > max_chars(MAX_TOKENS)
          flush!(chunks, buf, buf_start, cursor) unless buf.strip.empty?
          buf = ""
          split_long_paragraph(para, cursor) { |segment, start| append_chunk(chunks, segment, start) }
          cursor += para.length + 2
          buf_start = cursor
          next
        end

        if buf_tokens + para_tokens > TARGET_TOKENS && !buf.empty?
          flush!(chunks, buf, buf_start, cursor)
          # Overlap — pega o tail do buffer para o próximo chunk.
          tail = tail_window(buf, OVERLAP_TOKENS)
          buf = tail
          buf_start = cursor - tail.length
        end

        buf << "\n\n" unless buf.empty?
        buf << para
        cursor += para.length + 2
      end

      flush!(chunks, buf, buf_start, cursor) unless buf.strip.empty?
      chunks
    end

    private

    def flush!(chunks, buf, start, finish)
      content = buf.strip
      return if content.empty?
      append_chunk(chunks, content, start, finish: finish)
    end

    def append_chunk(chunks, content, start, finish: nil)
      finish ||= start + content.length
      chunks << Chunk.new(
        idx:         chunks.length,
        content:     content,
        char_range:  [start, finish],
        token_count: approx_tokens(content),
      )
    end

    def split_long_paragraph(para, start)
      window_chars = max_chars(TARGET_TOKENS)
      offset = 0
      while offset < para.length
        segment = para[offset, window_chars]
        yield(segment.strip, start + offset)
        offset += window_chars - max_chars(OVERLAP_TOKENS)
      end
    end

    def tail_window(text, tokens)
      n = max_chars(tokens)
      text.length <= n ? text : text[-n, n]
    end

    def approx_tokens(text)
      (text.length.to_f / CHARS_PER_TOKEN).ceil
    end

    def max_chars(tokens)
      tokens * CHARS_PER_TOKEN
    end
  end
end
