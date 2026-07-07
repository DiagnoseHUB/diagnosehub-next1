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
  target: string;
}> = [
  {
    value: "basic",
    label: "Stufe 1",
    title: "Grundlagen",
    description:
      "Begriffe, Sichtprüfung, einfache Messlogik und saubere Reihenfolge.",
    target: "Für Einstieg, Wiederholung und sichere Basis.",
  },
  {
    value: "intermediate",
    label: "Stufe 2",
    title: "Systemdiagnose",
    description:
      "Messwerte, Sensorik, Aktoren, Fehlersuche und Systemverständnis.",
    target: "Für echte Werkstattfälle mit mehreren Ursachen.",
  },
  {
    value: "advanced",
    label: "Stufe 3",
    title: "Prüfung & komplexe Fälle",
    description:
      "Strategie, Plausibilität, Fallaufgaben und Abschlussprüfung.",
    target: "Für Gesellenprüfung, Fachgespräch und schwierige Diagnosen.",
  },
];

const CATEGORY_META: Record<
  string,
  {
    label: string;
    description: string;
    order: number;
  }
> = {
  "local-cat-diagnose": {
    label: "Diagnose-Grundlagen",
    description: "Prüfstrategie, Dokumentation und Fehlersuche.",
    order: 10,
  },
  "local-cat-elektrik": {
    label: "Elektrik & Elektronik",
    description: "Spannung, Masse, Signale, Sensoren und Aktoren.",
    order: 20,
  },
  "local-cat-motor": {
    label: "Motor, Diesel & Abgas",
    description: "Luftpfad, Einspritzung, AGR, DPF und Ladedruck.",
    order: 30,
  },
  "local-cat-fahrwerk": {
    label: "Bremse & Fahrwerk",
    description: "ABS/ESP, Verschleißbilder und Fahrwerkdiagnose.",
    order: 40,
  },
  "local-cat-klima": {
    label: "Klima & Thermomanagement",
    description: "Drücke, Temperaturen, Kühlung und Luftführung.",
    order: 50,
  },
  "local-cat-prüfung": {
    label: "Prüfungsvorbereitung",
    description: "Gesellenprüfung, Kundenauftrag und Fachgespräch.",
    order: 60,
  },
};

function getDifficultyLabel(difficulty: LearningDifficulty) {
  const level = LEARNING_LEVELS.find((item) => item.value === difficulty);
  return level ? `${level.label}: ${level.title}` : difficulty;
}

