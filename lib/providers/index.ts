import { env } from "../env";
import { mockFlightProvider } from "./mock-flights";
import { mockLodgingProvider } from "./mock-lodging";
import type { FlightProvider, LodgingProvider } from "./types";

export * from "./types";

/** PROVIDER_MODE=real is reserved for a sandbox adapter (PLAN.md Phase 7); only mock ships today. */
export function getProviders(): { flights: FlightProvider; lodging: LodgingProvider } {
  if (env.providerMode === "real") console.warn("[providers] PROVIDER_MODE=real has no adapter yet; using mock data.");
  return { flights: mockFlightProvider, lodging: mockLodgingProvider };
}
