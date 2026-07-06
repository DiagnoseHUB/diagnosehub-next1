"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PLAN_CONFIG, type UserPlan } from "@/config/plans";
import { createClient } from "@/lib/supabase/client";
import { fetchJsonWithTimeout } from "@/utils/clientApi";

type AccessFeature = "learning" | "componentKnowledge";

type PlanAccessGateProps = {
  feature: AccessFeature;
  children: ReactNode;
};

type PlanApiResponse = {
  plan?: UserPlan;
  planLabel?: string;
  learningAccess?: boolean;
  componentKnowledgeAccess?: boolean;
  error?: string;
};

function getFeatureLabel(feature: AccessFeature) {
  if (feature === "componentKnowledge") {
    return "Bauteilwissen";
  }

  return "Lernen";
}

function hasFeatureAccess(feature: AccessFeature, data: PlanApiResponse) {
  if (feature === "componentKnowledge") {
    return data.componentKnowledgeAccess === true;
  }

  return data.learningAccess === true;
}

export default function PlanAccessGate({
  feature,
  children,
}: PlanAccessGateProps) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [planLabel, setPlanLabel] = useState(PLAN_CONFIG.free.label);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignoreResult = false;

    async function loadPlanAccess() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Bitte zuerst einloggen.");
        }

        const { response, data } = await fetchJsonWithTimeout<PlanApiResponse>(
          "/api/account/plan",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
          12000
        );

        if (!response.ok) {
          throw new Error(data.error || "Plan konnte nicht geladen werden.");
        }

        if (ignoreResult) {
          return;
        }

        setPlanLabel(data.planLabel || PLAN_CONFIG[data.plan || "free"].label);
        setAccessAllowed(hasFeatureAccess(feature, data));
      } catch (error) {
        if (ignoreResult) {
          return;
        }

        setAccessAllowed(false);
        setError(
          error instanceof Error
            ? error.message
            : "Plan konnte nicht geladen werden."
        );
      } finally {
        if (!ignoreResult) {
          setLoading(false);
        }
      }
    }

    void loadPlanAccess();

    return () => {
      ignoreResult = true;
    };
  }, [feature, supabase.auth]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6 text-sm font-bold text-blue-800 dark:text-blue-200">
        Zugang wird geprüft...
      </div>
    );
  }

  if (!accessAllowed) {
    return (
      <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-6 text-yellow-950 dark:text-yellow-100">
        <p className="text-sm font-black uppercase tracking-wide">
          {getFeatureLabel(feature)} gesperrt
        </p>
        <h1 className="mt-3 text-2xl font-black">
          In deinem aktuellen Plan nicht enthalten
        </h1>
        <p className="mt-3 leading-7">
          Aktiver Plan: <strong>{planLabel}</strong>. Für diesen Bereich
          brauchst du Komplett 150 oder Unlimited.
        </p>
        {error && <p className="mt-2 text-sm font-semibold">{error}</p>}
        <Link
          href="/preise"
          className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
        >
          Tarife ansehen
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
