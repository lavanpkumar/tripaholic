"use client";

import { useState } from "react";
import { btn } from "@/components/ui/styles";
import NewTripDialog from "./NewTripDialog";

export default function NewTripButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`${btn.primary} h-12 pl-5 pr-6`} onClick={() => setOpen(true)}>
        <img src="/assets/plus.svg" alt="" />
        New Trip
      </button>
      {open && <NewTripDialog onClose={() => setOpen(false)} />}
    </>
  );
}
