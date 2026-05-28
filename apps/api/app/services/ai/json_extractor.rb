# Parser tolerante a JSON truncado. Modelos LLM podem bater no max_tokens
# e devolver JSON cortado no meio; reparamos fechando strings, removendo
# trailing comma e fechando { [ pendentes.
#
# Mantém compat com a heurística do legacy (api/src/json.ts).

module Ai
  module JsonExtractor
    module_function

    def parse(text)
      raise ArgumentError, "texto vazio" if text.blank?
      start = text.index("{")
      raise ArgumentError, "nenhum objeto JSON encontrado" unless start

      raw = text[start..text.rindex("}").to_i]
      JSON.parse(raw)
    rescue JSON::ParserError
      JSON.parse(repair(text[start..]))
    end

    def repair(src)
      out   = +""
      in_str = false
      esc    = false
      stack  = []

      src.each_char do |ch|
        out << ch
        if in_str
          if esc
            esc = false
          elsif ch == "\\"
            esc = true
          elsif ch == '"'
            in_str = false
          end
          next
        end

        case ch
        when '"'      then in_str = true
        when "{"      then stack.push("}")
        when "["      then stack.push("]")
        when "}", "]" then stack.pop
        end
      end

      out << '"' if in_str
      out = out.sub(/,\s*\z/, "")
      out = out.sub(/:\s*\z/, ":null")
      out = out.sub(/,\s*\z/, "")
      out << stack.pop until stack.empty?
      out
    end
  end
end
