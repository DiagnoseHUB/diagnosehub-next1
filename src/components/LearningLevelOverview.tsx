"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { LearningDifficulty, LearningModule } from "@/types/learning";
import {
  getLearningProgressServerSnapshot,
  getLearningProgressSnapshot,
  parseLearningProgressSnapshot,
  subscribeLearningProgress,
} from "@/lib/learningProgressLocal";

type LearningLevelOverviewProps = {
  modules: LearningModule[];
};

type LevelFilter = "all" | LearningDifficulty;

const LEARNING_LEVELS: Array<{
  value: LearningDifficulty;
  label: string;
  title: string;
  description: string;
}> = [
  {
    value: "basic",
    label: "Stufe 1",
    title: "Grundlagen",
    description: "Basiswissen, Begriffe, einfache Prüfungen und saubere Reihenfolge.",
  },
  {
    value: "intermediate",
    label: "Stufe 2",
    title: "Fortgeschritten",
    description: "Messwerte, Fehlersuche, Systemverständnis und typische Diagnosewege.",
  },
  {
    value: "advanced",
    label: "Stufe 3",
    title: "Profi",
    description: "Komplexe Fehlerbilder, Plausibilität, Strategie und Abschlussprüfung.",
  },
];

function getDifficultyLabel(difficulty: LearningDifficulty) {
  const level = LEARNING_LEVELS.find((item) => item.value === difficulty);
  return level ? `${level.label}: ${level.title}` : difficulty;
}

export default function LearningLevelOverview({
  modules,
}: LearningLevelOverviewProps) {
  const [selectedLevel, setSelectedLevel] = useState<LevelFilter>("all");
  const snapshot = useSyncExternalStore(
    subscribeLearningProgress,
    getLearningProgressSnapshot,
    getLearningProgressServerSnapshot,
  );

  const progressStore = useMemo(
    () => parseLearningProgressSnapshot(snapshot),
    [snapshot],
  );

  const savedLessons = Object.values(progressStore.lessons);
  const achievements = Object.values(progressStore.achievements).sort((a, b) =>
    b.earnedAt.localeCompare(a.earnedAt),
  );
  const completedCount = savedLessons.filter(
    (entry) => entry.status === "completed",
  ).length;
  const inProgressCount = savedLessons.filter(
    (entry) => entry.status === "in_progress",
  ).length;

  const filteredModules =
    selectedLevel === "all"
      ? modules
      : modules.filter((module) => module.difficulty === selectedLevel);

  return (
    <div>
      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Lernstufen
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">
              Dein Lernweg
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Module sind in drei Stufen sortiert. Deine begonnenen und
              gelernten Lektionen werden lokal in diesem Browser gespeichert.
            </p>
          </div>

          <div className="grid min-w-64 grid-cols-2 gap-2 text-center sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
              <p className="text-2xl font-black text-slate-950 dark:text-slate-100">
                {completedCount}
              </p>
              <p className="text-xs font-bold text-slate-500">gelernt</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
              <p className="text-2xl font-black text-slate-950 dark:text-slate-100">
                {inProgressCount}
              </p>
              <p className="text-xs font-bold text-slate-500">in Arbeit</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
              <p className="text-2xl font-black text-slate-950 dark:text-slate-100">
                {achievements.length}
              </p>
              <p className="text-xs font-bold text-slate-500">Erfolge</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedLevel("all")}
            className={`rounded-xl px-4 py-2 text-sm font-black transition ${
              selectedLevel === "all"
                ? "bg-blue-600 text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Alle Stufen
          </button>

          {LEARNING_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setSelectedLevel(level.value)}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                selectedLevel === level.value
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {level.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {LEARNING_LEVELS.map((level) => (
            <div
              key={level.value}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70"
            >
              <p className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                {level.label}
              </p>
              <h3 className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">
                {level.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {level.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {achievements.length > 0 && (
        <section className="mb-6 rounded-3xl border border-green-500/20 bg-green-500/10 p-5">
          <h2 className="text-xl font-black text-green-900 dark:text-green-100">
            Gespeicherte Erfolge
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {achievements.slice(0, 4).map((achievement) => (
              <div
                key={achievement.id}
                className="rounded-2xl border border-green-500/20 bg-white/70 p-4 dark:bg-slate-950/40"
              >
                <p className="font-black text-slate-950 dark:text-slate-100">
                  {achievement.title}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {achievement.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {modules.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Es wurden noch keine veroeffentlichten Lernmodule gefunden.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredModules.map((module) => {
            const moduleEntries = savedLessons.filter(
              (entry) => entry.moduleId === module.id,
            );
            const moduleCompletedCount = moduleEntries.filter(
              (entry) => entry.status === "completed",
            ).length;

            return (
              <Link
                key={module.id}
                href={`/lernen/${module.slug}`}
                className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-base font-bold text-slate-700 transition group-hover:bg-blue-50 group-hover:text-blue-700 dark:bg-slate-800 dark:text-slate-300">
                  {module.title?.slice(0, 1) || "L"}
                </div>

                <p className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  {getDifficultyLabel(module.difficulty)}
                </p>

                <h3 className="mt-2 text-lg font-bold text-slate-950 dark:text-slate-100">
                  {module.title}
                </h3>

                {module.description && (
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {module.description}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {module.estimatedMinutes} Min.
                  </span>

                  {moduleCompletedCount > 0 && (
                    <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-700 dark:text-green-300">
                      {moduleCompletedCount} gelernt
                    </span>
                  )}
                </div>

                <p className="mt-4 text-sm font-semibold text-blue-700 group-hover:text-blue-800 dark:text-blue-300">
                  Modul öffnen
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
