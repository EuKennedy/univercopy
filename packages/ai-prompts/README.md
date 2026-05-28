# @univer/ai-prompts

Prompts versionados do UniverCopy. Não inline em código — sempre arquivos `.md` aqui dentro.

## Convenções

- Naming: `{dominio}/{tarefa}.v{N}.md` — ex.: `copy/product-description.v1.md`, `dna/extract-from-url.v2.md`
- Cada versão é imutável depois de referenciada. Mudou semântica → nova versão.
- Toda versão tem um JSON schema correspondente em `schema/` quando o output é estruturado.
- O system prompt vai no header `## System`. O template do user prompt vai em `## User`. Placeholders entre `{{ }}`.

## Schema de output

Quando o LLM retorna JSON estruturado, o Rails valida com `json_schemer` antes de persistir.
Schema correspondente em `schema/{dominio}/{tarefa}.v{N}.schema.json`.

## Como o Rails consome

```ruby
prompt = AI::PromptLoader.load('copy/product-description.v1')
result = AI::Client.call(prompt: prompt.render(input), model: :auto, task: :generate_copy)
AI::SchemaValidator.validate!(result, 'copy/product-description.v1')
```

## Lista atual

Será populada na Fase 5 e Fase 7 do refactor.
