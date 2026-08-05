# Conector WordPress via SSH + WP-CLI.
#
# Decisão de arquitetura (2026-08-05): em vez do REST API com Application
# Password, o Rails abre SSH no host e chama o wp-cli. Motivo prático — as
# Application Passwords do site estão desativadas pelo hardening do Patchstack
# (wp-content/plugins/patchstack/includes/hardening.php filtra
# `wp_is_application_passwords_available` pra false).
#
# Trade-off assumido: exige a chave privada dentro do container e quebra se o
# host/porta mudarem. Por isso `test_connection` existe e os erros são
# explícitos — quando quebrar, tem que ficar óbvio o porquê.
#
# SEGURANÇA — o corpo do post é texto gerado por IA. Ele NUNCA vira argumento
# de linha de comando: vai por STDIN via `wp post create -`. Os demais campos
# (título, resumo) passam por Shellwords.escape antes de compor a string única
# que o shell remoto interpreta. IDs numéricos são validados com regex antes de
# entrar em qualquer `wp eval`.
#
# ENV esperado (definido no Coolify, nunca no repo):
#   WP_SSH_HOST, WP_SSH_PORT, WP_SSH_USER, WP_SSH_KEY_B64,
#   WP_SSH_KNOWN_HOSTS, WP_PATH, WP_CLI_BIN, WP_AUTHOR_ID

require "open3"
require "shellwords"
require "tempfile"
require "base64"
require "json"