function getCategoryMeta(module: LearningModule) {
  return (
    CATEGORY_META[module.categoryId] || {
      label: "Weitere Module",
      description: "Zusätzliche Lerninhalte.",
      order: 999,
    }
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} Min.`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest > 0 ? `${hours} Std. ${rest} Min.` : `${hours} Std.`;
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
  const totalMinutes = modules.reduce(
    (sum, module) => sum + module.estimatedMinutes,
    0,
  );

  const firstInProgressModuleId = savedLessons.find(
    (entry) => entry.status === "in_progress",
  )?.moduleId;
  const recommendedModule =
    modules.find((module) => module.id === firstInProgressModuleId) ||
    modules.find((module) => module.difficulty === "basic") ||
    modules[0];

  const visibleLevels =
    selectedLevel === "all"
      ? LEARNING_LEVELS
      : LEARNING_LEVELS.filter((level) => level.value === selectedLevel);

  const categoryStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        id: string;
        label: string;
        description: string;
        order: number;
        count: number;
      }
    >();

    modules.forEach((module) => {
      const meta = getCategoryMeta(module);
      const current = stats.get(module.categoryId) || {
        id: module.categoryId,
        ...meta,
        count: 0,
      };

      current.count += 1;
      stats.set(module.categoryId, current);
    });

    return Array.from(stats.values()).sort(
      (a, b) =>
        a.order - b.order ||
        a.label.localeCompare(b.label) ||
        a.id.localeCompare(b.id),
    );
  }, [modules]);

  function getModuleProgress(module: LearningModule) {
    const entries = savedLessons.filter((entry) => entry.moduleId === module.id);
    const completed = entries.filter(
      (entry) => entry.status === "completed",
    ).length;
    const inProgress = entries.filter(
      (entry) => entry.status === "in_progress",
    ).length;

    return {
      completed,
      inProgress,
      hasProgress: completed > 0 || inProgress > 0,
    };
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Lernstand
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-3xl font-black text-slate-950 dark:text-slate-100">
                {completedCount}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Lektionen gelernt
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-3xl font-black text-slate-950 dark:text-slate-100">
                {inProgressCount}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                in Arbeit
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-3xl font-black text-slate-950 dark:text-slate-100">
                {achievements.length}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">Erfolge</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-3xl font-black text-slate-950 dark:text-slate-100">
                {modules.length}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">Module</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/30">
          <p className="text-sm font-black uppercase tracking-wide text-blue-800 dark:text-blue-300">
            Nächster sinnvoller Schritt
          </p>

          {recommendedModule ? (
            <>
              <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-slate-100">
                {recommendedModule.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                {recommendedModule.subtitle || recommendedModule.description}
              </p>
              <Link
                href={`/lernen/${recommendedModule.slug}`}
                className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
              >
                Modul öffnen
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
              Noch keine Module verfügbar.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Lernpfad
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">
              Drei Stufen vom Einstieg bis zur Prüfung
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              Starte mit Grundlagen, gehe danach in Systemdiagnose und nutze
              die fortgeschrittenen Module für komplexe Fälle und
              Prüfungsvorbereitung.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            Gesamtumfang: {formatMinutes(totalMinutes)}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {LEARNING_LEVELS.map((level, index) => {
            const levelModules = modules.filter(
              (module) => module.difficulty === level.value,
            );

            return (
              <button
                key={level.value}
                type="button"
                onClick={() => setSelectedLevel(level.value)}
                className={`text-left rounded-2xl border p-5 transition hover:-translate-y-0.5 ${
                  selectedLevel === level.value
                    ? "border-blue-500 bg-blue-50 shadow-sm dark:bg-blue-950/30"
                    : "border-slate-200 bg-slate-50 hover:border-blue-300 dark:border-slate-800 dark:bg-slate-950/70"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    {level.label}
                  </p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white dark:bg-slate-100 dark:text-slate-950">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-black text-slate-950 dark:text-slate-100">
                  {level.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {level.description}
                </p>
                <p className="mt-3 text-xs font-bold text-slate-500">
                  {levelModules.length} Module
                </p>
              </button>
            );
          })}
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
            Alle Module anzeigen
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
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Themenbereiche
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categoryStats.map((category) => (
            <div
              key={category.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-950 dark:text-slate-100">
                    {category.label}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {category.description}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {category.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {achievements.length > 0 && (
        <section className="rounded-3xl border border-green-500/20 bg-green-500/10 p-5">
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
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Es wurden noch keine veröffentlichten Lernmodule gefunden.
        </div>
      ) : (
        <section className="space-y-8">
          {visibleLevels.map((level) => {
            const levelModules = modules
              .filter((module) => module.difficulty === level.value)
              .sort((a, b) => a.sortOrder - b.sortOrder);

            if (levelModules.length === 0) {
              return null;
            }

            return (
              <div key={level.value}>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                      {level.label}
                    </p>
                    <h2 className="text-2xl font-black text-slate-950 dark:text-slate-100">
                      {level.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {level.target}
                    </p>
                  </div>

                  <span className="text-sm font-bold text-slate-500">
                    {levelModules.length} Module
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {levelModules.map((module) => {
                    const moduleProgress = getModuleProgress(module);
                    const category = getCategoryMeta(module);

                    return (
                      <Link
                        key={module.id}
                        href={`/lernen/${module.slug}`}
                        className="group flex min-h-72 flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-base font-black text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-500/10 dark:text-blue-300">
                            {module.title?.slice(0, 1) || "L"}
                          </div>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {formatMinutes(module.estimatedMinutes)}
                          </span>
                        </div>

                        <p className="mt-4 text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          {category.label}
                        </p>

                        <h3 className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">
                          {module.title}
                        </h3>

                        <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
                          {module.description}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {getDifficultyLabel(module.difficulty)}
                          </span>

                          {moduleProgress.hasProgress && (
                            <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-700 dark:text-green-300">
                              {moduleProgress.completed > 0
                                ? `${moduleProgress.completed} gelernt`
                                : "begonnen"}
                            </span>
                          )}
                        </div>

                        {(module.relatedFaultCodes.length > 0 ||
                          module.tags.length > 0) && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {[
                              ...module.relatedFaultCodes,
                              ...module.tags.slice(0, 2),
                            ]
                              .slice(0, 4)
                              .map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400"
                                >
                                  {tag}
                                </span>
                              ))}
                          </div>
                        )}

                        <p className="mt-auto pt-5 text-sm font-black text-blue-700 group-hover:text-blue-800 dark:text-blue-300">
                          Modul öffnen
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
