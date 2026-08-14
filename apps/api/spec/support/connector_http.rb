# Todo conector passa a URL pelo Security::SsrfGuard antes do request, e o
# guard RESOLVE o hostname — se não resolver, bloqueia.
#
# Hosts de teste (`blog.test`, `comunidade.test`) não resolvem em DNS nenhum:
# `.test` é TLD reservado justamente pra isso. Sem este helper, todo spec de
# conector morreria em "host não resolve" antes de exercitar uma linha do
# conector — e o WebMock nem chegaria a ser consultado.
#
# O guard NÃO fica sem cobertura: os exemplos que provam o bloqueio de SSRF
# chamam `enforce_ssrf_guard!` e exercitam o código real contra um IP interno,
# que resolve sem DNS.
module ConnectorHttp
  # Deixa a URL passar sem resolver DNS, preservando a validação de scheme —
  # URL malformada continua estourando, como em produção.
  def allow_test_hosts!
    allow(Security::SsrfGuard).to receive(:safe!) do |raw|
      uri = URI.parse(raw.to_s.strip)
      raise Security::SsrfBlocked, "scheme inválido: #{uri.scheme.inspect}" unless
        Security::SsrfGuard::ALLOWED_SCHEMES.include?(uri.scheme)

      uri
    end
  end

  # Devolve o guard de verdade para o exemplo que quer prová-lo.
  def enforce_ssrf_guard!
    allow(Security::SsrfGuard).to receive(:safe!).and_call_original
  end
end

RSpec.configure { |c| c.include ConnectorHttp }
