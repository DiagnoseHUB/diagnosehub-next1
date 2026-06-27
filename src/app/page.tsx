"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import {
  deleteDiagnosisCaseFromSupabase,
  loadDiagnosisCasesFromSupabase,
  migrateLocalDiagnosisCasesToSupabase,
  type SavedDiagnosisCase,
} from "@/services/diagnosisCasesSupabase";
import {
  getInitialDiagnosisUsage,
  loadDiagnosisUsageFromSupabase,
  normalizeDiagnosisUsage,
  resetDiagnosisUsageInSupabase,
  type DiagnosisUsage,
} from "@/services/diagnosisUsageSupabase";
import {
  deletePremiumLeadFromSupabase,
  loadPremiumLeadsFromSupabase,
  migrateLocalPremiumLeadsToSupabase,
  type PremiumLead,
  type PremiumPlan,
} from "@/services/premiumLeadsSupabase";

type UserPlan = "free" | "werkstatt" | "pro";

type DataSource = "local" | "supabase";
type ProfileSource = "localStorage" | "supabase" | "fallback";

type DemoAccount = {
  name: string;
  workshop: string;
  email: string;
  role: string;
  plan: UserPlan;
  updatedAt: string;
  supabaseUserId?: string;
};

type WorkshopProfileDatabaseRow = {
  id: string;
  full_name: string;
  workshop_name: string;
  email: string;
  role: string;
  plan: UserPlan;
  created_at: string;
  updated_at: string;
};

type WorkshopData = {
  name: string;
  workshop: string;
  email: string;
  role: string;
  plan: UserPlan;
  updatedAt: string;
  source: ProfileSource;
};

const DEMO_ACCOUNT_STORAGE_KEY = "diagnosehub-demo-account";
const USER_PLAN_STORAGE_KEY = "diagnosehub-user-plan";
const SAVED_CASES_STORAGE_KEY = "diagnosehub-saved-cases";
const CURRENT_CASE_STORAGE_KEY = "diagnosehub-current-case";
const DIAGNOSIS_USAGE_STORAGE_KEY = "diagnosehub-diagnosis-usage";
const PREMIUM_LEADS_STORAGE_KEY = "diagnosehub-premium-leads";

const legacyUsageStorageKeys = [
  "diagnosehub-diagnosis-usage",
  "diagnosehub-usage",
];

const planLabels: Record<UserPlan, string> = {
  free: "Free",
  werkstatt: "Werkstatt Demo",
  pro: "Werkstatt Pro Demo",
};

const premiumLeadPlanLabels: Record<PremiumPlan, string> = {
  werkstatt: "Werkstatt",
  pro: "Pro",
};

const dataSourceLabels: Record<DataSource, string> = {
  local: "Lokal",
  supabase: "Supabase",
};

const profileSourceLabels: Record<ProfileSource, string> = {
  localStorage: "Lokaler Fallback",
  supabase: "Supabase Datenbank",
  fallback: "Fallback",
};

const defaultWorkshopData: WorkshopData = {
  name: "Nicht hinterlegt",
  workshop: "Nicht hinterlegt",
  email: "Nicht hinterlegt",
  role: "Werkstatt",
  plan: "free",
  updatedAt: "",
  source: "fallback",
};

function isValidUserPlan(value: string | null): value is UserPlan {
  return value === "free" || value === "werkstatt" || value === "pro";
}

