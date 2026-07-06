"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  PLAN_CONFIG,
  getPlanLabel as getConfiguredPlanLabel,
  type UserPlan,
} from "@/config/plans";
import { createClient } from "@/lib/supabase/client";
import type { RelatedLearningModule } from "@/types/learning";
import { fetchJsonWithTimeout } from "@/utils/clientApi";

type RelatedLearningResponse = {
  modules?: RelatedLearningModule[];
  userPlan?: UserPlan;
  error?: string;
};

type RelatedLearningPanelProps = {
  faultCodes: string[];
  parts: string[];
  systems: string[];
};

function normalizeList(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

function getPlanLabel(plan: string) {
  if (plan in PLAN_CONFIG) {
    return getConfiguredPlanLabel(plan);
  }

  return plan;
}

function getDifficultyLabel(difficulty: string) {
  if (difficulty === "basic") return "Grundlage";
  if (difficulty === "intermediate") return "Fortgeschritten";
  if (difficulty === "advanced") return "Experte";
  return difficulty;
}

export default function RelatedLearningPanel({
  faultCodes,
  parts,
  systems,
}: RelatedLearningPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [modules, setModules] = useState<RelatedLearningModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const payload = useMemo(() => {
    return {
      faultCodes: normalizeList(faultCodes),
      parts: normalizeList(parts),
      systems: normalizeList(systems),
      limit: 4,
    };
  }, [faultCodes, parts, systems]);

  const requestKey = JSON.stringify(payload);

  useEffect(() => {
    const hasSearchSignal =
      payload.faultCodes.length > 0 ||
      payload.parts.length > 0 ||
      payload.systems.length > 0;

    if (!hasSearchSignal) {
      const resetTimer = window.setTimeout(() => {
        setModules([]);
        setError("");
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }

    let ignoreResult = false;

    async function loadRelatedLearningModules() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error(
            "Bitte einloggen, um passende Lerninhalte zum Diagnosefall zu laden."
          );
        }

        const { response, data } =
          await fetchJsonWithTimeout<RelatedLearningResponse>(
            "/api/lernen/related",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: requestKey,
            },
            15000
          );

        if (ignoreResult) {
          return;
        }

        if (!response.ok) {
          throw new Error(
            data.error || "Passende Lerninhalte konnten nicht geladen werden."
          );
        }

        setModules(data.modules || []);
      } catch (error) {
        if (ignoreResult) {
          return;
        }

        console.error(error);
        setError(
          error instanceof Error
            ? error.message
            : "Passende Lerninhalte konnten nicht geladen werden."
        );
      } finally {
        if (!ignoreResult) {
          setLoading(false);
        }
      }
    }

    void loadRelatedLearningModules();

    return () => {
      ignoreResult = true;
    };
  }, [requestKey, payload, supabase.auth]);

  if (!loading && modules.length === 0 && !error) {
    return null;
  }

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-400">
            Passende Lerninhalte
          </p>

          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-slate-100">
            Zum Diagnosefall lernen
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            DiagnoseHUB sucht anhand von Fehlercodes, Bauteilen und Systemen
            passende Lernmodule.
          </p>
        </div>

        <Link
          href="/lernen"
          className="text-sm font-bold text-blue-700 hover:text-blue-500 dark:text-blue-400"
        >
          Alle Lerninhalte öffnen →
        </Link>
      </div>

      {loading && (
        <div className="mt-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm font-semibold text-blue-700 dark:text-blue-300">
          Passende Lernmodule werden gesucht...
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {modules.length > 0 && (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => (
            <Link
              key={module.id}
              href={`/lernen/${module.slug}`}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
            >
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  {getDifficultyLabel(module.difficulty)}
                </span>

                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {getPlanLabel(module.requiredPlan)}
                </span>

                {module.isLocked && (
                  <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-yellow-700 dark:text-yellow-300">
                    Gesperrt
                  </span>
                )}
              </div>

              <h3 className="mt-4 text-lg font-black text-slate-950 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
                {module.title}
              </h3>

              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {module.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {module.matchedFaultCodes.map((code) => (
                  <span
                    key={code}
                    className="rounded-full bg-blue-500/10 px-2 py-1 font-bold text-blue-700 dark:text-blue-300"
                  >
                    {code}
                  </span>
                ))}

                {module.matchedParts.slice(0, 2).map((part) => (
                  <span
                    key={part}
                    className="rounded-full bg-green-500/10 px-2 py-1 font-bold text-green-700 dark:text-green-300"
                  >
                    {part}
                  </span>
                ))}

                {module.matchedSystems.slice(0, 2).map((system) => (
                  <span
                    key={system}
                    className="rounded-full bg-slate-200 px-2 py-1 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {system}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
