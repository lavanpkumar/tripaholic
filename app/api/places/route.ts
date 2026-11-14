import { z } from "zod";
import { json, route } from "@/lib/api";
import { searchPlaces } from "@/lib/places";

const query = z.string().trim().max(100);

export const GET = route(async (req) => {
  const q = query.parse(new URL(req.url).searchParams.get("q") ?? "");
  return json({ places: await searchPlaces(q) });
});
