import Link from "next/link";
import Shell from "@/components/Shell";
import { btn } from "@/components/ui/styles";

export default function NotFound() {
  return (
    <Shell>
      <section className="py-24 text-center">
        <p className="eyebrow">Off the map</p>
        <h1 className="mt-3 text-[36px] font-semibold">We couldn&apos;t find that trip</h1>
        <p className="mt-3 text-muted">It may have been deleted.</p>
        <Link href="/" className={`${btn.primary} mt-8`}>
          Back to my trips
        </Link>
      </section>
    </Shell>
  );
}