module Connectors
  class WordpressSsh
    class ConnectionError < StandardError; end
    class PublishError    < StandardError; end
    class ConfigError     < StandardError; end

    CONNECT_TIMEOUT  = 10   # handshake TCP/SSH
    COMMAND_TIMEOUT  = 60   # teto por comando remoto
    ALLOWED_STATUSES = %w[draft publish].freeze
    MAX_TITLE_BYTES  = 500
    MAX_BODY_BYTES   = 300_000
    DEFAULT_WP_BIN   = "/usr/local/bin/wp"

    def self.from_env
      new(
        host:        ENV["WP_SSH_HOST"],
        port:        ENV["WP_SSH_PORT"].presence || "22",
        user:        ENV["WP_SSH_USER"],
        key_b64:     ENV["WP_SSH_KEY_B64"],
        known_hosts: ENV["WP_SSH_KNOWN_HOSTS"],
        wp_path:     ENV["WP_PATH"],
        wp_bin:      ENV["WP_CLI_BIN"].presence || DEFAULT_WP_BIN,
        author_id:   ENV["WP_AUTHOR_ID"]
      )
    end

    def self.configured?
      %w[WP_SSH_HOST WP_SSH_USER WP_SSH_KEY_B64 WP_PATH].all? { |k| ENV[k].present? }
    end

    def initialize(host:, port:, user:, key_b64:, wp_path:, known_hosts: nil, wp_bin: DEFAULT_WP_BIN, author_id: nil)
      @host        = host.to_s.strip
      @port        = port.to_s.strip
      @user        = user.to_s.strip
      @key_pem     = decode_key(key_b64)
      @known_hosts = known_hosts.to_s.strip.presence
      @wp_path     = wp_path.to_s.strip
      @wp_bin      = wp_bin.to_s.strip.presence || DEFAULT_WP_BIN
      @author_id   = author_id.to_s.strip.presence

      raise ConfigError, "WP_SSH_HOST, WP_SSH_USER, WP_SSH_KEY_B64 e WP_PATH são obrigatórios" if
        @host.blank? || @user.blank? || @key_pem.blank? || @wp_path.blank?
      raise ConfigError, "WP_SSH_PORT inválida: #{@port.inspect}" unless @port.match?(/\A\d{1,5}\z/)
      raise ConfigError, "WP_AUTHOR_ID deve ser numérico" if @author_id && !@author_id.match?(/\A\d+\z/)
    end

    # Confere que o SSH sobe, o wp-cli responde e o path é uma instalação WP.
    def test_connection
      out = wp!(%w[core version])
      { ok: true, wp_version: out.strip, host: @host, path: @wp_path }
    end

    # Categorias reais do blog, pra popular o select do admin.
    def categories
      raw = wp!(%w[term list category --fields=term_id,name,slug,count --format=json])
      JSON.parse(raw.presence || "[]").map do |t|
        { id: t["term_id"].to_i, name: t["name"].to_s, slug: t["slug"].to_s, count: t["count"].to_i }
      end
    rescue JSON::ParserError => e
      raise PublishError, "resposta inválida do wp-cli ao listar categorias: #{e.message}"
    end

    # Cria o post. `status` é draft ou publish — o admin decide na hora.
    # Retorna { id:, url:, status: }.
    def publish(title:, content:, status: "draft", category_ids: [], excerpt: nil)
      title   = title.to_s.strip
      content = content.to_s
      status  = status.to_s.strip

      raise PublishError, "título obrigatório"                              if title.blank?
      raise PublishError, "conteúdo obrigatório"                            if content.strip.blank?
      raise PublishError, "status inválido: #{status.inspect}"              unless ALLOWED_STATUSES.include?(status)
      raise PublishError, "título excede #{MAX_TITLE_BYTES} bytes"          if title.bytesize > MAX_TITLE_BYTES
      raise PublishError, "conteúdo excede #{MAX_BODY_BYTES} bytes"         if content.bytesize > MAX_BODY_BYTES

      argv = ["post", "create", "-", "--post_type=post", "--post_status=#{status}",
              "--post_title=#{title}", "--porcelain"]
      argv << "--post_excerpt=#{excerpt.to_s.strip}" if excerpt.to_s.strip.present?
      argv << "--post_author=#{@author_id}"          if @author_id

      cat_ids = Array(category_ids).map { |c| c.to_s.strip }.select { |c| c.match?(/\A\d+\z/) }
      argv << "--post_category=#{cat_ids.join(',')}" if cat_ids.any?

      # Corpo por STDIN — nunca como argumento.
      raw_id = wp!(argv, stdin_data: content).strip
      unless raw_id.match?(/\A\d+\z/)
        raise PublishError, "wp-cli não retornou um ID de post: #{raw_id.truncate(200).inspect}"
      end

      { id: raw_id.to_i, url: permalink(raw_id), status: status }
    end

    private

    def decode_key(key_b64)
      raw = key_b64.to_s.strip
      return "" if raw.blank?

      # Aceita o PEM cru ou base64 — o Coolify às vezes come as quebras de linha.
      return raw if raw.include?("-----BEGIN")

      decoded = Base64.decode64(raw)
      decoded.include?("-----BEGIN") ? decoded : ""
    end

    # ID já veio validado como inteiro do --porcelain, então é seguro interpolar.
    def permalink(post_id)
      wp!(["eval", "echo get_permalink(#{Integer(post_id)});"]).strip.presence
    rescue ConnectionError, PublishError => e
      # Post foi criado; só o permalink falhou. Não derruba a operação.
      Rails.logger.warn("[WordpressSsh] permalink falhou p/ post #{post_id}: #{e.message}")
      nil
    end

    def wp!(argv, stdin_data: nil)
      stdout, stderr, status = ssh_exec(remote_command(argv), stdin_data)
      return stdout if status&.success?

      msg = stderr.presence || stdout.presence || "sem saída"
      raise PublishError, "wp-cli falhou (exit #{status&.exitstatus}): #{msg.to_s.strip.truncate(500)}"
    end

    def remote_command(argv)
      escaped = argv.map { |a| Shellwords.escape(a.to_s) }.join(" ")
      "cd #{Shellwords.escape(@wp_path)} && #{Shellwords.escape(@wp_bin)} #{escaped}"
    end

    def ssh_exec(remote_cmd, stdin_data)
      with_credential_files do |key_path, known_hosts_path|
        capture(ssh_argv(key_path, known_hosts_path) + [remote_cmd], stdin_data)
      end
    end

    def ssh_argv(key_path, known_hosts_path)
      args = [
        "ssh", "-p", @port, "-i", key_path,
        "-o", "IdentitiesOnly=yes",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=#{CONNECT_TIMEOUT}",
        "-o", "ServerAliveInterval=5",
        "-o", "ServerAliveCountMax=3"
      ]
      # Com known_hosts fixado exigimos match estrito (anti-MITM). Sem ele,
      # aceitamos na primeira conexão — pior, e por isso o ENV é recomendado.
      args += if known_hosts_path
                ["-o", "StrictHostKeyChecking=yes", "-o", "UserKnownHostsFile=#{known_hosts_path}"]
              else
                ["-o", "StrictHostKeyChecking=accept-new"]
              end
      args + ["#{@user}@#{@host}"]
    end

    def with_credential_files
      key = Tempfile.new(["univercopy_wp_key", ""])
      key.write(@key_pem.end_with?("\n") ? @key_pem : "#{@key_pem}\n")
      key.flush
      File.chmod(0o600, key.path)

      kh = nil
      if @known_hosts
        kh = Tempfile.new(["univercopy_wp_kh", ""])
        kh.write(@known_hosts.end_with?("\n") ? @known_hosts : "#{@known_hosts}\n")
        kh.flush
        File.chmod(0o600, kh.path)
      end

      yield(key.path, kh&.path)
    ensure
      [key, kh].compact.each do |f|
        f.close
        f.unlink
      rescue StandardError
        nil
      end
    end

    # popen3 + join com teto: se estourar, mata o processo em vez de vazar.
    def capture(cmd, stdin_data)
      Open3.popen3(*cmd) do |stdin, stdout, stderr, wait_thr|
        begin
          stdin.write(stdin_data) if stdin_data
          stdin.close
        rescue Errno::EPIPE
          # Remoto fechou antes de ler tudo — o erro real vem no stderr.
        end

        out_thread = Thread.new { stdout.read }
        err_thread = Thread.new { stderr.read }

        unless wait_thr.join(COMMAND_TIMEOUT)
          Process.kill("KILL", wait_thr.pid) rescue nil
          wait_thr.join
          [out_thread, err_thread].each(&:kill)
          raise ConnectionError, "timeout de #{COMMAND_TIMEOUT}s falando com #{@host}"
        end

        [out_thread.value.to_s, err_thread.value.to_s, wait_thr.value]
      end
    rescue Errno::ENOENT
      raise ConnectionError, "cliente ssh não encontrado na imagem da API (falta openssh-client)"
    end
  end
end
