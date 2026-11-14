/** Seeded randomness so mock results are stable for the same query (PLAN.md Section 7). */

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seeded(key: unknown) {
  const r = rng(hashString(JSON.stringify(key)));
  return {
    next: r,
    int: (min: number, max: number) => min + Math.floor(r() * (max - min + 1)),
    pick: <T>(list: readonly T[]) => list[Math.floor(r() * list.length)],
    shuffle: <T>(list: readonly T[]) => {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function confirmationCode(seed: string): string {
  const r = rng(hashString(seed));
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(r() * CODE_CHARS.length)]).join("");
}
