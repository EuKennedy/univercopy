import { Icon, Topbar } from '@/components/shell'
import { EmptyState, GlassButton } from '@/components/ui'

type Props = { params: Promise<{ workspace_slug: string }> }

export default async function ProductsPage({ params }: Props) {
  const { workspace_slug } = await params

  return (
    <>
      <Topbar
        eyebrow="CATÁLOGO"
        title="Produtos"
        description="Catálogo sincronizado da sua loja. WooCommerce, Shopify, Nuvemshop, Tray ou CSV — gera descrições em lote e publica de volta com 1 clique."
      />
      <div className="px-8 py-10 max-w-5xl mx-auto">
        <EmptyState
          status="wip"
          eyebrow="Fase 6"
          icon={<Icon name="product" size={28} />}
          title="Nenhum produto sincronizado"
          description="Conecte uma loja em Configurações → Integrações pra puxar o catálogo. A IA respeita o DNA + Q&A do onboarding pra cada descrição."
          primaryAction={
            <a href={`/${workspace_slug}/settings/integrations`}>
              <GlassButton size="lg">Conectar loja</GlassButton>
            </a>
          }
        />
      </div>
    </>
  )
}
