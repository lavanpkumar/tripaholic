/** Trip page skeleton (header, tabs, content). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-16" aria-busy="true" aria-label="Loading trip">
      <div className="h-[88px] border-b border-line-soft" />
      <div className="pt-7">
        <div className="skeleton h-3 w-40 rounded" />
        <div className="skeleton mt-4 h-10 w-80 rounded-lg" />
        <div className="skeleton mt-3 h-4 w-96 max-w-full rounded" />
        <div className="mt-7 flex gap-4 border-b border-line-soft pb-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-9 w-28 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 py-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="skeleton h-[680px] rounded-[14px]" />
        <div className="skeleton h-[320px] rounded-2xl" />
      </div>
    </div>
  );
}
