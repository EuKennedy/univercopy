class CapReached < StandardError
  attr_reader :kind, :workspace_id, :limit, :used

  def initialize(kind:, workspace_id:, limit:, used:)
    @kind         = kind
    @workspace_id = workspace_id
    @limit        = limit
    @used         = used
    super("Cap atingido (#{kind}): #{used}/#{limit}")
  end
end
