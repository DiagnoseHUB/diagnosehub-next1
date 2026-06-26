"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AuthChangeEvent,
  Session,
  User,
} from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import {
  deleteDiagnosisCaseFromSupabase,
  loadDiagnosisCasesFromSupabase,
  migrateLocalDiagnosisCasesToSupabase,
  type ChatMessage,
  type EngineContext,
  type FaultCodeContext,
  type SavedDiagnosisCase,
} from "@/services/diagnosisCasesSupabase";

type UserPlan = "free" | "werkstatt" | "pro";

type DemoAccount = {
  name: string;
  workshop: string;
  email: string;
  role: string;
  plan: UserPlan;
  updatedAt: string;
  supabaseUserId?: string;
};

type WorkshopProfile = {
  id: string;
  full_name: string;
  workshop_name: string;
  email: string;
  role: string;
  plan: UserPlan;
  created_at: string;
  updated_at: string;
};

type DiagnosisUsage = {
  date: string;
  count: number;
};

type CurrentDiagnosisCase = {
  messages: ChatMessage[];
  engineContext: EngineContext | null;
  faultCodeContext: FaultCodeContext | null;
  qualityCheck: string;
  openedCaseId?: string | null;
};

type PremiumLead = {
  id: string;
  createdAt: string;
  plan: "werkstatt" | "pro";
  name: string;
  workshop: string;
  email: string;
  phone: string;
  note: string;
};

type CaseStorageSource = "local" | "supabase";

const DEMO_ACCOUNT_STORAGE_KEY = "diagnosehub-demo-account";
const USER_PLAN_STORAGE_KEY = "diagnosehub-user-plan";
const DIAGNOSIS_USAGE_STORAGE_KEY = "diagnosehub-diagnosis-usage";
const SAVED_CASES_STORAGE_KEY = "diagnosehub-saved-cases";
const CURRENT_CASE_STORAGE_KEY = "diagnosehub-current-case";
const PREMIUM_LEADS_STORAGE_KEY = "diagnosehub-premium-leads";

const planLimits: Record<
  UserPlan,
  {
    label: string;
    badge: string;
    dailyLimit: number;
    savedCaseLimit: number;
    description: string;
  }
> = {
  free: {
    label: "Free",
    badge: "Kostenlos",
    dailyLimit: 3,
    savedCaseLimit: 3,
    description: "Für Tests und einzelne Diagnosefälle.",
  },
  werkstatt: {
    label: "Werkstatt Demo",
    badge: "Premium Demo",
    dailyLimit: 50,
    savedCaseLimit: 25,
    description: "Vorbereitung für den späteren Werkstatt-Zugang.",
  },
  pro: {
    label: "Werkstatt Pro Demo",
    badge: "Pro Demo",
    dailyLimit: 150,
    savedCaseLimit: 100,
    description: "Vorbereitung für größere Betriebe.",
  },
};

const premiumLeadPlanLabels: Record<"werkstatt" | "pro", string> = {
  werkstatt: "Werkstatt",
  pro: "Werkstatt Pro",
};

function getTodayKey() {
  return new Date().toLocaleDateString("sv-SE");
}

function getInitialUsage(): DiagnosisUsage {
  return {
    date: getTodayKey(),
    count: 0,
  };
}

function normalizeUsage(usage: DiagnosisUsage): DiagnosisUsage {
  const today = getTodayKey();

  if (usage.date !== today) {
    return {
      date: today,
      count: 0,
    };
  }

  return usage;
}

function isValidUserPlan(value: string | null): value is UserPlan {
  return value === "free" || value === "werkstatt" || value === "pro";
}

function formatDateTime(value: string) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getLatestCase(savedCases: SavedDiagnosisCase[]) {
  if (savedCases.length === 0) {
    return null;
  }

  return [...savedCases].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  })[0];
}

function getFaultCodeText(savedCase: SavedDiagnosisCase) {
  const firstCode = savedCase.faultCodeContext?.foundCodes?.[0]?.code;

  if (!firstCode) {
    return "kein Fehlercode";
  }

  return firstCode;
}

function convertProfileToLocalAccount(
  profile: WorkshopProfile,
  userId: string
): DemoAccount {
  return {
    name: profile.full_name,
    workshop: profile.workshop_name,
    email: profile.email,
    role: profile.role,
    plan: profile.plan,
    updatedAt: profile.updated_at,
    supabaseUserId: userId,
  };
}

