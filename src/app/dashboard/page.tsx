"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import {
  readAccountScopedLocalStorage,
  removeAccountScopedLocalStorage,
  writeAccountScopedLocalStorage,
} from "@/services/accountScopedStorage";
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
  type DiagnosisUsage,
} from "@/services/diagnosisUsageSupabase";
import { getPlanConfig } from "@/config/plans";
import {
  clearLocalWorkshopProfileState,
  defaultWorkshopProfileState,
  loadWorkshopProfileState,
  notifyWorkshopProfileChanged,
  readLocalWorkshopProfileState,
  type ProfileSource,
  type WorkshopProfileState,
} from "@/services/workshopProfileSupabase";

type DataSource = "local" | "supabase";
type WorkshopData = WorkshopProfileState;
type SafetyAccountType = "private" | "mechanic" | "workshop" | "admin";
type QualificationLevel =
  | "none"
  | "self_declared"
  | "verified_workshop"
  | "hv_verified";
type HvQualification = "none" | "hv1" | "hv2" | "hv3" | "other";
type RiskAccessLevel = "green" | "yellow" | "orange" | "red" | "hv";
type HvRequestStatus = "pending" | "approved" | "rejected";

type SafetyProfileState = {
  userId: string;
  email: string;
  accountType: SafetyAccountType;
  role: string;
  qualificationLevel: QualificationLevel;
  companyVerified: boolean;
  hvVerified: boolean;
  hvQualification: HvQualification;
  riskAccessLevel: RiskAccessLevel;
  termsSafetyAcceptedAt: string | null;
};

type HvAccessRequest = {
  id: string;
  status: HvRequestStatus;
  hv_qualification: HvQualification;
  company_name?: string | null;
  review_comment?: string | null;
  created_at: string;
  reviewed_at?: string | null;
};

const SAVED_CASES_STORAGE_KEY = "diagnosehub-saved-cases";
const CURRENT_CASE_STORAGE_KEY = "diagnosehub-current-case";
const DIAGNOSIS_USAGE_STORAGE_KEY = "diagnosehub-diagnosis-usage";

const legacyUsageStorageKeys = [
  "diagnosehub-diagnosis-usage",
  "diagnosehub-usage",
];

const dataSourceLabels: Record<DataSource, string> = {
  local: "Lokal",
  supabase: "Online",
};

const profileSourceLabels: Record<ProfileSource, string> = {
  localStorage: "Lokaler Fallback",
  supabase: "Online-Profil",
  fallback: "Fallback",
};

const accountTypeLabels: Record<SafetyAccountType, string> = {
  private: "Privatnutzer",
  mechanic: "Mechaniker",
  workshop: "Werkstatt",
  admin: "Admin",
};

const qualificationLabels: Record<QualificationLevel, string> = {
  none: "Keine Prüfung",
  self_declared: "Selbst angegeben",
  verified_workshop: "Werkstatt geprüft",
  hv_verified: "Hochvolt geprüft",
};

const hvQualificationLabels: Record<HvQualification, string> = {
  none: "Keine",
  hv1: "HV 1",
  hv2: "HV 2",
  hv3: "HV 3",
  other: "Andere HV-Qualifikation",
};

const riskAccessLabels: Record<RiskAccessLevel, string> = {
  green: "Basis",
  yellow: "Gelb",
  orange: "Orange",
  red: "Rot",
  hv: "Hochvolt",
};

const riskAccessDescriptions: Record<RiskAccessLevel, string> = {
  green: "Nur einfache Inhalte ohne besondere Sicherheitsrisiken.",
  yellow: "Normale Diagnoseinhalte mit klaren Sicherheitshinweisen.",
  orange: "Erhöhte Risiken werden eingeschränkt und deutlich markiert.",
  red: "Sicherheitskritische Inhalte sind nur mit passender Einstufung sichtbar.",
  hv: "Hochvolt-Inhalte nur nach manueller Freigabe.",
};