function formatDateTime(value?: string) {
  if (!value) {
    return "nicht vorhanden";
  }

  try {
    return new Date(value).toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function formatDate(value?: string) {
  if (!value) {
    return "nicht vorhanden";
  }

  try {
    return new Date(value).toLocaleDateString("de-DE", {
      dateStyle: "medium",
    });
  } catch {
    return value;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unbekannter Fehler";
}

function loadLocalAccount(): DemoAccount | null {
  try {
    const savedAccount = localStorage.getItem(DEMO_ACCOUNT_STORAGE_KEY);

    if (!savedAccount) {
      return null;
    }

    return JSON.parse(savedAccount) as DemoAccount;
  } catch (error) {
    console.error("Lokaler Account konnte nicht geladen werden:", error);
    return null;
  }
}

function getLocalPlan(): UserPlan {
  try {
    const savedPlan = localStorage.getItem(USER_PLAN_STORAGE_KEY);

    if (isValidUserPlan(savedPlan)) {
      return savedPlan;
    }

    const localAccount = loadLocalAccount();

    if (localAccount && isValidUserPlan(localAccount.plan)) {
      return localAccount.plan;
    }
  } catch (error) {
    console.error("Lokaler Plan konnte nicht geladen werden:", error);
  }

  return "free";
}

function getLocalWorkshopData(): WorkshopData {
  const localAccount = loadLocalAccount();
  const localPlan = getLocalPlan();

  if (!localAccount) {
    return {
      ...defaultWorkshopData,
      plan: localPlan,
      source: localPlan === "free" ? "fallback" : "localStorage",
    };
  }

  return {
    name: localAccount.name || defaultWorkshopData.name,
    workshop: localAccount.workshop || defaultWorkshopData.workshop,
    email: localAccount.email || defaultWorkshopData.email,
    role: localAccount.role || defaultWorkshopData.role,
    plan: isValidUserPlan(localAccount.plan) ? localAccount.plan : localPlan,
    updatedAt: localAccount.updatedAt || "",
    source: "localStorage",
  };
}

function syncWorkshopProfileToLocalStorage(profile: WorkshopProfileDatabaseRow) {
  const localAccount: DemoAccount = {
    name: profile.full_name,
    workshop: profile.workshop_name,
    email: profile.email,
    role: profile.role,
    plan: profile.plan,
    updatedAt: profile.updated_at,
    supabaseUserId: profile.id,
  };

  localStorage.setItem(DEMO_ACCOUNT_STORAGE_KEY, JSON.stringify(localAccount));
  localStorage.setItem(USER_PLAN_STORAGE_KEY, profile.plan);
}

function loadLocalDiagnosisCases(): SavedDiagnosisCase[] {
  try {
    const savedCases = localStorage.getItem(SAVED_CASES_STORAGE_KEY);

    if (!savedCases) {
      return [];
    }

    const parsedCases = JSON.parse(savedCases);

    if (!Array.isArray(parsedCases)) {
      return [];
    }

    return parsedCases as SavedDiagnosisCase[];
  } catch (error) {
    console.error("Lokale Diagnosefälle konnten nicht geladen werden:", error);
    return [];
  }
}

function saveDiagnosisCasesToLocalStorage(cases: SavedDiagnosisCase[]) {
  localStorage.setItem(SAVED_CASES_STORAGE_KEY, JSON.stringify(cases));
}

function loadLocalDiagnosisUsage(): DiagnosisUsage {
  try {
    for (const storageKey of legacyUsageStorageKeys) {
      const savedUsage = localStorage.getItem(storageKey);

      if (!savedUsage) {
        continue;
      }

      const parsedUsage = JSON.parse(savedUsage) as Partial<DiagnosisUsage>;

      if (
        typeof parsedUsage.date === "string" &&
        typeof parsedUsage.count === "number"
      ) {
        return normalizeDiagnosisUsage({
          date: parsedUsage.date,
          count: parsedUsage.count,
        });
      }
    }
  } catch (error) {
    console.error("Lokale Nutzung konnte nicht geladen werden:", error);
  }

  return getInitialDiagnosisUsage();
}

function saveDiagnosisUsageToLocalStorage(usage: DiagnosisUsage) {
  localStorage.setItem(DIAGNOSIS_USAGE_STORAGE_KEY, JSON.stringify(usage));
}

function loadLocalPremiumLeads(): PremiumLead[] {
  try {
    const savedLeads = localStorage.getItem(PREMIUM_LEADS_STORAGE_KEY);

    if (!savedLeads) {
      return [];
    }

    const parsedLeads = JSON.parse(savedLeads);

    if (!Array.isArray(parsedLeads)) {
      return [];
    }

    return parsedLeads as PremiumLead[];
  } catch (error) {
    console.error("Lokale Premium-Vormerkungen konnten nicht geladen werden:", error);
    return [];
  }
}

function savePremiumLeadsToLocalStorage(leads: PremiumLead[]) {
  localStorage.setItem(PREMIUM_LEADS_STORAGE_KEY, JSON.stringify(leads));
}

function DashboardCard({
  title,
  value,
  description,
  children,
}: {
  title: string;
  value: ReactNode;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-blue-950/20">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <div className="mt-3 text-3xl font-black text-white">{value}</div>

      {description && (
        <p className="mt-3 leading-7 text-slate-400">{description}</p>
      )}

      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

function Section({
  title,
  description,
  right,
  children,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-blue-950/20">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">{title}</h2>
          {description && (
            <p className="mt-2 max-w-3xl leading-7 text-slate-400">
              {description}
            </p>
          )}
        </div>

        {right && <div className="flex flex-wrap gap-3">{right}</div>}
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}

function SourceBadge({ source }: { source: DataSource }) {
  return (
    <span
      className={
        source === "supabase"
          ? "rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-300"
          : "rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-300"
      }
    >
      {dataSourceLabels[source]}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center text-slate-400">
      {text}
    </div>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [workshopData, setWorkshopData] =
    useState<WorkshopData>(defaultWorkshopData);

  const [diagnosisCases, setDiagnosisCases] = useState<SavedDiagnosisCase[]>(
    []
  );
  const [diagnosisUsage, setDiagnosisUsage] = useState<DiagnosisUsage>(
    getInitialDiagnosisUsage()
  );
  const [premiumLeads, setPremiumLeads] = useState<PremiumLead[]>([]);

  const [caseSource, setCaseSource] = useState<DataSource>("local");
  const [usageSource, setUsageSource] = useState<DataSource>("local");
  const [leadSource, setLeadSource] = useState<DataSource>("local");

  const [profileLoading, setProfileLoading] = useState(true);
  const [caseLoading, setCaseLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [leadLoading, setLeadLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isLoading =
    profileLoading || caseLoading || usageLoading || leadLoading;

  useEffect(() => {
    void loadDashboard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, nextSession: Session | null) => {
        await loadDashboard(nextSession);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  function setLocalFallbackData() {
    const localWorkshopData = getLocalWorkshopData();
    const localCases = loadLocalDiagnosisCases();
    const localUsage = loadLocalDiagnosisUsage();
    const localLeads = loadLocalPremiumLeads();

    setWorkshopData(localWorkshopData);
    setDiagnosisCases(localCases);
    setDiagnosisUsage(localUsage);
    setPremiumLeads(localLeads);

    setCaseSource("local");
    setUsageSource("local");
    setLeadSource("local");
  }

  async function loadDashboard(existingSession?: Session | null) {
    setError("");
    setSuccess("");
    setProfileLoading(true);
    setCaseLoading(true);
    setUsageLoading(true);
    setLeadLoading(true);

    try {
      setLocalFallbackData();

      const session =
        existingSession ??
        (await supabase.auth.getSession()).data.session ??
        null;

      if (!session?.user) {
        setUser(null);
        return;
      }

      setUser(session.user);

      await Promise.all([
        loadWorkshopProfile(session.user),
        loadSupabaseCases(session.user, false),
        loadSupabaseUsage(session.user),
        loadSupabasePremiumLeads(session.user, false),
      ]);
    } catch (error) {
      console.error("Dashboard konnte nicht geladen werden:", error);
      setError(`Dashboard konnte nicht geladen werden: ${getErrorMessage(error)}`);
      setLocalFallbackData();
    } finally {
      setProfileLoading(false);
      setCaseLoading(false);
      setUsageLoading(false);
      setLeadLoading(false);
    }
  }

  async function loadWorkshopProfile(currentUser: User) {
    try {
      const { data, error } = await supabase
        .from("workshop_profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        const fallbackWorkshopData = getLocalWorkshopData();

        setWorkshopData({
          ...fallbackWorkshopData,
          email: currentUser.email || fallbackWorkshopData.email,
        });

        return;
      }

      const profile = data as WorkshopProfileDatabaseRow;

      setWorkshopData({
        name: profile.full_name,
        workshop: profile.workshop_name,
        email: profile.email,
        role: profile.role,
        plan: profile.plan,
        updatedAt: profile.updated_at,
        source: "supabase",
      });

      syncWorkshopProfileToLocalStorage(profile);
    } catch (error) {
      console.error("Werkstattprofil konnte nicht geladen werden:", error);
      setError(
        `Werkstattprofil konnte nicht aus Supabase geladen werden: ${getErrorMessage(
          error
        )}`
      );
      setWorkshopData(getLocalWorkshopData());
    }
  }

  async function loadSupabaseCases(currentUser: User, migrateLocal: boolean) {
    setCaseLoading(true);

    try {
      const localCases = loadLocalDiagnosisCases();

      if (migrateLocal && localCases.length > 0) {
        await migrateLocalDiagnosisCasesToSupabase(
          supabase,
          currentUser,
          localCases
        );
      }

      const remoteCases = await loadDiagnosisCasesFromSupabase(
        supabase,
        currentUser
      );

      setDiagnosisCases(remoteCases);
      saveDiagnosisCasesToLocalStorage(remoteCases);
      setCaseSource("supabase");
    } catch (error) {
      console.error("Diagnosefälle konnten nicht geladen werden:", error);
      setError(
        `Diagnosefälle konnten nicht aus Supabase geladen werden: ${getErrorMessage(
          error
        )}`
      );
      setDiagnosisCases(loadLocalDiagnosisCases());
      setCaseSource("local");
    } finally {
      setCaseLoading(false);
    }
  }

  async function loadSupabaseUsage(currentUser: User) {
    setUsageLoading(true);

    try {
      const remoteUsage = await loadDiagnosisUsageFromSupabase(
        supabase,
        currentUser
      );

      setDiagnosisUsage(remoteUsage);
      saveDiagnosisUsageToLocalStorage(remoteUsage);
      setUsageSource("supabase");
    } catch (error) {
      console.error("Nutzungszähler konnte nicht geladen werden:", error);
      setError(
        `Nutzungszähler konnte nicht aus Supabase geladen werden: ${getErrorMessage(
          error
        )}`
      );
      setDiagnosisUsage(loadLocalDiagnosisUsage());
      setUsageSource("local");
    } finally {
      setUsageLoading(false);
    }
  }

  async function loadSupabasePremiumLeads(
    currentUser: User,
    migrateLocal: boolean
  ) {
    setLeadLoading(true);

    try {
      const localLeads = loadLocalPremiumLeads();

      if (migrateLocal && localLeads.length > 0) {
        await migrateLocalPremiumLeadsToSupabase(
          supabase,
          currentUser,
          localLeads
        );
      }

      const remoteLeads = await loadPremiumLeadsFromSupabase(
        supabase,
        currentUser
      );

      setPremiumLeads(remoteLeads);
      savePremiumLeadsToLocalStorage(remoteLeads);
      setLeadSource("supabase");
    } catch (error) {
      console.error("Premium-Vormerkungen konnten nicht geladen werden:", error);
      setError(
        `Premium-Vormerkungen konnten nicht aus Supabase geladen werden: ${getErrorMessage(
          error
        )}`
      );
      setPremiumLeads(loadLocalPremiumLeads());
      setLeadSource("local");
    } finally {
      setLeadLoading(false);
    }
  }

  async function refreshAllSupabaseData() {
    if (!user) {
      setError("Du bist nicht eingeloggt. Dashboard nutzt lokale Daten.");
      return;
    }

    setSuccess("");
    setError("");

    await Promise.all([
      loadWorkshopProfile(user),
      loadSupabaseCases(user, false),
      loadSupabaseUsage(user),
      loadSupabasePremiumLeads(user, false),
    ]);

    setSuccess("Dashboard wurde aus Supabase neu geladen.");
  }

  async function migrateLocalCasesNow() {
    if (!user) {
      setError("Zum Migrieren musst du eingeloggt sein.");
      return;
    }

    setSuccess("");
    setError("");

    await loadSupabaseCases(user, true);
    setSuccess("Lokale Diagnosefälle wurden nach Supabase migriert.");
  }

  async function migrateLocalPremiumLeadsNow() {
    if (!user) {
      setError("Zum Migrieren musst du eingeloggt sein.");
      return;
    }

    setSuccess("");
    setError("");

    await loadSupabasePremiumLeads(user, true);
    setSuccess("Lokale Premium-Vormerkungen wurden nach Supabase migriert.");
  }

  async function resetUsageCounter() {
    setSuccess("");
    setError("");

    try {
      if (user && usageSource === "supabase") {
        const nextUsage = await resetDiagnosisUsageInSupabase(supabase, user);

        setDiagnosisUsage(nextUsage);
        saveDiagnosisUsageToLocalStorage(nextUsage);
        setSuccess("Nutzungszähler wurde in Supabase zurückgesetzt.");
        return;
      }

      const nextUsage = getInitialDiagnosisUsage();

      setDiagnosisUsage(nextUsage);
      saveDiagnosisUsageToLocalStorage(nextUsage);
      setUsageSource("local");
      setSuccess("Lokaler Nutzungszähler wurde zurückgesetzt.");
    } catch (error) {
      setError(`Nutzungszähler konnte nicht zurückgesetzt werden: ${getErrorMessage(error)}`);
    }
  }

  async function deleteDiagnosisCase(caseId: string) {
    setSuccess("");
    setError("");

    try {
      if (user && caseSource === "supabase") {
        await deleteDiagnosisCaseFromSupabase(supabase, user, caseId);
      }

      const updatedCases = diagnosisCases.filter((diagnosisCase) => {
        return diagnosisCase.id !== caseId;
      });

      setDiagnosisCases(updatedCases);
      saveDiagnosisCasesToLocalStorage(updatedCases);
      setSuccess("Diagnosefall wurde gelöscht.");
    } catch (error) {
      setError(`Diagnosefall konnte nicht gelöscht werden: ${getErrorMessage(error)}`);
    }
  }

  async function deletePremiumLead(leadId: string) {
    setSuccess("");
    setError("");

    try {
      if (user && leadSource === "supabase") {
        await deletePremiumLeadFromSupabase(supabase, user, leadId);
      }

      const updatedLeads = premiumLeads.filter((lead) => {
        return lead.id !== leadId;
      });

      setPremiumLeads(updatedLeads);
      savePremiumLeadsToLocalStorage(updatedLeads);
      setSuccess("Premium-Vormerkung wurde gelöscht.");
    } catch (error) {
      setError(
        `Premium-Vormerkung konnte nicht gelöscht werden: ${getErrorMessage(error)}`
      );
    }
  }

  function openDiagnosisCase(savedCase: SavedDiagnosisCase, target: "diagnose" | "protocol") {
    localStorage.setItem(
      CURRENT_CASE_STORAGE_KEY,
      JSON.stringify({
        messages: savedCase.messages,
        engineContext: savedCase.engineContext,
        faultCodeContext: savedCase.faultCodeContext,
        qualityCheck: savedCase.qualityCheck,
        openedCaseId: savedCase.id,
      })
    );

    if (target === "protocol") {
      window.location.href = "/pruefprotokoll";
      return;
    }

    window.location.href = "/#diagnose";
  }

  function exportDashboardData() {
    const exportData = {
      exportedAt: new Date().toISOString(),
      user: user
        ? {
            id: user.id,
            email: user.email,
          }
        : null,
      workshopData,
      sources: {
        cases: caseSource,
        usage: usageSource,
        premiumLeads: leadSource,
      },
      diagnosisUsage,
      diagnosisCases,
      premiumLeads,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `diagnosehub-dashboard-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-400">
              DiagnoseHUB
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
              Dashboard
            </h1>

            <p className="mt-4 max-w-3xl leading-8 text-slate-400">
              Übersicht über Werkstattprofil, Diagnosefälle, Nutzungszähler und
              Premium-Vormerkungen. Supabase ist die Hauptquelle, lokale Daten
              bleiben als Fallback erhalten.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={refreshAllSupabaseData}
              disabled={!user || isLoading}
              className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Supabase neu laden
            </button>

            <button
              type="button"
              onClick={exportDashboardData}
              className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-5 py-3 font-semibold text-blue-300 transition hover:bg-blue-500 hover:text-white"
            >
              Export JSON
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 leading-7 text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-2xl border border-green-500/30 bg-green-500/10 px-5 py-4 leading-7 text-green-300">
            {success}
          </div>
        )}

        <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            title="Account"
            value={user ? "Eingeloggt" : "Lokal"}
            description={
              user
                ? user.email || "Supabase-Session aktiv"
                : "Keine Supabase-Session aktiv"
            }
          />

          <DashboardCard
            title="Plan"
            value={planLabels[workshopData.plan]}
            description={`Quelle: ${profileSourceLabels[workshopData.source]}`}
          />

          <DashboardCard
            title="Diagnosen heute"
            value={diagnosisUsage.count}
            description={`Datum: ${formatDate(diagnosisUsage.date)}`}
          >
            <SourceBadge source={usageSource} />
          </DashboardCard>

          <DashboardCard
            title="Premium-Vormerkungen"
            value={premiumLeads.length}
            description="Gespeicherte Interessenten"
          >
            <SourceBadge source={leadSource} />
          </DashboardCard>
        </div>

        <div className="space-y-8">
          <Section
            title="Werkstattprofil"
            description="Diese Daten werden für Dashboard, Header und Prüfprotokoll genutzt."
            right={
              <a
                href="/login"
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
              >
                Profil bearbeiten
              </a>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-500">Werkstatt</p>
                <p className="mt-2 font-bold text-white">
                  {workshopData.workshop}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-500">Name</p>
                <p className="mt-2 font-bold text-white">{workshopData.name}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-500">E-Mail</p>
                <p className="mt-2 break-words font-bold text-white">
                  {workshopData.email}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-500">Rolle</p>
                <p className="mt-2 font-bold text-white">{workshopData.role}</p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-500">Zuletzt geändert</p>
                <p className="mt-2 font-bold text-white">
                  {formatDateTime(workshopData.updatedAt)}
                </p>
              </div>
            </div>
          </Section>

          <Section
            title="Nutzungszähler"
            description="Zählt Diagnoseanfragen pro Tag. Bei Login wird der Wert aus Supabase geladen."
            right={
              <button
                type="button"
                onClick={resetUsageCounter}
                disabled={usageLoading}
                className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 font-semibold text-red-300 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Zähler zurücksetzen
              </button>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-500">Quelle</p>
                <div className="mt-2">
                  <SourceBadge source={usageSource} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-500">Datum</p>
                <p className="mt-2 font-bold text-white">
                  {formatDate(diagnosisUsage.date)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-slate-500">Anfragen heute</p>
                <p className="mt-2 text-3xl font-black text-white">
                  {diagnosisUsage.count}
                </p>
              </div>
            </div>
          </Section>

          <Section
            title="Diagnosefälle"
            description="Gespeicherte Fälle. Du kannst lokale Fälle nach Supabase migrieren und Fälle für Diagnose oder Prüfprotokoll öffnen."
            right={
              <>
                <button
                  type="button"
                  onClick={() => user && loadSupabaseCases(user, false)}
                  disabled={!user || caseLoading}
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Fälle neu laden
                </button>

                <button
                  type="button"
                  onClick={migrateLocalCasesNow}
                  disabled={!user || caseLoading}
                  className="rounded-xl border border-green-500/40 bg-green-500/10 px-5 py-3 font-semibold text-green-300 transition hover:bg-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Lokale Fälle migrieren
                </button>
              </>
            }
          >
            <div className="mb-5">
              <SourceBadge source={caseSource} />
            </div>

            {diagnosisCases.length === 0 ? (
              <EmptyState text="Noch keine gespeicherten Diagnosefälle vorhanden." />
            ) : (
              <div className="grid gap-4">
                {diagnosisCases.map((diagnosisCase) => (
                  <div
                    key={diagnosisCase.id}
                    className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-white">
                          {diagnosisCase.title || "Unbenannter Diagnosefall"}
                        </h3>

                        <p className="mt-2 text-sm text-slate-500">
                          Aktualisiert: {formatDateTime(diagnosisCase.updatedAt)}
                        </p>

                        <p className="mt-3 line-clamp-2 leading-7 text-slate-400">
                          {diagnosisCase.messages?.[0]?.content ||
                            "Keine Beschreibung vorhanden."}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            openDiagnosisCase(diagnosisCase, "diagnose")
                          }
                          className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500 hover:text-white"
                        >
                          Öffnen
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openDiagnosisCase(diagnosisCase, "protocol")
                          }
                          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
                        >
                          Prüfprotokoll
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteDiagnosisCase(diagnosisCase.id)}
                          disabled={caseLoading}
                          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title={
              leadSource === "supabase"
                ? "Supabase-Vormerkungen"
                : "Lokale Vormerkungen"
            }
            description="Premium-Interessenten aus der Premium-Seite. Eingeloggte Nutzer speichern und löschen diese Daten direkt in Supabase."
            right={
              <>
                <button
                  type="button"
                  onClick={() => user && loadSupabasePremiumLeads(user, false)}
                  disabled={!user || leadLoading}
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Supabase neu laden
                </button>

                <button
                  type="button"
                  onClick={migrateLocalPremiumLeadsNow}
                  disabled={!user || leadLoading}
                  className="rounded-xl border border-green-500/40 bg-green-500/10 px-5 py-3 font-semibold text-green-300 transition hover:bg-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Lokale Vormerkungen migrieren
                </button>

                <a
                  href="/premium"
                  className="rounded-xl bg-yellow-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-yellow-400"
                >
                  Premium-Seite
                </a>
              </>
            }
          >
            <div className="mb-5">
              <SourceBadge source={leadSource} />
            </div>

            {premiumLeads.length === 0 ? (
              <EmptyState text="Noch keine Premium-Vormerkungen vorhanden." />
            ) : (
              <div className="grid gap-4">
                {premiumLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-bold text-white">
                            {lead.workshop}
                          </h3>

                          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-300">
                            {premiumLeadPlanLabels[lead.plan]}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-slate-400 md:grid-cols-2 xl:grid-cols-4">
                          <p>
                            <span className="text-slate-500">Name:</span>{" "}
                            {lead.name}
                          </p>

                          <p>
                            <span className="text-slate-500">E-Mail:</span>{" "}
                            {lead.email}
                          </p>

                          <p>
                            <span className="text-slate-500">Telefon:</span>{" "}
                            {lead.phone || "nicht angegeben"}
                          </p>

                          <p>
                            <span className="text-slate-500">Erstellt:</span>{" "}
                            {formatDateTime(lead.createdAt)}
                          </p>
                        </div>

                        {lead.note && (
                          <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 leading-7 text-slate-300">
                            {lead.note}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => deletePremiumLead(lead.id)}
                        disabled={leadLoading}
                        className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  );
}