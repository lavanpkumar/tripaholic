import { z } from "zod";
import { DEMO_USER_ID } from "./env";
import { getTrip } from "./store/repo";
import type { Trip } from "./types";

/** Shared route-handler plumbing: consistent `{ error }` responses and input validation. */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function formatZod(err: z.ZodError): string {
  return err.issues
    .slice(0, 3)
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) return json({ error: err.message }, err.status);
  if (err instanceof z.ZodError) return json({ error: formatZod(err) }, 400);
  console.error(err);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

/** Wraps a route handler so thrown HttpError/ZodError become `{ error }` JSON responses. */
export function route<C>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function readBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  return schema.parse(raw);
}

export async function requireTrip(id: string): Promise<Trip> {
  const trip = await getTrip(id, DEMO_USER_ID);
  if (!trip) throw new HttpError(404, "Trip not found");
  return trip;
}

export type IdParams = { params: Promise<{ id: string }> };
