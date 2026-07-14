"use client";

import type { InstructionGuide } from "@/types/instruction";

const PRINT_PROTOCOL_STORAGE_KEY = "diagnosehub-print-protocol";

type ProtocolPrintButtonProps = {
  instruction?: InstructionGuide;
  source?: "diagnosis" | "instruction";
  label?: string;
  className?: string;
};

export default function ProtocolPrintButton({
  instruction,
  source = instruction ? "instruction" : "diagnosis",
  label = "PDF-Prüfprotokoll",
  className,
}: ProtocolPrintButtonProps) {
  function openProtocol() {
    try {
      if (source === "instruction" && instruction) {
        window.sessionStorage.setItem(
          PRINT_PROTOCOL_STORAGE_KEY,
          JSON.stringify({
            type: "instruction",
            instruction,
            createdAt: new Date().toISOString(),
          }),
        );
      } else {
        window.sessionStorage.removeItem(PRINT_PROTOCOL_STORAGE_KEY);
      }
    } catch {
      // Wenn Session Storage blockiert ist, funktioniert das Diagnoseprotokoll weiterhin.
    }

    window.location.href =
      source === "instruction"
        ? "/pruefprotokoll?typ=anleitung"
        : "/pruefprotokoll?typ=diagnose";
  }

  return (
    <button
      type="button"
      onClick={openProtocol}
      className={
        className ||
        "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 print:hidden"
      }
    >
      {label}
    </button>
  );
}
