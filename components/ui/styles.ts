// Shared class strings for the few UI primitives the app needs (buttons, inputs, cards).
import clsx from "clsx";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";

export const btn = {
  primary: clsx(btnBase, "h-11 px-5 bg-pine text-white hover:bg-pine-dark"),
  soft: clsx(btnBase, "h-11 px-5 bg-mint text-pine hover:bg-[#e1eee6]"),
  ghost: clsx(btnBase, "h-9 px-3 text-muted hover:bg-mint hover:text-pine"),
  danger: clsx(btnBase, "h-9 px-4 border border-danger-line bg-white text-danger hover:bg-[#fbf4f2]"),
  small: clsx(btnBase, "h-9 px-4 bg-pine text-white hover:bg-pine-dark"),
  smallSoft: clsx(btnBase, "h-9 px-4 bg-mint text-pine hover:bg-[#e1eee6]"),
};

export const input =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-[#9aa8a2] focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/15";

export const label = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.6px] text-muted";

export const card = "rounded-2xl border border-line bg-white";
