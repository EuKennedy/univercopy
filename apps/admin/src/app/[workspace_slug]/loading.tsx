// Skeleton liquid-glass enquanto Server Components buscam dados. Aparece
// nas transições de rota dentro do workspace — perceived performance.
export default function Loading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto w-full">
      <div className="h-9 w-56 rounded-xl uc-skeleton mb-3" />
      <div className="h-4 w-80 rounded-lg uc-skeleton mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-3xl uc-skeleton" />
        ))}
      </div>
    </div>
  )
}
