/** Home skeleton while trips load. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-16" aria-busy="true" aria-label="Loading trips">
      <div className="h-[88px] border-b border-line-soft" />
      <div className="pb-12 pt-14">
        <div className="skeleton h-3 w-32 rounded" />
        <div className="skeleton mt-4 h-10 w-56 rounded-lg" />
        <div className="skeleton mt-4 h-4 w-48 rounded" />
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        {[0, 1, 2].map((c) => (
          <div key={c} className="space-y-4">
            <div className="skeleton h-6 w-40 rounded" />
            <div className="skeleton h-[104px] rounded-2xl" />
            <div className="skeleton h-[104px] rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
