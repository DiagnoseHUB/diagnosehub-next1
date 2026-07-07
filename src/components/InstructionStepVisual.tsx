import type { InstructionStep } from "@/types/instruction";

type InstructionStepVisualProps = {
  step: InstructionStep;
  stepNumber: number;
};

function getVisualText(step: InstructionStep) {
  return step.imageHint || step.imageAlt || step.title;
}

function getSafeImageUrl(value?: string) {
  if (!value) {
    return "";
  }

  if (value.startsWith("/") || value.startsWith("https://")) {
    return value;
  }

  return "";
}

export default function InstructionStepVisual({
  step,
  stepNumber,
}: InstructionStepVisualProps) {
  const imageUrl = getSafeImageUrl(step.imageUrl);

  if (imageUrl) {
    return (
      <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
        <div
          role="img"
          aria-label={step.imageAlt || step.title}
          className="h-44 w-full bg-cover bg-center"
          style={{ backgroundImage: `url("${imageUrl}")` }}
        />
        <figcaption className="px-4 py-3 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
          {getVisualText(step)}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure
      role="img"
      aria-label={step.imageAlt || step.title}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="relative h-40 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
        <div className="absolute inset-x-4 top-4 h-8 rounded-lg bg-slate-300 dark:bg-slate-700" />
        <div className="absolute bottom-4 left-4 right-4 h-14 rounded-xl border border-blue-300 bg-blue-100 dark:border-blue-700/60 dark:bg-blue-950/60" />
        <div className="absolute bottom-8 left-8 h-8 w-24 rounded-full bg-blue-600/80" />
        <div className="absolute bottom-8 right-8 h-8 w-20 rounded-full bg-slate-500/70" />
        <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white shadow-lg dark:bg-white dark:text-slate-950">
          {stepNumber}
        </div>
      </div>

      <figcaption className="mt-3 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
        {getVisualText(step)}
      </figcaption>
    </figure>
  );
}
