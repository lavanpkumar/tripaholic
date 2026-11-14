import "./_env";
import { closeDb } from "../lib/db";
import { addDays, todayIn } from "../lib/dates";
import { DEMO_USER_ID } from "../lib/env";
import { storeMode } from "../lib/store";
import { createTrip, deleteTrip } from "../lib/store/repo";
import type { Destination, Trip } from "../lib/types";

/**
 * Seeds the demo user with trips in all three sections. Dates are relative to today so the
 * home page always shows a planned, an in-progress, and an archived trip. Safe to re-run: it
 * replaces only the seeded trips (fixed ids), never trips created in the app.
 */

interface SeedTrip {
  id: string;
  title: string;
  destination: Destination;
  /** start offset from today, in days */
  startIn: number;
  days: number;
  archived?: boolean;
}

const SEEDS: SeedTrip[] = [
  {
    id: "seed-bali",
    title: "Bali, Indonesia",
    destination: { name: "Bali, Indonesia", scope: "state", timezone: "Asia/Makassar", lat: -8.34, lng: 115.09, country: "Indonesia" },
    startIn: 61,
    days: 8,
  },
  {
    id: "seed-palawan",
    title: "Palawan, Philippines",
    destination: { name: "Palawan, Philippines", scope: "state", timezone: "Asia/Manila", lat: 9.83, lng: 118.74, country: "Philippines" },
    startIn: 128,
    days: 6,
  },
  {
    id: "seed-srilanka",
    title: "South coast, Sri Lanka",
    destination: { name: "Sri Lanka", scope: "country", timezone: "Asia/Colombo", lat: 7.87, lng: 80.77, country: "Sri Lanka" },
    startIn: -2,
    days: 7,
  },
  {
    id: "seed-langkawi",
    title: "Langkawi, Malaysia",
    destination: { name: "Langkawi, Malaysia", scope: "city", timezone: "Asia/Kuala_Lumpur", lat: 6.35, lng: 99.8, country: "Malaysia" },
    startIn: -96,
    days: 5,
  },
];

export async function seed(): Promise<Trip[]> {
  const created: Trip[] = [];
  for (const s of SEEDS) {
    await deleteTrip(s.id);
    const startDate = addDays(todayIn(s.destination.timezone), s.startIn);
    created.push(
      await createTrip({
        id: s.id,
        userId: DEMO_USER_ID,
        title: s.title,
        destination: s.destination,
        startDate,
        endDate: addDays(startDate, s.days - 1),
        archived: Boolean(s.archived),
      }),
    );
  }
  return created;
}

seed()
  .then((trips) => {
    console.log(`Seeded ${trips.length} trips for ${DEMO_USER_ID} into the ${storeMode()} store:`);
    for (const t of trips) console.log(`  ${t.startDate} → ${t.endDate}  ${t.title}`);
  })
  .catch((err) => {
    console.error("Seed FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
