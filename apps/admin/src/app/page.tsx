// Página placeholder do bootstrap. Substituída na Fase 3 pelo router de
// onboarding (auth check → workspace check → onboarding wizard).

export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-xl text-center space-y-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--uc-border)] bg-[var(--uc-surface-soft)] px-3 py-1 text-xs font-medium tracking-wide text-[var(--uc-text-muted)] backdrop-blur">
          worldclass · build em andamento
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--uc-text)] sm:text-5xl">
          UniverCopy
        </h1>
        <p className="text-base leading-7 text-[var(--uc-text-soft)]">
          Hub world-class de geração, revisão e organização de copy.
          <br />
          Painel disponível após o onboarding (Fase 3).
        </p>
      </div>
    </main>
  )
}
