"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { PLAN_CONFIG } from "@/config/plans";
import type { LearningLesson, LearningProgressStatus } from "@/types/learning";
import {
  getLearningProgressServerSnapshot,
  getLearningProgressSnapshot,
  parseLearningProgressSnapshot,
  subscribeLearningProgress,
} from "@/lib/learningProgressLocal";

type LearningLessonListProps = {
  lessons: LearningLesson[];
};

function getPlanLabel(plan: string) {
  return PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]?.label || plan;
}

function getStatusLabel(status?: LearningProgressStatus) {
  if (status === "completed") return "Gelernt";
  if (status === "in_progress") return "In Arbeit";
  return "Offen";
}

function getStatusClass(status?: LearningProgressStatus) {
  if (status === "completed") {
    return "bg-green-500/10 text-green-700 dark:text-green-300";
  }

  if (status === "in_progress") {
    return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  }

  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
}

export default function LearningLessonList({ lessons }: LearningLessonListProps) {
  const snapshot = useSyncExternalStore(
    subscribeLearningProgress,
    getLearningProgressSnapshot,
    getLearningProgressServerSnapshot,
  );

  const progressStore = useMemo(
    () => parseLearningProgressSnapshot(snapshot),
    [snapshot],
  );

  const completedCount = lessons.filter(
    (lesson) => progressStore.lessons[lesson.id]?.status === "completed",
  ).length;

  const inProgressCount = lessons.filter(
    (lesson) => progressStore.lessons[lesson.id]?.status === "in_progress",
  ).length;

  const progressPercent =
    lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  if (lessons.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        Noch keine veroeffentlichten Lektionen vorhanden.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black text-slate-950 dark:text-slate-100">
              Modulfortschritt: {completedCount} von {lessons.length} gelernt
            </p>

            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              {inProgressCount} in Arbeit
            </p>
          </div>

          <span className="rounded-full bg-green-500/10 px-3 py-1 text-sm font-black text-green-700 dark:text-green-300">
            {progressPercent} %
          </span>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4">
        {lessons.map((lesson, index) => {
          const progress = progressStore.lessons[lesson.id];

          return (
            <Link
              key={lesson.id}
              href={`/lernen/${lesson.slug}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-400">
                    Lektion {index + 1}
                  </p>

                  <h3 className="mt-1 text-xl font-black text-slate-950 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
                    {lesson.title}
                  </h3>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {lesson.summary || lesson.subtitle}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(
                      progress?.status,
                    )}`}
                  >
                    {getStatusLabel(progress?.status)}
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {lesson.estimatedMinutes} Min.
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {getPlanLabel(lesson.requiredPlan)}
                  </span>

                  {lesson.isLocked && (
                    <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-700 dark:text-yellow-300">
                      Gesperrt
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
