import Link from "next/link";
import type { InstructionGuide } from "../types/instruction";

type InstructionCardProps = {
  instruction: InstructionGuide;
};

export default function InstructionCard({ instruction }: InstructionCardProps) {
  return (
    <article className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700">
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          {instruction.category}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {instruction.difficulty}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {instruction.estimatedTime}
        </span>
      </div>

      <h2 className="text-xl font-black leading-tight text-slate-950 transition-colors group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
        {instruction.title}
      </h2>

      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
        {instruction.subtitle}
      </p>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors dark:border-slate-800 dark:bg-slate-950">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Anwendbarkeit
        </p>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
          {instruction.vehicleApplicability}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {instruction.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto pt-6">
        <Link
          href={`/anleitungen/${instruction.slug}`}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500"
        >
          Anleitung öffnen
        </Link>
      </div>
    </article>
  );
}