function loadLocalSavedCases() {
  try {
    const savedCaseList = localStorage.getItem(SAVED_CASES_STORAGE_KEY);

    if (!savedCaseList) {
      return [];
    }

    const parsedSavedCases = JSON.parse(savedCaseList);

    if (!Array.isArray(parsedSavedCases)) {
      return [];
    }

    return parsedSavedCases as SavedDiagnosisCase[];
  } catch (error) {
    console.error("Lokale Fälle konnten nicht gelesen werden:", error);
    return [];
  }
}

function saveCasesToLocalStorage(savedCases: SavedDiagnosisCase[]) {
  localStorage.setItem(SAVED_CASES_STORAGE_KEY, JSON.stringify(savedCases));
}

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
        {label}
      </p>

      <p className="mt-4 text-4xl font-black text-white">{value}</p>

      <p className="mt-3 leading-7 text-slate-400">{subtext}</p>
    </div>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [databaseProfile, setDatabaseProfile] =
    useState<WorkshopProfile | null>(null);

  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [usage, setUsage] = useState<DiagnosisUsage>(getInitialUsage());
  const [savedCases, setSavedCases] = useState<SavedDiagnosisCase[]>([]);
  const [caseStorageSource, setCaseStorageSource] =
    useState<CaseStorageSource>("local");
  const [premiumLeads, setPremiumLeads] = useState<PremiumLead[]>([]);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [caseLoading, setCaseLoading] = useState(false);

  const currentPlan = planLimits[userPlan];
  const normalizedUsage = normalizeUsage(usage);

  const remainingDiagnoses = Math.max(
    currentPlan.dailyLimit - normalizedUsage.count,
    0
  );

  const remainingSavedCases = Math.max(
    currentPlan.savedCaseLimit - savedCases.length,
    0
  );

  const latestCase = useMemo(() => {
    return getLatestCase(savedCases);
  }, [savedCases]);

  const sortedCases = useMemo(() => {
    return [...savedCases].sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [savedCases]);

  const sortedLeads = useMemo(() => {
    return [...premiumLeads].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [premiumLeads]);

  useEffect(() => {
    void loadDashboardData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, nextSession: Session | null) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          await loadWorkshopProfile(nextSession.user);
          await loadSupabaseCases(nextSession.user, false);
        } else {
          setDatabaseProfile(null);
          loadLocalAccountFallback();
          loadLocalCasesIntoState();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  function showSuccess(message: string) {
    setSuccess(message);
    setError("");

    window.setTimeout(() => {
      setSuccess("");
    }, 2500);
  }

  function showError(message: string) {
    setError(message);
    setSuccess("");
  }

  function syncProfileToLocalStorage(profile: WorkshopProfile, userId: string) {
    const localAccount = convertProfileToLocalAccount(profile, userId);

    setAccount(localAccount);
    setUserPlan(localAccount.plan);
    setDatabaseProfile(profile);

    localStorage.setItem(DEMO_ACCOUNT_STORAGE_KEY, JSON.stringify(localAccount));
    localStorage.setItem(USER_PLAN_STORAGE_KEY, localAccount.plan);
  }

  function loadLocalAccountFallback() {
    try {
      const savedAccount = localStorage.getItem(DEMO_ACCOUNT_STORAGE_KEY);
      const savedPlan = localStorage.getItem(USER_PLAN_STORAGE_KEY);

      if (savedAccount) {
        const parsedAccount = JSON.parse(savedAccount) as DemoAccount;
        setAccount(parsedAccount);

        if (isValidUserPlan(parsedAccount.plan)) {
          setUserPlan(parsedAccount.plan);
        }

        return;
      }

      setAccount(null);

      if (isValidUserPlan(savedPlan)) {
        setUserPlan(savedPlan);
      } else {
        setUserPlan("free");
      }
    } catch (error) {
      console.error("Lokaler Account konnte nicht geladen werden:", error);
      setAccount(null);
      setUserPlan("free");
    }
  }

  function loadLocalUsageAndLeads() {
    try {
      const savedUsage = localStorage.getItem(DIAGNOSIS_USAGE_STORAGE_KEY);
      const savedLeadList = localStorage.getItem(PREMIUM_LEADS_STORAGE_KEY);

      if (savedUsage) {
        const parsedUsage = JSON.parse(savedUsage);
        const normalizedSavedUsage = normalizeUsage({
          date: parsedUsage.date || getTodayKey(),
          count: Number(parsedUsage.count) || 0,
        });

        setUsage(normalizedSavedUsage);
        localStorage.setItem(
          DIAGNOSIS_USAGE_STORAGE_KEY,
          JSON.stringify(normalizedSavedUsage)
        );
      } else {
        setUsage(getInitialUsage());
      }

      if (savedLeadList) {
        const parsedLeads = JSON.parse(savedLeadList);

        if (Array.isArray(parsedLeads)) {
          setPremiumLeads(parsedLeads);
        }
      } else {
        setPremiumLeads([]);
      }
    } catch (error) {
      console.error("Lokale Dashboard-Daten konnten nicht geladen werden:", error);
    }
  }

  function loadLocalCasesIntoState() {
    const localCases = loadLocalSavedCases();

    setSavedCases(localCases);
    setCaseStorageSource("local");
  }

  async function loadWorkshopProfile(currentUser: User) {
    setProfileLoading(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("workshop_profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (error) {
        showError(error.message);
        loadLocalAccountFallback();
        return;
      }

      if (!data) {
        setDatabaseProfile(null);
        loadLocalAccountFallback();
        return;
      }

      const profile = data as WorkshopProfile;

      syncProfileToLocalStorage(profile, currentUser.id);
    } finally {
      setProfileLoading(false);
    }
  }

  async function loadSupabaseCases(currentUser: User, migrateLocal: boolean) {
    setCaseLoading(true);
    setError("");

    try {
      const localCases = loadLocalSavedCases();

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

      setSavedCases(remoteCases);
      saveCasesToLocalStorage(remoteCases);
      setCaseStorageSource("supabase");
    } catch (error) {
      console.error("Supabase-Fälle konnten nicht geladen werden:", error);
      showError(
        "Supabase-Fälle konnten nicht geladen werden. Lokale Fälle bleiben sichtbar."
      );
      loadLocalCasesIntoState();
    } finally {
      setCaseLoading(false);
    }
  }

  async function loadDashboardData() {
    try {
      loadLocalUsageAndLeads();

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        showError(sessionError.message);
      }

      setSession(sessionData.session);
      setUser(sessionData.session?.user ?? null);

      if (sessionData.session?.user) {
        await loadWorkshopProfile(sessionData.session.user);
        await loadSupabaseCases(sessionData.session.user, false);
      } else {
        loadLocalAccountFallback();
        loadLocalCasesIntoState();
      }
    } catch (error) {
      console.error("Dashboard-Daten konnten nicht geladen werden:", error);
      showError("Dashboard-Daten konnten nicht geladen werden.");
    }
  }

  function openSavedCase(savedCase: SavedDiagnosisCase) {
    const currentCase: CurrentDiagnosisCase = {
      messages: savedCase.messages,
      engineContext: savedCase.engineContext,
      faultCodeContext: savedCase.faultCodeContext,
      qualityCheck: savedCase.qualityCheck,
      openedCaseId: savedCase.id,
    };

    localStorage.setItem(CURRENT_CASE_STORAGE_KEY, JSON.stringify(currentCase));
    window.location.href = "/#diagnose";
  }

  async function deleteSavedCase(caseId: string) {
    if (user && caseStorageSource === "supabase") {
      setCaseLoading(true);

      try {
        await deleteDiagnosisCaseFromSupabase(supabase, user, caseId);
      } catch (error) {
        console.error("Fall konnte nicht aus Supabase gelöscht werden:", error);
        showError("Fall konnte nicht aus Supabase gelöscht werden.");
        setCaseLoading(false);
        return;
      } finally {
        setCaseLoading(false);
      }
    }

    const updatedCases = savedCases.filter((savedCase) => {
      return savedCase.id !== caseId;
    });

    setSavedCases(updatedCases);
    saveCasesToLocalStorage(updatedCases);

    const currentCaseRaw = localStorage.getItem(CURRENT_CASE_STORAGE_KEY);

    if (currentCaseRaw) {
      try {
        const currentCase = JSON.parse(currentCaseRaw) as CurrentDiagnosisCase;

        if (currentCase.openedCaseId === caseId) {
          localStorage.removeItem(CURRENT_CASE_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(CURRENT_CASE_STORAGE_KEY);
      }
    }

    showSuccess(
      caseStorageSource === "supabase"
        ? "Diagnosefall wurde aus Supabase gelöscht."
        : "Diagnosefall wurde lokal gelöscht."
    );
  }

  function deletePremiumLead(leadId: string) {
    const updatedLeads = premiumLeads.filter((lead) => {
      return lead.id !== leadId;
    });

    setPremiumLeads(updatedLeads);
    localStorage.setItem(PREMIUM_LEADS_STORAGE_KEY, JSON.stringify(updatedLeads));
    showSuccess("Premium-Vormerkung wurde gelöscht.");
  }

  function resetDailyUsage() {
    const nextUsage = getInitialUsage();

    setUsage(nextUsage);
    localStorage.setItem(DIAGNOSIS_USAGE_STORAGE_KEY, JSON.stringify(nextUsage));
    showSuccess("Tagesnutzung wurde zurückgesetzt.");
  }

  function clearCurrentCase() {
    localStorage.removeItem(CURRENT_CASE_STORAGE_KEY);
    showSuccess("Aktuell geöffneter Diagnosefall wurde zurückgesetzt.");
  }

  async function refreshSupabaseProfile() {
    if (!user) {
      showError("Kein Supabase-User eingeloggt.");
      return;
    }

    await loadWorkshopProfile(user);
    showSuccess("Werkstattprofil wurde aus Supabase aktualisiert.");
  }

  async function refreshSupabaseCases() {
    if (!user) {
      showError("Kein Supabase-User eingeloggt.");
      return;
    }

    await loadSupabaseCases(user, false);
    showSuccess("Diagnosefälle wurden aus Supabase aktualisiert.");
  }

  async function migrateLocalCasesNow() {
    if (!user) {
      showError("Kein Supabase-User eingeloggt.");
      return;
    }

    await loadSupabaseCases(user, true);
    showSuccess("Lokale Diagnosefälle wurden nach Supabase migriert.");
  }

  function exportDashboardSummary() {
    const activeWorkshop =
      databaseProfile?.workshop_name || account?.workshop || "nicht eingerichtet";

    const activeName =
      databaseProfile?.full_name || account?.name || "nicht eingerichtet";

    const activeEmail =
      databaseProfile?.email ||
      account?.email ||
      user?.email ||
      "nicht eingerichtet";

    const activeRole =
      databaseProfile?.role || account?.role || "nicht eingerichtet";

    const lines = [
      "DiagnoseHUB Dashboard Export",
      "============================",
      "",
      `Exportiert am: ${new Date().toLocaleString("de-DE")}`,
      "",
      "Supabase",
      "--------",
      `Login aktiv: ${user ? "ja" : "nein"}`,
      `User-ID: ${user?.id || "nicht eingeloggt"}`,
      "",
      "Werkstattprofil",
      "---------------",
      `Quelle: ${
        databaseProfile ? "Supabase workshop_profiles" : "localStorage Fallback"
      }`,
      `Werkstatt: ${activeWorkshop}`,
      `Name: ${activeName}`,
      `E-Mail: ${activeEmail}`,
      `Rolle: ${activeRole}`,
      "",
      "Plan",
      "----",
      `Aktiver Plan: ${currentPlan.label}`,
      `Diagnosen heute: ${normalizedUsage.count} / ${currentPlan.dailyLimit}`,
      `Gespeicherte Fälle: ${savedCases.length} / ${currentPlan.savedCaseLimit}`,
      `Fallquelle: ${caseStorageSource}`,
      "",
      "Gespeicherte Fälle",
      "-------------------",
      ...sortedCases.map((savedCase) => {
        return `${formatDateTime(savedCase.updatedAt)} | ${
          savedCase.title
        } | ${getFaultCodeText(savedCase)}`;
      }),
      "",
      "Premium-Vormerkungen",
      "---------------------",
      ...sortedLeads.map((lead) => {
        return `${formatDateTime(lead.createdAt)} | ${
          premiumLeadPlanLabels[lead.plan]
        } | ${lead.workshop} | ${lead.email}`;
      }),
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `diagnosehub-dashboard-${date}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showSuccess("Dashboard-Export wurde erstellt.");
  }

  const profileSourceLabel = databaseProfile
    ? "Supabase Datenbank"
    : account
      ? "Lokaler Fallback"
      : "Kein Profil";

  const caseSourceLabel =
    caseStorageSource === "supabase"
      ? "Supabase Fälle"
      : "Lokale Fälle";

  const activeWorkshop =
    databaseProfile?.workshop_name || account?.workshop || null;

  const activeName = databaseProfile?.full_name || account?.name || null;
  const activeEmail = databaseProfile?.email || account?.email || user?.email;
  const activeRole = databaseProfile?.role || account?.role || null;
  const activeUpdatedAt = databaseProfile?.updated_at || account?.updatedAt;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-14">
        <section className="mb-10">
          <div className="inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-5 py-2 text-sm font-semibold text-green-300">
            Supabase Dashboard
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.5fr] lg:items-end">
            <div>
              <h1 className="text-5xl font-black tracking-tight md:text-6xl">
                Werkstatt-Übersicht.
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-400">
                Das Dashboard liest Werkstattprofil und Diagnosefälle jetzt aus
                Supabase. Nutzung und Premium-Vormerkungen laufen vorerst noch
                lokal.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <button
                onClick={() => void loadDashboardData()}
                disabled={profileLoading || caseLoading}
                className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Aktualisieren
              </button>

              <button
                onClick={exportDashboardSummary}
                className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-5 py-3 font-semibold text-blue-300 transition hover:bg-blue-500 hover:text-white"
              >
                Export TXT
              </button>
            </div>
          </div>
        </section>

        {success && (
          <div className="mb-8 rounded-xl border border-green-500/30 bg-green-500/10 px-6 py-4 text-green-300">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-red-300">
            {error}
          </div>
        )}

        <section className="mb-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Aktiver Plan"
            value={currentPlan.label}
            subtext={currentPlan.description}
          />

          <StatCard
            label="Diagnosen heute"
            value={`${normalizedUsage.count}/${currentPlan.dailyLimit}`}
            subtext={`${remainingDiagnoses} KI-Diagnosen heute noch verfügbar.`}
          />

          <StatCard
            label="Fallhistorie"
            value={`${savedCases.length}/${currentPlan.savedCaseLimit}`}
            subtext={`${remainingSavedCases} Speicherplätze im aktuellen Plan frei.`}
          />

          <StatCard
            label="Fallquelle"
            value={caseSourceLabel}
            subtext={
              user
                ? "Supabase-Login erkannt."
                : "Kein Login. Fallback auf lokale Fälle."
            }
          />
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-8">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                Supabase Account
              </p>

              {user ? (
                <div className="mt-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
                  <p className="font-bold text-green-300">
                    Supabase-Session aktiv
                  </p>

                  <p className="mt-2 break-all text-sm text-slate-300">
                    {user.email}
                  </p>

                  <p className="mt-2 break-all font-mono text-xs text-slate-500">
                    {user.id}
                  </p>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5">
                  <p className="font-bold text-yellow-300">
                    Nicht eingeloggt
                  </p>

                  <p className="mt-2 leading-7 text-slate-300">
                    Melde dich an, damit das Dashboard dein echtes
                    Werkstattprofil und deine Fälle aus Supabase laden kann.
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/login"
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
                >
                  Zum Login
                </a>

                <button
                  onClick={() => void refreshSupabaseProfile()}
                  disabled={!user || profileLoading}
                  className="rounded-xl border border-green-500/40 px-5 py-3 font-semibold text-green-300 transition hover:bg-green-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Profil neu laden
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                Werkstattprofil
              </p>

              {activeWorkshop ? (
                <>
                  <h2 className="mt-3 text-3xl font-bold">{activeWorkshop}</h2>

                  <div className="mt-6 space-y-3 text-slate-400">
                    <p>
                      Quelle:{" "}
                      <span className="font-semibold text-white">
                        {profileSourceLabel}
                      </span>
                    </p>

                    <p>
                      Bearbeiter:{" "}
                      <span className="font-semibold text-white">
                        {activeName}
                      </span>
                    </p>

                    <p>
                      E-Mail:{" "}
                      <span className="font-semibold text-white">
                        {activeEmail}
                      </span>
                    </p>

                    <p>
                      Rolle:{" "}
                      <span className="font-semibold text-white">
                        {activeRole}
                      </span>
                    </p>

                    {activeUpdatedAt && (
                      <p>
                        Aktualisiert:{" "}
                        <span className="font-semibold text-white">
                          {formatDateTime(activeUpdatedAt)}
                        </span>
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-3 text-3xl font-bold">
                    Kein Werkstattprofil
                  </h2>

                  <p className="mt-4 leading-7 text-slate-400">
                    Lege auf der Login-Seite dein Werkstattprofil an. Danach
                    erscheint es hier direkt aus Supabase.
                  </p>
                </>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/login"
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
                >
                  Werkstattprofil bearbeiten
                </a>

                <a
                  href="/#diagnose"
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  Zur Diagnose
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                Nutzung
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Tageslimit überwachen
              </h2>

              <p className="mt-4 leading-7 text-slate-400">
                Die Nutzung wird noch lokal im Browser gezählt. Diagnosefälle
                liegen bei aktivem Login jetzt bereits in Supabase.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={resetDailyUsage}
                  className="rounded-xl border border-yellow-500/40 px-5 py-3 font-semibold text-yellow-300 transition hover:bg-yellow-500 hover:text-slate-950"
                >
                  Tageszähler zurücksetzen
                </button>

                <button
                  onClick={clearCurrentCase}
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  Aktuellen Fall leeren
                </button>
              </div>
            </div>

            {latestCase && (
              <div className="rounded-3xl border border-blue-500/30 bg-blue-500/10 p-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">
                  Letzter Fall
                </p>

                <h2 className="mt-3 text-2xl font-bold text-white">
                  {latestCase.title}
                </h2>

                <p className="mt-3 text-slate-400">
                  Aktualisiert: {formatDateTime(latestCase.updatedAt)}
                </p>

                <p className="mt-2 text-slate-400">
                  Fehlercode: {getFaultCodeText(latestCase)}
                </p>

                <button
                  onClick={() => openSavedCase(latestCase)}
                  className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
                >
                  Letzten Fall öffnen
                </button>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                    Gespeicherte Diagnosefälle
                  </p>

                  <h2 className="mt-2 text-3xl font-bold">
                    {caseStorageSource === "supabase"
                      ? "Supabase-Fallhistorie"
                      : "Lokale Fallhistorie"}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => void refreshSupabaseCases()}
                    disabled={!user || caseLoading}
                    className="rounded-xl border border-green-500/40 px-5 py-3 font-semibold text-green-300 transition hover:bg-green-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {caseLoading ? "Lädt..." : "Supabase neu laden"}
                  </button>

                  <a
                    href="/#diagnose"
                    className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
                  >
                    Neuen Fall starten
                  </a>
                </div>
              </div>

              {user && (
                <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-sm leading-7 text-slate-400">
                    Fallquelle:{" "}
                    <span className="font-bold text-white">
                      {caseSourceLabel}
                    </span>
                    . Lokale Alt-Fälle können bei Bedarf nach Supabase migriert
                    werden.
                  </p>

                  <button
                    onClick={() => void migrateLocalCasesNow()}
                    disabled={caseLoading}
                    className="mt-3 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Lokale Fälle nach Supabase migrieren
                  </button>
                </div>
              )}

              {sortedCases.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-slate-500">
                  Noch keine Fälle gespeichert.
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedCases.map((savedCase) => (
                    <div
                      key={savedCase.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <h3 className="font-bold text-white">
                            {savedCase.title}
                          </h3>

                          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                            <span>
                              Aktualisiert: {formatDateTime(savedCase.updatedAt)}
                            </span>

                            {savedCase.engineContext?.code && (
                              <span>
                                Motorcode: {savedCase.engineContext.code}
                              </span>
                            )}

                            <span>Fehlercode: {getFaultCodeText(savedCase)}</span>

                            <span>{savedCase.messages.length} Nachrichten</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => openSavedCase(savedCase)}
                            className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500 hover:text-white"
                          >
                            Öffnen
                          </button>

                          <button
                            onClick={() => void deleteSavedCase(savedCase.id)}
                            disabled={caseLoading}
                            className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                    Premium
                  </p>

                  <h2 className="mt-2 text-3xl font-bold">Vormerkungen</h2>
                </div>

                <a
                  href="/premium"
                  className="rounded-xl border border-yellow-500/40 px-5 py-3 font-semibold text-yellow-300 transition hover:bg-yellow-500 hover:text-slate-950"
                >
                  Premium-Seite
                </a>
              </div>

              {sortedLeads.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-slate-500">
                  Noch keine Premium-Vormerkungen gespeichert.
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-3">
                            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-300">
                              {premiumLeadPlanLabels[lead.plan]}
                            </span>

                            <span className="text-sm text-slate-500">
                              {formatDateTime(lead.createdAt)}
                            </span>
                          </div>

                          <h3 className="mt-4 font-bold text-white">
                            {lead.workshop}
                          </h3>

                          <p className="mt-2 text-slate-400">{lead.name}</p>

                          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                            <span>{lead.email}</span>
                            {lead.phone && <span>{lead.phone}</span>}
                          </div>

                          {lead.note && (
                            <p className="mt-4 leading-7 text-slate-400">
                              {lead.note}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => deletePremiumLead(lead.id)}
                          className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}