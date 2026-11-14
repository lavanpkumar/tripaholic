import { z } from "zod";
import { diffDays, isYmd, normalizeLocal } from "./dates";
import { EVENT_CATEGORIES } from "./types";

/** zod schemas for every API input (PLAN.md Section 9). */

export const MAX_TRIP_DAYS = 30;

const ymd = z.string().refine(isYmd, "Expected a date as YYYY-MM-DD");

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const scopeSchema = z.enum(["city", "state", "country"]);

export const destinationSchema = z.object({
  name: z.string().trim().min(1, "Location is required").max(120),
  scope: scopeSchema,
  timezone: z.string().refine(isValidTimeZone, "Unknown time zone"),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  country: z.string().max(80).optional(),
  region: z.string().max(80).optional(),
});

/** Shared date-range rule for trip create and update. Returns an error message or null. */
export function dateRangeError(startDate: string, endDate: string): string | null {
  if (endDate < startDate) return "End date must be on or after the start date";
  if (diffDays(startDate, endDate) + 1 > MAX_TRIP_DAYS) return `Trips can be at most ${MAX_TRIP_DAYS} days`;
  return null;
}

export const tripCreateSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    destination: destinationSchema,
    startDate: ymd,
    endDate: ymd,
  })
  .superRefine((v, ctx) => {
    const msg = dateRangeError(v.startDate, v.endDate);
    if (msg) ctx.addIssue({ code: "custom", path: ["endDate"], message: msg });
  });

export const tripPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    startDate: ymd.optional(),
    endDate: ymd.optional(),
    archived: z.boolean().optional(),
  })
  .strict();

const localDateTime = z.string().transform((s, ctx) => {
  const n = normalizeLocal(s);
  if (!n) {
    ctx.addIssue({ code: "custom", message: "Expected a local datetime like 2027-02-08T09:00" });
    return z.NEVER;
  }
  return n;
});

const title = z.string().trim().min(1, "Title is required").max(140);
const description = z.string().trim().max(2000).optional();
const location = z.string().trim().max(200).optional();
const category = z.enum(EVENT_CATEGORIES).optional();

function checkTimes(v: { start?: string; end?: string }, ctx: z.RefinementCtx) {
  if (v.start && v.end && v.end <= v.start) ctx.addIssue({ code: "custom", path: ["end"], message: "End must be after start" });
}

export const eventCreateSchema = z
  .object({ title, description, start: localDateTime, end: localDateTime, location, category })
  .superRefine(checkTimes);

export const eventPatchSchema = z
  .object({
    title: title.optional(),
    description,
    start: localDateTime.optional(),
    end: localDateTime.optional(),
    location,
    category,
    pinned: z.boolean().optional(),
  })
  .strict()
  .superRefine(checkTimes);

export const agentRequestSchema = z.object({
  kind: z.enum(["flight", "lodging"]),
  request: z.string().trim().min(3, "Tell the agent what you want").max(1000),
  autoBook: z.boolean().default(true),
  /** Option ids the traveler passed on ("show me another option"); hidden from searches. */
  exclude: z.array(z.string().max(40)).max(20).default([]),
});

export const confirmSchema = z.object({
  runId: z.string().min(1),
  optionId: z.string().min(1),
});

export const generateSchema = z.object({ preferences: z.string().trim().max(500).optional() });
