"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import type { LearningDifficulty, LearningModule } from "@/types/learning";
import {
  getLearningProgressServerSnapshot,
  getLearningProgressSnapshot,
  parseLearningProgressSnapshot,
  subscribeLearningProgress,
} from "@/lib/learningProgressLocal";

type LearningStudyCockpitProps = {
  modules: LearningModule[];
};

type StudyTask = {
  label: string;
  title: string;
  description: string;
  href: string;
  time: string;
};

const CATEGORY_META: Record<
  string,
  {
    label: string;
    description: string;
    order: number;
  }
> = {
  "local-cat-diagnose": {
    label: "Diagnose",
    description: "Auftrag, Symptom, Prüfziel, Messlogik und Abschlussprüfung.",
    order: 10,
  },
  "local-cat-elektrik": {
    label: "Elektrik",
    description: "Spannung, Masse, Signal, Sensoren, Aktoren und Bordnetz.",
    order: 20,
  },
  "local-cat-motor": {
    label: "Motor & Abgas",
    description: "Gemisch, Ladedruck, AGR, DPF, Lambda und Systemlogik.",
    order: 30,
  },
  "local-cat-fahrwerk": {
    label: "Bremse & Fahrwerk",
    description: "Sicherheitsprüfung, ABS/ESP, Verschleißbild und Raddrehzahl.",
    order: 40,
  },
  "local-cat-klima": {
    label: "Klima",
    description: "Druck, Temperatur, Luftführung, Kühlung und Thermomanagement.",
    order: 50,
  },
  "local-cat-prüfung": {
    label: "Prüfung",
    description: "Gesellenprüfung, Fachgespräch, Kundenauftrag und Bewertung.",
    order: 60,
  },
};

const PRACTICE_BLOCKS = [
  {
    title: "Diagnosefall",
    description:
      "Symptom lesen, mögliche Ursachen trennen und erst dann Messwerte einordnen.",
    href: "#falltraining",
    label: "Praxis",
  },
  {
    title: "Bauteilwissen",
    description:
      "Aufbau, Bauteil im Bauteil, Zusammenspiel und Prüfweg erklären lassen.",
    href: "/lernen/wissen",
    label: "Wissen",
  },
  {
    title: "Prüfungsrunde",
    description:
      "Fragen beantworten, Begründung prüfen und typische Fachgespräch-Sätze trainieren.",
    href: "/lernen/quiz",
    label: "Quiz",
  },
];

function getCategoryMeta(module: LearningModule) {
  return (
    CATEGORY_META[module.categoryId] || {
      label: "Weitere Inhalte",
      description: "Zusätzliche Lernmodule und Querverbindungen.",
      order: 999,
    }
  );
}

