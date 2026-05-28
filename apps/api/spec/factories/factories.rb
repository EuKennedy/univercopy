# Factories core. Mais factories entram nas Fases 4+ conforme o domínio
# cresce. Mantemos tudo em 1 arquivo até passar 10 factories.

FactoryBot.define do
  factory :app_user do
    sequence(:email) { |n| "user#{n}-#{SecureRandom.hex(4)}@example.test" }
    sequence(:name)  { |n| "User #{n}" }
    default_locale { "pt-BR" }
    preferred_ai_model { "auto" }
  end

  factory :workspace do
    sequence(:slug) { |n| "ws-#{n}-#{SecureRandom.hex(3)}" }
    sequence(:name) { |n| "Workspace #{n}" }
    association :owner, factory: :app_user
    plan { "entry" }
    status { "active" }
    default_locale { "pt-BR" }

    # Garante owner-membership como a função SECURITY DEFINER faria.
    after(:create) do |ws, _|
      WorkspaceMember.find_or_create_by!(
        workspace_id: ws.id,
        user_id: ws.owner_id
      ) { |m| m.role = "owner"; m.accepted_at = Time.current }
      BrandDna.find_or_create_by!(workspace_id: ws.id, kind: "atual")    { |d| d.marca = ws.name }
      BrandDna.find_or_create_by!(workspace_id: ws.id, kind: "proposto") { |d| d.marca = ws.name }
    end
  end

  factory :workspace_member do
    association :workspace
    association :app_user
    role { "editor" }
  end
end
