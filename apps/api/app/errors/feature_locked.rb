class FeatureLocked < StandardError
  attr_reader :feature, :plan

  def initialize(feature:, plan:)
    @feature = feature
    @plan    = plan
    super("Feature '#{feature}' não disponível no plano '#{plan}'")
  end
end