const hvRequestStatusLabels: Record<HvRequestStatus, string> = {
  pending: "Beantragt, Prüfung offen",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

const safetyBadgeClasses: Record<RiskAccessLevel, string> = {
  green:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300",
  yellow:
    "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300",
  orange:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  hv: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
};

const defaultWorkshopData: WorkshopData = defaultWorkshopProfileState;

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

function getSafetyProfileSummary(profile: SafetyProfileState | null) {
  if (!profile) {
    return "Nicht geladen";
  }

  if (profile.hvVerified && profile.riskAccessLevel === "hv") {
    return "HV freigegeben";
  }

  return riskAccessLabels[profile.riskAccessLevel];
}

function getHvStatusText(
  profile: SafetyProfileState | null,
  latestRequest?: HvAccessRequest
) {
  if (!profile) {
    return "Nicht geladen";
  }

  if (profile.hvVerified) {
    return `${hvQualificationLabels[profile.hvQualification]} freigegeben`;
  }

  if (latestRequest) {
    return hvRequestStatusLabels[latestRequest.status];
  }

  return "Nicht freigegeben";
}

function getLocalWorkshopData(): WorkshopData {
  return readLocalWorkshopProfileState();
}

function loadLocalDiagnosisCases(userId?: string | null): SavedDiagnosisCase[] {
  try {
    const savedCases = readAccountScopedLocalStorage(
      SAVED_CASES_STORAGE_KEY,
      userId
    );

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

function saveDiagnosisCasesToLocalStorage(
  cases: SavedDiagnosisCase[],
  userId?: string | null
) {
  writeAccountScopedLocalStorage(
    SAVED_CASES_STORAGE_KEY,
    JSON.stringify(cases),
    userId
  );
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

function getFaultCodeText(savedCase: SavedDiagnosisCase) {
  const firstCode = savedCase.faultCodeContext?.foundCodes?.[0]?.code;

  if (!firstCode) {
    return "kein Fehlercode";
  }

  return firstCode;
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
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-blue-950/20">
      <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>

      <div className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
        {value}
      </div>

      {description && (
        <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
          {description}
        </p>
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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-blue-950/20">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">
            {title}
          </h2>
          {description && (
            <p className="mt-2 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">
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
          ? "rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
          : "rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300"
      }
    >
      {dataSourceLabels[source]}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
      {text}
    </div>
  );
}

function SafetyBadge({
  level,
  children,
}: {
  level: RiskAccessLevel;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${safetyBadgeClasses[level]}`}
    >
      {children}
    </span>
  );
}

function SafetyInfoTile({
  label,
  value,
  description,
}: {
  label: string;
  value: ReactNode;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="mt-2 font-bold text-slate-950 dark:text-white">
        {value}
      </div>
      {description && (
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {description}
        </p>
      )}
    </div>
  );
}

function LoginRequired() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
      <Header />

      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-700 dark:text-blue-300">
            DiagnoseHUB Dashboard
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
            Bitte einloggen.
          </h1>

          <p className="mt-5 max-w-3xl leading-8 text-slate-600 dark:text-slate-300">
            Das Dashboard zeigt Nutzerprofil, Fallhistorie und
            Nutzungszähler. Dafür brauchst du eine
            aktive Anmeldung. Lokale Alt-Daten werden hier bewusst nicht
            mehr als Dashboard angezeigt.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-2xl bg-blue-600 px-6 py-3 font-black text-white transition hover:bg-blue-500"
            >
              Zum Login
            </Link>

            <Link
              href="/#diagnose"
              className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-black text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Zur Diagnose
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [workshopData, setWorkshopData] =
    useState<WorkshopData>(defaultWorkshopData);

  const [diagnosisCases, setDiagnosisCases] = useState<SavedDiagnosisCase[]>(
    []
  );
  const [diagnosisUsage, setDiagnosisUsage] = useState<DiagnosisUsage>(
    getInitialDiagnosisUsage()
  );
  const [caseSource, setCaseSource] = useState<DataSource>("local");
  const [usageSource, setUsageSource] = useState<DataSource>("local");

  const [profileLoading, setProfileLoading] = useState(false);
  const [caseLoading, setCaseLoading] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyProfile, setSafetyProfile] =
    useState<SafetyProfileState | null>(null);
  const [hvAccessRequests, setHvAccessRequests] = useState<HvAccessRequest[]>(
    []
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
  const [accountDeleteConfirmation, setAccountDeleteConfirmation] = useState("");
  const [accountDeleteLoading, setAccountDeleteLoading] = useState(false);

  const normalizedUsage = normalizeDiagnosisUsage(diagnosisUsage);
  const currentPlanConfig = getPlanConfig(workshopData.plan);
  const currentDailyLimit = currentPlanConfig.dailyDiagnosisLimit;
  const currentSavedCaseLimit = currentPlanConfig.savedCaseLimit;

  const remainingDiagnoses = Math.max(
    currentDailyLimit - normalizedUsage.count,
    0
  );

  const remainingSavedCases = Math.max(
    currentSavedCaseLimit - diagnosisCases.length,
    0
  );

  const sortedCases = useMemo(() => {
    return [...diagnosisCases].sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [diagnosisCases]);

  const latestCase = sortedCases[0] || null;
  const latestHvRequest = hvAccessRequests[0] || null;

  const isLoading =
    profileLoading || caseLoading || usageLoading || safetyLoading;
  const canDeleteAccount =
    accountDeleteConfirmation.trim() === "ACCOUNT LÖSCHEN";

  useEffect(() => {
    void loadDashboard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        window.setTimeout(() => {
          void loadDashboard(nextSession);
        }, 0);
      }
    );

    async function handleDashboardDataChange() {
      const { data } = await supabase.auth.getSession();
      const currentSession = data.session ?? null;
      const currentUser = currentSession?.user ?? null;

      if (!currentUser) {
        return;
      }

      await Promise.all([
        loadWorkshopProfile(currentUser),
        loadSupabaseCases(currentUser, false),
        loadSupabaseUsage(currentUser),
        currentSession
          ? loadSafetyAccountProfile(currentSession)
          : Promise.resolve(),
      ]);
    }

    window.addEventListener("storage", handleDashboardDataChange);
    window.addEventListener(
      "diagnosehub-account-updated",
      handleDashboardDataChange
    );

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("storage", handleDashboardDataChange);
      window.removeEventListener(
        "diagnosehub-account-updated",
        handleDashboardDataChange
      );
    };
  }, [supabase]);

  function resetDashboardState() {
    setWorkshopData(defaultWorkshopData);
    setDiagnosisCases([]);
    setDiagnosisUsage(getInitialDiagnosisUsage());
    setCaseSource("local");
    setUsageSource("local");
    setSafetyProfile(null);
    setHvAccessRequests([]);
  }

  async function loadDashboard(existingSession?: Session | null) {
    setError("");
    setSuccess("");
    setProfileLoading(true);
    setCaseLoading(true);
    setUsageLoading(true);
    setSafetyLoading(true);

    try {
      const session =
        existingSession ??
        (await supabase.auth.getSession()).data.session ??
        null;

      if (!session?.user) {
        setUser(null);
        resetDashboardState();
        setAuthChecked(true);
        return;
      }

      setUser(session.user);

      await Promise.all([
        loadWorkshopProfile(session.user),
        loadSupabaseCases(session.user, false),
        loadSupabaseUsage(session.user),
        loadSafetyAccountProfile(session),
      ]);

      setAuthChecked(true);
    } catch (error) {
      console.error("Dashboard konnte nicht geladen werden:", error);
      setError(`Dashboard konnte nicht geladen werden: ${getErrorMessage(error)}`);
      setAuthChecked(true);
    } finally {
      setProfileLoading(false);
      setCaseLoading(false);
      setUsageLoading(false);
      setSafetyLoading(false);
    }
  }

  async function loadWorkshopProfile(currentUser: User) {
    setProfileLoading(true);

    try {
      const profileState = await loadWorkshopProfileState(supabase, currentUser);

      setWorkshopData(profileState);
    } catch (error) {
      console.error("Nutzerprofil konnte nicht geladen werden:", error);
      setError(
        `Nutzerprofil konnte nicht aus deinem Konto geladen werden: ${getErrorMessage(
          error
        )}`
      );

      const fallbackWorkshopData = getLocalWorkshopData();

      setWorkshopData({
        ...fallbackWorkshopData,
        email: currentUser.email || fallbackWorkshopData.email,
      });
    } finally {
      setProfileLoading(false);
    }
  }

  async function loadSafetyAccountProfile(session: Session) {
    setSafetyLoading(true);

    try {
      const response = await fetch("/api/account/safety", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        profile?: SafetyProfileState;
        hvRequests?: HvAccessRequest[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || "Sicherheitsprofil konnte nicht geladen werden."
        );
      }

      setSafetyProfile(payload.profile ?? null);
      setHvAccessRequests(
        Array.isArray(payload.hvRequests) ? payload.hvRequests : []
      );
    } catch (error) {
      console.error("Sicherheitsprofil konnte nicht geladen werden:", error);
      setSafetyProfile(null);
      setHvAccessRequests([]);
      setError(
        `Sicherheitsprofil konnte nicht aus deinem Konto geladen werden: ${getErrorMessage(
          error
        )}`
      );
    } finally {
      setSafetyLoading(false);
    }
  }

  async function loadSupabaseCases(currentUser: User, migrateLocal: boolean) {
    setCaseLoading(true);
    setDiagnosisCases(loadLocalDiagnosisCases(currentUser.id));

    try {
      const localCases = loadLocalDiagnosisCases(currentUser.id);

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
      saveDiagnosisCasesToLocalStorage(remoteCases, currentUser.id);
      setCaseSource("supabase");
    } catch (error) {
      console.error("Diagnosefälle konnten nicht geladen werden:", error);
      setError(
        `Diagnosefälle konnten nicht aus deiner Fallhistorie geladen werden: ${getErrorMessage(
          error
        )}`
      );

      const localCases = loadLocalDiagnosisCases(currentUser.id);

      setDiagnosisCases(localCases);
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
        `Nutzungszähler konnte nicht aus deinem Konto geladen werden: ${getErrorMessage(
          error
        )}`
      );

      const localUsage = loadLocalDiagnosisUsage();

      setDiagnosisUsage(localUsage);
      setUsageSource("local");
    } finally {
      setUsageLoading(false);
    }
  }

  async function refreshAllSupabaseData() {
    if (!user) {
      setError("Du bist nicht eingeloggt.");
      return;
    }

    setSuccess("");
    setError("");

    const session = (await supabase.auth.getSession()).data.session;

    await Promise.all([
      loadWorkshopProfile(user),
      loadSupabaseCases(user, false),
      loadSupabaseUsage(user),
      session ? loadSafetyAccountProfile(session) : Promise.resolve(),
    ]);

    setSuccess("Dashboard wurde neu geladen.");
  }

  async function migrateLocalCasesNow() {
    if (!user) {
      setError("Zum Übernehmen lokaler Fälle musst du eingeloggt sein.");
      return;
    }

    setSuccess("");
    setError("");

    await loadSupabaseCases(user, true);
    setSuccess("Lokale Diagnosefälle wurden übernommen.");
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
      saveDiagnosisCasesToLocalStorage(updatedCases, user?.id);

      const currentCaseRaw = readAccountScopedLocalStorage(
        CURRENT_CASE_STORAGE_KEY,
        user?.id
      );

      if (currentCaseRaw) {
        try {
          const currentCase = JSON.parse(currentCaseRaw) as {
            openedCaseId?: string | null;
          };

          if (currentCase.openedCaseId === caseId) {
            removeAccountScopedLocalStorage(CURRENT_CASE_STORAGE_KEY, user?.id);
          }
        } catch {
          removeAccountScopedLocalStorage(CURRENT_CASE_STORAGE_KEY, user?.id);
        }
      }

      setSuccess("Diagnosefall wurde gelöscht.");
    } catch (error) {
      setError(
        `Diagnosefall konnte nicht gelöscht werden: ${getErrorMessage(error)}`
      );
    }
  }


  function openDiagnosisCase(
    savedCase: SavedDiagnosisCase,
    target: "diagnose" | "protocol"
  ) {
    writeAccountScopedLocalStorage(
      CURRENT_CASE_STORAGE_KEY,
      JSON.stringify({
        messages: savedCase.messages,
        engineContext: savedCase.engineContext,
        faultCodeContext: savedCase.faultCodeContext,
        qualityCheck: savedCase.qualityCheck,
        openedCaseId: savedCase.id,
      }),
      user?.id
    );

    if (target === "protocol") {
      window.location.href = "/pruefprotokoll";
      return;
    }

    window.location.href = "/#diagnose";
  }

  function clearCurrentCase() {
    removeAccountScopedLocalStorage(CURRENT_CASE_STORAGE_KEY, user?.id);
    setSuccess("Aktuell geöffneter Diagnosefall wurde zurückgesetzt.");
    setError("");
  }

  function clearDeletedAccountLocalData(userId?: string | null) {
    if (typeof window === "undefined") {
      return;
    }

    removeAccountScopedLocalStorage(SAVED_CASES_STORAGE_KEY, userId);
    removeAccountScopedLocalStorage(CURRENT_CASE_STORAGE_KEY, userId);
    removeAccountScopedLocalStorage(DIAGNOSIS_USAGE_STORAGE_KEY, userId);

    localStorage.removeItem(SAVED_CASES_STORAGE_KEY);
    localStorage.removeItem(CURRENT_CASE_STORAGE_KEY);
    legacyUsageStorageKeys.forEach((storageKey) => {
      localStorage.removeItem(storageKey);
    });

    clearLocalWorkshopProfileState();
    notifyWorkshopProfileChanged();
  }

  async function deleteAccountCompletely() {
    setSuccess("");
    setError("");

    if (!user) {
      setError("Du bist nicht eingeloggt.");
      return;
    }

    if (!canDeleteAccount) {
      setError("Bitte bestätige die Löschung mit ACCOUNT LÖSCHEN.");
      return;
    }

    setAccountDeleteLoading(true);

    try {
      const session = (await supabase.auth.getSession()).data.session;

      if (!session?.access_token) {
        throw new Error("Keine gültige Anmeldung gefunden.");
      }

      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirm: true,
          confirmationText: "ACCOUNT LÖSCHEN",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Account konnte nicht gelöscht werden.");
      }

      clearDeletedAccountLocalData(user.id);
      await supabase.auth.signOut();
      resetDashboardState();
      setUser(null);
      setAuthChecked(true);
      setAccountDeleteOpen(false);
      setAccountDeleteConfirmation("");

      window.location.href = "/login?account=deleted";
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setAccountDeleteLoading(false);
    }
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
      },
      safetyProfile,
      hvAccessRequests,
      diagnosisUsage,
      diagnosisCases,
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

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
        <Header />

        <main className="mx-auto max-w-7xl px-6 py-16">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-700 dark:text-blue-300">
              DiagnoseHUB Dashboard
            </p>

            <h1 className="mt-4 text-4xl font-black text-slate-950 dark:text-white">
              Dashboard wird geladen...
            </h1>

            <p className="mt-4 leading-8 text-slate-600 dark:text-slate-300">
              Anmeldung wird geprüft.
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  if (!user) {
    return <LoginRequired />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-700 dark:text-blue-300">
              DiagnoseHUB
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
              Dashboard
            </h1>

            <p className="mt-4 max-w-3xl leading-8 text-slate-600 dark:text-slate-300">
              Übersicht über Nutzerprofil, Diagnosefälle und Nutzungszähler.
              Dieses Dashboard ist nur mit aktiver Anmeldung sichtbar.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={refreshAllSupabaseData}
              disabled={isLoading}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {isLoading ? "Lädt..." : "Dashboard neu laden"}
            </button>

            <button
              type="button"
              onClick={exportDashboardData}
              className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500 dark:hover:text-white"
            >
              Export JSON
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 leading-7 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 leading-7 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
            {success}
          </div>
        )}

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Neue Diagnose",
              text: "Direkt einen neuen Fehlerfall starten.",
              href: "/#diagnose",
            },
            {
              title: "Profil prüfen",
              text: "Name, Betrieb/Firma und Tarif ansehen.",
              href: "/login?setup=profile",
            },
            {
              title: "Lernen",
              text: "Module, Quiz und Prüfung öffnen.",
              href: "/lernen",
            },
            {
              title: "Service",
              text: "Fahrzeuge und Erinnerungen verwalten.",
              href: "/service-erinnerung",
            },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80"
            >
              <p className="font-black text-slate-950 dark:text-white">
                {action.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {action.text}
              </p>
            </Link>
          ))}
        </div>

        <div className="mb-8 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <DashboardCard
            title="Account"
            value="Eingeloggt"
            description={user.email || "Anmeldung aktiv"}
          />

          <DashboardCard
            title="Plan"
            value={currentPlanConfig.label}
            description={`Quelle: ${profileSourceLabels[workshopData.source]}`}
          />

          <DashboardCard
            title="Diagnosen diesen Monat"
            value={`${normalizedUsage.count}/${currentDailyLimit}`}
            description={`${remainingDiagnoses} Diagnosen diesen Monat noch verfügbar.`}
          >
            <SourceBadge source={usageSource} />
          </DashboardCard>

          <DashboardCard
            title="Fallhistorie"
            value={`${diagnosisCases.length}/${currentSavedCaseLimit}`}
            description={`${remainingSavedCases} Speicherplätze frei.`}
          >
            <SourceBadge source={caseSource} />
          </DashboardCard>

          <DashboardCard
            title="Sicherheitsprofil"
            value={
              safetyLoading ? "Lädt..." : getSafetyProfileSummary(safetyProfile)
            }
            description={
              safetyProfile
                ? riskAccessDescriptions[safetyProfile.riskAccessLevel]
                : "Einstufung wird aus deinem Konto geladen."
            }
          >
            {safetyProfile && (
              <SafetyBadge level={safetyProfile.riskAccessLevel}>
                {riskAccessLabels[safetyProfile.riskAccessLevel]}
              </SafetyBadge>
            )}
          </DashboardCard>
        </div>

        <div className="space-y-8">
          <Section
            title="Nutzerprofil"
            description="Diese Daten kommen bevorzugt aus deinem Konto und werden für Header, Dashboard und Prüfprotokoll genutzt."
            right={
              <a
                href="/login"
                className="rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500"
              >
                Profil bearbeiten
              </a>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm text-slate-500">Betrieb/Firma</p>
                <p className="mt-2 font-bold text-slate-950 dark:text-white">
                  {workshopData.workshop}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm text-slate-500">Name</p>
                <p className="mt-2 font-bold text-slate-950 dark:text-white">
                  {workshopData.name}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm text-slate-500">E-Mail</p>
                <p className="mt-2 break-words font-bold text-slate-950 dark:text-white">
                  {workshopData.email}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm text-slate-500">Rolle</p>
                <p className="mt-2 font-bold text-slate-950 dark:text-white">
                  {workshopData.role}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm text-slate-500">Zuletzt geändert</p>
                <p className="mt-2 font-bold text-slate-950 dark:text-white">
                  {formatDateTime(workshopData.updatedAt)}
                </p>
              </div>
            </div>
          </Section>

          <Section
            title="Sicherheitsprofil"
            description="Aktuelle Konto-Einstufung für sicherheitskritische Inhalte."
            right={
              <a
                href="/login?setup=profile"
                className="rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500"
              >
                Profil prüfen
              </a>
            }
          >
            {safetyLoading && !safetyProfile ? (
              <EmptyState text="Sicherheitsprofil wird geladen." />
            ) : safetyProfile ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SafetyInfoTile
                    label="Kontotyp"
                    value={accountTypeLabels[safetyProfile.accountType]}
                    description={
                      safetyProfile.companyVerified
                        ? "Werkstattdaten geprüft."
                        : "Werkstattdaten nicht geprüft."
                    }
                  />

                  <SafetyInfoTile
                    label="Qualifikation"
                    value={qualificationLabels[safetyProfile.qualificationLevel]}
                    description={
                      safetyProfile.termsSafetyAcceptedAt
                        ? `Sicherheitsbedingungen akzeptiert: ${formatDateTime(
                            safetyProfile.termsSafetyAcceptedAt
                          )}`
                        : "Sicherheitsbedingungen noch nicht bestätigt."
                    }
                  />

                  <SafetyInfoTile
                    label="Freigabestufe"
                    value={
                      <SafetyBadge level={safetyProfile.riskAccessLevel}>
                        {riskAccessLabels[safetyProfile.riskAccessLevel]}
                      </SafetyBadge>
                    }
                    description={
                      riskAccessDescriptions[safetyProfile.riskAccessLevel]
                    }
                  />

                  <SafetyInfoTile
                    label="Hochvolt"
                    value={getHvStatusText(
                      safetyProfile,
                      latestHvRequest || undefined
                    )}
                    description={
                      safetyProfile.hvVerified
                        ? `${hvQualificationLabels[safetyProfile.hvQualification]} ist manuell freigegeben.`
                        : latestHvRequest
                          ? `Letzter Antrag: ${formatDateTime(
                              latestHvRequest.created_at
                            )}`
                          : "Keine Hochvolt-Freigabe hinterlegt."
                    }
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 leading-7 text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
                  Höhere Freigaben werden nicht automatisch vergeben. Werkstatt-,
                  Rot- und Hochvolt-Einstufungen müssen manuell geprüft und
                  freigegeben werden.
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 leading-7 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Rechtlicher Hinweis: DiagnoseHUB übernimmt keine Verantwortung
                  für die Richtigkeit, Vollständigkeit oder Aktualität
                  angegebener Daten. Daten und Einstufungen werden so
                  verarbeitet, wie sie eingegeben, übermittelt oder freigegeben
                  wurden.
                </div>
              </div>
            ) : (
              <EmptyState text="Sicherheitsprofil konnte noch nicht geladen werden." />
            )}
          </Section>

          <Section
            title="Nutzungszähler"
            description="Der Monatszähler wird bei Login aus deinem Konto geladen und bei Diagnoseanfragen serverseitig erhöht."
            right={
              <button
                type="button"
                onClick={clearCurrentCase}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Aktuellen Fall leeren
              </button>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm text-slate-500">Quelle</p>
                <div className="mt-2">
                  <SourceBadge source={usageSource} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm text-slate-500">Datum</p>
                <p className="mt-2 font-bold text-slate-950 dark:text-white">
                  {formatDate(normalizedUsage.date)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <p className="text-sm text-slate-500">Anfragen diesen Monat</p>
                <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                  {normalizedUsage.count}
                </p>
              </div>
            </div>
          </Section>

          {latestCase && (
            <Section
              title="Letzter Fall"
              description="Schnellzugriff auf den zuletzt aktualisierten Diagnosefall."
              right={
                <button
                  type="button"
                  onClick={() => openDiagnosisCase(latestCase, "diagnose")}
                  className="rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500"
                >
                  Letzten Fall öffnen
                </button>
              }
            >
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-500/30 dark:bg-blue-500/10">
                <h3 className="text-xl font-bold text-slate-950 dark:text-white">
                  {latestCase.title || "Unbenannter Diagnosefall"}
                </h3>

                <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <span>Aktualisiert: {formatDateTime(latestCase.updatedAt)}</span>
                  <span>Fehlercode: {getFaultCodeText(latestCase)}</span>
                  <span>{latestCase.messages.length} Nachrichten</span>
                </div>
              </div>
            </Section>
          )}

          <Section
            title="Diagnosefälle"
            description="Gespeicherte Fälle. Lokale Alt-Fälle können übernommen werden."
            right={
              <>
                <button
                  type="button"
                  onClick={() => user && loadSupabaseCases(user, false)}
                  disabled={caseLoading}
                  className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  Fälle neu laden
                </button>

                <button
                  type="button"
                  onClick={migrateLocalCasesNow}
                  disabled={caseLoading}
                  className="rounded-2xl border border-green-200 bg-green-50 px-5 py-3 font-bold text-green-700 transition hover:bg-green-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-300 dark:hover:bg-green-500"
                >
                  Lokale Fälle übernehmen
                </button>

                <Link
                  href="/#diagnose"
                  className="rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500"
                >
                  Neuen Fall starten
                </Link>
              </>
            }
          >
            <div className="mb-5">
              <SourceBadge source={caseSource} />
            </div>

            {sortedCases.length === 0 ? (
              <EmptyState text="Noch keine gespeicherten Diagnosefälle vorhanden." />
            ) : (
              <div className="grid gap-4">
                {sortedCases.map((diagnosisCase) => (
                  <div
                    key={diagnosisCase.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-950 dark:text-white">
                          {diagnosisCase.title || "Unbenannter Diagnosefall"}
                        </h3>

                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          Aktualisiert: {formatDateTime(diagnosisCase.updatedAt)}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                          {diagnosisCase.engineContext?.code && (
                            <span>
                              Motorcode: {diagnosisCase.engineContext.code}
                            </span>
                          )}

                          <span>Fehlercode: {getFaultCodeText(diagnosisCase)}</span>
                          <span>{diagnosisCase.messages.length} Nachrichten</span>
                        </div>

                        <p className="mt-3 line-clamp-2 leading-7 text-slate-600 dark:text-slate-300">
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
                          className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500"
                        >
                          Öffnen
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openDiagnosisCase(diagnosisCase, "protocol")
                          }
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                        >
                          Prüfprotokoll
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteDiagnosisCase(diagnosisCase.id)}
                          disabled={caseLoading}
                          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500"
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
            title="Account löschen"
            description="Diesen Schritt bitte nur nutzen, wenn der DiagnoseHUB-Account wirklich vollständig entfernt werden soll."
          >
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 leading-7 text-red-950 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              <h3 className="text-xl font-black">Gefahrenbereich</h3>
              <p className="mt-2">
                Beim vollständigen Löschen werden der Login, gespeicherte Fälle,
                Profil, Geräte, Service-Erinnerungen und lokale Accountdaten
                entfernt. Ein laufendes Stripe-Abo wird vorher gekündigt.
                Rechnungs- und Zahlungsdaten können aus gesetzlichen Gründen
                weiterhin bei Stripe gespeichert bleiben.
              </p>

              <button
                type="button"
                onClick={() => {
                  setAccountDeleteOpen(true);
                  setAccountDeleteConfirmation("");
                  setError("");
                  setSuccess("");
                }}
                disabled={accountDeleteLoading}
                className="mt-4 rounded-2xl bg-red-600 px-5 py-3 font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Account komplett löschen
              </button>
            </div>
          </Section>

        </div>
      </main>

      {accountDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-delete-title"
            className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-6 shadow-2xl dark:border-red-500/30 dark:bg-slate-950"
          >
            <p className="text-sm font-black uppercase tracking-[0.25em] text-red-600 dark:text-red-300">
              Endgültige Löschung
            </p>
            <h2
              id="account-delete-title"
              className="mt-2 text-2xl font-black text-slate-950 dark:text-white"
            >
              Account wirklich löschen?
            </h2>
            <p className="mt-3 leading-7 text-slate-700 dark:text-slate-300">
              Diese Aktion löscht deinen DiagnoseHUB-Account und kündigt vorher
              ein vorhandenes Stripe-Abo. Danach kannst du dich mit diesem
              Account nicht mehr anmelden.
            </p>
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 leading-7 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Zur Bestätigung bitte exakt{" "}
              <span className="font-black">ACCOUNT LÖSCHEN</span> eingeben.
            </p>

            <label className="mt-5 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Bestätigung
              <input
                value={accountDeleteConfirmation}
                onChange={(event) =>
                  setAccountDeleteConfirmation(event.target.value)
                }
                autoFocus
                className="mt-2 w-full rounded-2xl border border-slate-400 bg-slate-100 px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-red-400 dark:focus:ring-red-500/20"
                placeholder="ACCOUNT LÖSCHEN"
              />
            </label>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setAccountDeleteOpen(false);
                  setAccountDeleteConfirmation("");
                }}
                disabled={accountDeleteLoading}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => void deleteAccountCompletely()}
                disabled={accountDeleteLoading || !canDeleteAccount}
                className="rounded-2xl bg-red-600 px-5 py-3 font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {accountDeleteLoading
                  ? "Abo und Account werden gelöscht..."
                  : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