function getDifficultyLabel(difficulty: LearningDifficulty) {
  if (difficulty === "basic") return "Grundlagen";
  if (difficulty === "intermediate") return "Systemdiagnose";
  return "Prüfung";
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} Min.`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest > 0 ? `${hours} Std. ${rest} Min.` : `${hours} Std.`;
}

function uniqueTasks(tasks: StudyTask[]) {
  const seen = new Set<string>();

  return tasks.filter((task) => {
    if (seen.has(task.href)) {
      return false;
    }

    seen.add(task.href);
    return true;
  });
}

export default function LearningStudyCockpit({
  modules,
}: LearningStudyCockpitProps) {
  const snapshot = useSyncExternalStore(
    subscribeLearningProgress,
    getLearningProgressSnapshot,
    getLearningProgressServerSnapshot,
  );

  const progressStore = useMemo(
    () => parseLearningProgressSnapshot(snapshot),
    [snapshot],
  );

  const cockpit = useMemo(() => {
    const lessonEntries = Object.values(progressStore.lessons).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    const achievements = Object.values(progressStore.achievements);
    const activeModuleIds = new Set(
      lessonEntries
        .filter(
          (entry) =>
            entry.status === "in_progress" || entry.status === "completed",
        )
        .map((entry) => entry.moduleId),
    );
    const completedLessonCount = lessonEntries.filter(
      (entry) => entry.status === "completed",
    ).length;
    const inProgressLesson = lessonEntries.find(
      (entry) => entry.status === "in_progress",
    );
    const nextBasicModule = modules.find(
      (module) =>
        module.difficulty === "basic" && !activeModuleIds.has(module.id),
    );
    const fallbackModule =
      nextBasicModule ||
      modules.find((module) => !activeModuleIds.has(module.id)) ||
      modules[0];
    const totalMinutes = modules.reduce(
      (sum, module) => sum + module.estimatedMinutes,
      0,
    );

    const categories = Array.from(
      modules
        .reduce((map, module) => {
          const meta = getCategoryMeta(module);
          const current = map.get(module.categoryId) || {
            id: module.categoryId,
            label: meta.label,
            description: meta.description,
            order: meta.order,
            modules: [] as LearningModule[],
          };

          current.modules.push(module);
          map.set(module.categoryId, current);

          return map;
        }, new Map<string, { id: string; label: string; description: string; order: number; modules: LearningModule[] }>())
        .values(),
    )
      .map((category) => {
        const categoryModuleIds = new Set(
          category.modules.map((module) => module.id),
        );
        const activeModules = category.modules.filter((module) =>
          activeModuleIds.has(module.id),
        );
        const learnedLessons = lessonEntries.filter(
          (entry) =>
            categoryModuleIds.has(entry.moduleId) &&
            entry.status === "completed",
        ).length;
        const nextModule =
          category.modules.find((module) => !activeModuleIds.has(module.id)) ||
          category.modules[0];
        const coveragePercent =
          category.modules.length > 0
            ? Math.round((activeModules.length / category.modules.length) * 100)
            : 0;

        return {
          ...category,
          activeModules: activeModules.length,
          learnedLessons,
          nextModule,
          coveragePercent,
        };
      })
      .sort(
        (a, b) =>
          a.order - b.order ||
          a.label.localeCompare(b.label) ||
          a.id.localeCompare(b.id),
      );

    const weakestCategory = [...categories]
      .filter((category) => category.modules.length > 0)
      .sort(
        (a, b) =>
          a.coveragePercent - b.coveragePercent ||
          a.learnedLessons - b.learnedLessons ||
          a.order - b.order,
      )[0];

    const tasks = uniqueTasks(
      [
        inProgressLesson
          ? {
              label: "Weiterlernen",
              title: inProgressLesson.lessonTitle,
              description: `${inProgressLesson.moduleTitle} fortsetzen und als gelernt markieren, wenn der Prüfweg sitzt.`,
              href: `/lernen/${inProgressLesson.lessonSlug}`,
              time: "15-25 Min.",
            }
          : fallbackModule
            ? {
                label: "Start",
                title: fallbackModule.title,
                description:
                  fallbackModule.subtitle ||
                  "Ein Modul beginnen und die erste Lektion sauber durcharbeiten.",
                href: `/lernen/${fallbackModule.slug}`,
                time: formatMinutes(Math.min(fallbackModule.estimatedMinutes, 45)),
              }
            : null,
        weakestCategory?.nextModule
          ? {
              label: "Lücke schließen",
              title: weakestCategory.nextModule.title,
              description: `${weakestCategory.label} gezielt stärken: ${weakestCategory.description}`,
              href: `/lernen/${weakestCategory.nextModule.slug}`,
              time: "20-40 Min.",
            }
          : null,
        {
          label: "Wiederholen",
          title: "10 Prüfungsfragen beantworten",
          description:
            "Antwort begründen, Erklärung lesen und falsche Entscheidungen direkt notieren.",
          href: "/lernen/quiz",
          time: "10 Min.",
        },
        {
          label: "Prüfung",
          title: "Einen Werkstattfall ausformulieren",
          description:
            "Symptom, Ursachen, Prüfplan, Messwerte und Abschlussprüfung wie im Fachgespräch erklären.",
          href: "/lernen/gesellenpruefung",
          time: "25 Min.",
        },
      ].filter(Boolean) as StudyTask[],
    ).slice(0, 4);

    return {
      activeModuleCount: activeModuleIds.size,
      completedLessonCount,
      achievementCount: achievements.length,
      totalMinutes,
      categories,
      tasks,
      progressPercent:
        modules.length > 0
          ? Math.round((activeModuleIds.size / modules.length) * 100)
          : 0,
    };
  }, [modules, progressStore]);

  return (
    <section className="mt-8">
      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Lerncockpit
          </p>
          <h2 className="text-3xl font-black text-slate-950 dark:text-slate-100">
            Dein nächster sinnvoller Lernschritt
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            DiagnoseHUB verbindet Lernmodule, Quiz, Bauteilwissen und
            Diagnosefälle zu einem geführten Ausbildungsweg.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Gesamtumfang: {formatMinutes(cockpit.totalMinutes)}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Lernstand
              </p>
              <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">
                {cockpit.progressPercent} % der Module berührt
              </h3>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              lokal gespeichert
            </span>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${cockpit.progressPercent}%` }}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-3xl font-black text-slate-950 dark:text-slate-100">
                {cockpit.activeModuleCount}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                aktive Module
              </p>
            </div>

            <div>
              <p className="text-3xl font-black text-slate-950 dark:text-slate-100">
                {cockpit.completedLessonCount}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                gelernte Lektionen
              </p>
            </div>

            <div>
              <p className="text-3xl font-black text-slate-950 dark:text-slate-100">
                {cockpit.achievementCount}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">Erfolge</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Heute lernen
          </p>

          <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
            {cockpit.tasks.map((task) => (
              <Link
                key={`${task.label}-${task.href}`}
                href={task.href}
                className="group grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr_auto] sm:items-center"
              >
                <span className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  {task.label}
                </span>

                <span>
                  <span className="block font-black text-slate-950 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
                    {task.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {task.description}
                  </span>
                </span>

                <span className="text-sm font-bold text-slate-500">
                  {task.time}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cockpit.categories.map((category) => (
          <div
            key={category.id}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Kompetenzfeld
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">
                  {category.label}
                </h3>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {category.coveragePercent} %
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {category.description}
            </p>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-slate-900 transition-all dark:bg-slate-100"
                style={{ width: `${category.coveragePercent}%` }}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
              <span>{category.modules.length} Module</span>
              <span>{category.activeModules} aktiv</span>
              <span>{category.learnedLessons} Lektionen gelernt</span>
            </div>

            {category.nextModule && (
              <Link
                href={`/lernen/${category.nextModule.slug}`}
                className="mt-4 inline-flex text-sm font-black text-blue-700 hover:text-blue-500 dark:text-blue-300"
              >
                Weiter mit {getDifficultyLabel(category.nextModule.difficulty)}
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {PRACTICE_BLOCKS.map((block) => (
          <Link
            key={block.href}
            href={block.href}
            className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80"
          >
            <span className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
              {block.label}
            </span>
            <h3 className="mt-2 text-lg font-black text-slate-950 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
              {block.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {block.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
