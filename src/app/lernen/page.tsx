import Link from "next/link";
import Header from "@/components/Header";
import { loadLearningOverview } from "@/lib/supabase/learningStorage";
import type { LearningDifficulty } from "@/types/learning";

export const dynamic = "force-dynamic";

function getDifficultyLabel(difficulty: LearningDifficulty) {
  if (difficulty === "basic") return "Grundlage";
  if (difficulty === "intermediate") return "Fortgeschritten";
  return "Experte";
}

function getPlanLabel(plan: string) {
  if (plan === "free") return "Free";
  if (plan === "werkstatt") return "Werkstatt";
  if (plan === "pro") return "Pro";
  return plan;
}

export default async function LearningPage() {
  const categories = await loadLearningOverview("free");

  const totalModules = categories.reduce(
    (sum, category) => sum + category.modules.length,
    0
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-8 shadow-sm transition-colors dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-blue-950/30">
            <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-400">
              DiagnoseHUB Lernplattform
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
              Werkstattwissen systematisch lernen
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-700 dark:text-slate-300">
              Technische Lernmodule für Diagnose, Messwerte, Fehlercodes,
              Bauteile und Prüfabläufe. Später werden Diagnosefälle automatisch
              mit passenden Lerninhalten verknüpft.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-bold text-blue-700 dark:text-blue-300">
                {categories.length} Kategorien
              </span>

              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-700 dark:text-green-300">
                {totalModules} Module
              </span>

              <span className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                Free / Werkstatt / Pro vorbereitet
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-6">
            {categories.map((category) => (
              <section
                key={category.id}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80"
              >
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-400">
                      {category.icon}
                    </p>

                    <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-100">
                      {category.title}
                    </h2>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {category.description}
                    </p>
                  </div>

                  <p className="text-sm font-bold text-slate-500">
                    {category.modules.length} Module
                  </p>
                </div>

                {category.modules.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                    Noch keine veröffentlichten Module in dieser Kategorie.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {category.modules.map((module) => (
                      <Link
                        key={module.id}
                        href={`/lernen/${module.slug}`}
                        className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
                      >
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                            {getDifficultyLabel(module.difficulty)}
                          </span>

                          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            {getPlanLabel(module.requiredPlan)}
                          </span>

                          {module.isLocked && (
                            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-yellow-700 dark:text-yellow-300">
                              Gesperrt
                            </span>
                          )}
                        </div>

                        <h3 className="mt-4 text-xl font-black text-slate-950 transition group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
                          {module.title}
                        </h3>

                        {module.subtitle && (
                          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-400">
                            {module.subtitle}
                          </p>
                        )}

                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                          {module.description}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="text-sm font-bold text-slate-500">
                            ca. {module.estimatedMinutes} Min.
                          </span>

                          {module.relatedFaultCodes.slice(0, 3).map((code) => (
                            <span
                              key={code}
                              className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}