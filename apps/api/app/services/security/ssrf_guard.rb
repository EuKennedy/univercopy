# Bloqueia URLs que apontam pra endereços internos/privados — defesa
# contra SSRF (Server-Side Request Forgery) em todo lugar que aceita URL
# do usuário (scraper, integrações, audit). Faz resolução DNS e checa
# cada IP retornado.
#
# Política:
#   - Permitido apenas http/https.
#   - Resolve hostname. Cada IP retornado precisa ser PÚBLICO.
#   - Bloqueia: loopback, link-local, RFC1918, multicast, broadcast,
#     unspecified, reserved, e a faixa metadata cloud (169.254.169.254).
#
# Uso:
#   uri = Security::SsrfGuard.safe!(url)   # raises Security::SsrfBlocked
#   Faraday.get(uri)                       # passa porque já validado

require "ipaddr"
require "resolv"
require "uri"

module Security
  # SsrfBlocked vive em ssrf_blocked.rb (Zeitwerk strict).
  module SsrfGuard
    ALLOWED_SCHEMES = %w[http https].freeze
    BLOCKED_RANGES  = [
      "0.0.0.0/8",
      "10.0.0.0/8",
      "127.0.0.0/8",
      "169.254.0.0/16", # link-local + cloud metadata (169.254.169.254)
      "172.16.0.0/12",
      "192.0.0.0/24",
      "192.0.2.0/24",
      "192.168.0.0/16",
      "198.18.0.0/15",
      "198.51.100.0/24",
      "203.0.113.0/24",
      "224.0.0.0/4",
      "240.0.0.0/4",
      "255.255.255.255/32",
      "::/128",
      "::1/128",
      "::ffff:0:0/96",  # IPv4-mapped (qualquer)
      "fc00::/7",        # ULA
      "fe80::/10",       # link-local IPv6
      "ff00::/8"         # multicast
    ].map { |c| IPAddr.new(c) }.freeze

    module_function

    def safe!(raw_url)
      uri = URI.parse(raw_url.to_s.strip)
      raise SsrfBlocked, "scheme inválido: #{uri.scheme.inspect}" unless ALLOWED_SCHEMES.include?(uri.scheme)
      raise SsrfBlocked, "host ausente" if uri.host.blank?

      ips = resolve_addresses(uri.host)
      raise SsrfBlocked, "host não resolve: #{uri.host}" if ips.empty?

      ips.each do |ip|
        BLOCKED_RANGES.each do |range|
          raise SsrfBlocked, "ip privado/reservado: #{ip} (host #{uri.host})" if range.include?(ip)
        end
      end

      uri
    rescue URI::InvalidURIError => e
      raise SsrfBlocked, "URI inválida: #{e.message}"
    rescue IPAddr::InvalidAddressError => e
      raise SsrfBlocked, "endereço inválido: #{e.message}"
    end

    def resolve_addresses(host)
      # Resolv (Ruby stdlib) — sem dependência extra. Pra prod, considerar
      # cache curto (60s) — DNS rebinding entre safe!() e a request real
      # é o vetor a vigiar; Faraday connect_timeout curto também ajuda.
      Resolv.getaddresses(host).map { |a| IPAddr.new(a) }.uniq
    rescue StandardError
      []
    end
  end
end
