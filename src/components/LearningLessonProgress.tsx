"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { LearningDifficulty, LearningProgressStatus } from "@/types/learning";
import {
  getLearningProgressServerSnapshot,
  getLearningProgressSnapshot,
  parseLearningProgressSnapshot,
  saveLocalLessonProgress,
  subscribeLearningProgress,
  type LessonProgressInput,
} from "@/lib/learningProgressLocal";

type LearningLessonProgressProps = {
  lesson: LessonProgressInput;
  estimatedMinutes: number;
};

function getDifficultyLabel(difficulty: LearningDifficulty) {
  if (difficulty === "basic") return "Stufe 1: Grundlagen";
  if (difficulty === "intermediate") return "Stufe 2: Fortgeschritten";
  return "Stufe 3: Profi";
}

function getStatusLabel(status?: LearningProgressStatus) {
  if (status === "completed") return "Gelernt";
  if (status === "in_progress") return "In Arbeit";
  return "Noch nicht begonnen";
}

function getStatusClass(status?: LearningProgressStatus) {
  if (status === "completed") {
    return "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300";
  }

  if (status === "in_progress") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  }

  return "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300";
}

export default function LearningLessonProgress({
  lesson,
  estimatedMinutes,
}: LearningLessonProgressProps) {
  const snapshot = useSyncExternalStore(
    subscribeLearningProgress,
    getLearningProgressSnapshot,
    getLearningProgressServerSnapshot,
  );

  const progressStore = useMemo(
    () => parseLearningProgressSnapshot(snapshot),
    [snapshot],
  );

  const progress = progressStore.lessons[lesson.lessonId];
  const progressPercent = progress?.progressPercent || 0;
  const isCompleted = progress?.status === "completed";

  function markInProgress() {
    saveLocalLessonProgress(lesson, "in_progress");
  }

  function markCompleted() {
    saveLocalLessonProgress(lesson, "completed");
  }

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              {getDifficultyLabel(lesson.difficulty)}
            </span>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${getStatusClass(
                progress?.status,
              )}`}
            >
              {getStatusLabel(progress?.status)}
            </span>

            <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              ca. {estimatedMinutes} Min.
            </span>
          </div>

          <h2 className="mt-3 text-xl font-black text-slate-950 dark:text-slate-100">
            Dein Lernfortschritt
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Speichere, ob du diese Lektion begonnen oder gelernt hast. Der
            Fortschritt bleibt lokal in diesem Browser erhalten.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={markInProgress}
            disabled={isCompleted}
            className="rounded-xl border border-blue-500/40 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300"
          >
            Begonnen speichern
          </button>

          <button
            type="button"
            onClick={markCompleted}
            className="rounded-xl bg-green-600 px-4 py-3 text-sm font-black text-white transition hover:bg-green-500"
          >
            Als gelernt speichern
          </button>
        </div>
      </div>

      <div className="mt-5">
        <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          {progressPercent} % gespeichert
          {progress?.completedAt
            ? ` - gelernt am ${new Date(progress.completedAt).toLocaleDateString(
                "de-DE",
              )}`
            : ""}
        </p>
      </div>
    </section>
  );
}
