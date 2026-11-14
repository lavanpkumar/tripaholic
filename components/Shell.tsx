import Link from "next/link";

/** Page chrome from the original design: brand, nav, tagline, and the faded palm scene on the right. */
export default function Shell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div aria-hidden className="pointer-events-none absolute right-0 top-0 hidden h-[900px] w-[396px] opacity-[0.16] xl:block">
        <img className="absolute left-[264px] top-px" src="/assets/right-palm.svg" alt="" />
        <img className="absolute left-0 top-0.5" src="/assets/left-fronds.svg" alt="" />
        <img className="absolute left-[337px] top-[816px]" src="/assets/island-palm.svg" alt="" />
        <img className="absolute left-[273px] top-[810px]" src="/assets/paddleboarder.svg" alt="" />
        <img className="absolute left-[264px] top-[867px]" src="/assets/sea-ripples.svg" alt="" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-16">
        <header className="flex h-[88px] items-center justify-between border-b border-line-soft">
          <Link href="/" className="flex items-center gap-2.5 text-[25px] font-semibold leading-none text-ink no-underline">
            <img src="/assets/compass.svg" alt="" className="mt-0.5" />
            Tripaholic
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-6">
            <Link href="/" className="flex h-11 items-center gap-2.5 rounded-full bg-mint px-4 text-sm font-semibold text-pine">
              <img src="/assets/trips.svg" alt="" />
              Trips
            </Link>
            <span className="hidden items-center gap-2.5 text-sm text-muted sm:flex">
              <img src="/assets/profile.svg" alt="" />
              Demo traveler
            </span>
          </nav>
          <p className="hidden text-[10px] font-medium tracking-wide text-muted md:block">A LITTLE FURTHER.</p>
        </header>
        <main>{children}</main>
        <footer className="flex flex-wrap justify-between gap-2 border-t border-line-soft py-5 text-[11px] text-muted">
          <p>{footer ?? "Tripaholic · Flights and stays use demo data from a mock provider; no real bookings are made."}</p>
          <p className="font-medium">Demo data</p>
        </footer>
      </div>
    </div>
  );
}
