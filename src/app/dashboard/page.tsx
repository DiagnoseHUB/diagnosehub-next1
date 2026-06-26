"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type UserPlan = "free" | "werkstatt" | "pro";

type DemoAccount = {
  name: string;
  workshop: string;
  email: string;
  role: string;
  plan: UserPlan;
  updatedAt: string;
};

type DiagnosisUsage = {
  date: string;
  count: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type EngineContext = {
  engineType: string;
  source: string;
  label: string;
  code: string | null;
  notes?: string;
};

type FaultCodeInfo = {
  code: string;
  title: string;
  system: string;
  description: string;
  typicalCauses: string[];
  suggestedChecks: string[];
};

type FaultCodeContext = {
  foundCodes: FaultCodeInfo[];
  summary: string;
};

type SavedDiagnosisCase = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  engineContext: EngineContext | null;
  faultCodeContext: FaultCodeContext | null;
  qualityCheck: string;
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
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [usage, setUsage] = useState<DiagnosisUsage>(getInitialUsage());
  const [savedCases, setSavedCases] = useState<SavedDiagnosisCase[]>([]);
  const [premiumLeads, setPremiumLeads] = useState<PremiumLead[]>([]);
  const [success, setSuccess] = useState("");

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
    loadDashboardData();
  }, []);

  function showSuccess(message: string) {
    setSuccess(message);

    window.setTimeout(() => {
      setSuccess("");
    }, 2500);
  }

  function loadDashboardData() {
    try {
      const savedAccount = localStorage.getItem(DEMO_ACCOUNT_STORAGE_KEY);
      const savedPlan = localStorage.getItem(USER_PLAN_STORAGE_KEY);
      const savedUsage = localStorage.getItem(DIAGNOSIS_USAGE_STORAGE_KEY);
      const savedCaseList = localStorage.getItem(SAVED_CASES_STORAGE_KEY);
      const savedLeadList = localStorage.getItem(PREMIUM_LEADS_STORAGE_KEY);

      if (savedAccount) {
        const parsedAccount = JSON.parse(savedAccount) as DemoAccount;
        setAccount(parsedAccount);

        if (isValidUserPlan(parsedAccount.plan)) {
          setUserPlan(parsedAccount.plan);
        }
      } else {
        setAccount(null);
      }

      if (isValidUserPlan(savedPlan)) {
        setUserPlan(savedPlan);
      }

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

      if (savedCaseList) {
        const parsedCases = JSON.parse(savedCaseList);

        if (Array.isArray(parsedCases)) {
          setSavedCases(parsedCases);
        }
      } else {
        setSavedCases([]);
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
      console.error("Dashboard-Daten konnten nicht geladen werden:", error);
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

  function deleteSavedCase(caseId: string) {
    const updatedCases = savedCases.filter((savedCase) => {
      return savedCase.id !== caseId;
    });

    setSavedCases(updatedCases);
    localStorage.setItem(SAVED_CASES_STORAGE_KEY, JSON.stringify(updatedCases));

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

    showSuccess("Diagnosefall wurde gelöscht.");
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

  function exportDashboardSummary() {
    const lines = [
      "DiagnoseHUB Dashboard Export",
      "============================",
      "",
      `Exportiert am: ${new Date().toLocaleString("de-DE")}`,
      "",
      "Account",
      "-------",
      `Werkstatt: ${account?.workshop || "nicht eingerichtet"}`,
      `Name: ${account?.name || "nicht eingerichtet"}`,
      `E-Mail: ${account?.email || "nicht eingerichtet"}`,
      `Rolle: ${account?.role || "nicht eingerichtet"}`,
      "",
      "Plan",
      "----",
      `Aktiver Plan: ${currentPlan.label}`,
      `Diagnosen heute: ${normalizedUsage.count} / ${currentPlan.dailyLimit}`,
      `Gespeicherte Fälle: ${savedCases.length} / ${currentPlan.savedCaseLimit}`,
      "",
      "Gespeicherte Fälle",
      "-------------------",
      ...sortedCases.map((savedCase) => {
        return `${formatDateTime(savedCase.updatedAt)} | ${savedCase.title} | ${getFaultCodeText(savedCase)}`;
      }),
      "",
      "Premium-Vormerkungen",
      "---------------------",
      ...sortedLeads.map((lead) => {
        return `${formatDateTime(lead.createdAt)} | ${premiumLeadPlanLabels[lead.plan]} | ${lead.workshop} | ${lead.email}`;
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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-14">
        <section className="mb-10">
          <div className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-5 py-2 text-sm font-semibold text-blue-300">
            DiagnoseHUB Dashboard
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.45fr] lg:items-end">
            <div>
              <h1 className="text-5xl font-black tracking-tight md:text-6xl">
                Werkstatt-Übersicht.
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-400">
                Lokales Dashboard für den Prototyp. Fälle können direkt geöffnet
                oder gelöscht werden.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <button
                onClick={loadDashboardData}
                className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
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
            label="Vormerkungen"
            value={`${premiumLeads.length}`}
            subtext="Lokal gespeicherte Premium-Interessenten im Prototyp."
          />
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-8">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                Account
              </p>

              {account ? (
                <>
                  <h2 className="mt-3 text-3xl font-bold">
                    {account.workshop}
                  </h2>

                  <div className="mt-6 space-y-3 text-slate-400">
                    <p>
                      Bearbeiter:{" "}
                      <span className="font-semibold text-white">
                        {account.name}
                      </span>
                    </p>
                    <p>
                      E-Mail:{" "}
                      <span className="font-semibold text-white">
                        {account.email}
                      </span>
                    </p>
                    <p>
                      Rolle:{" "}
                      <span className="font-semibold text-white">
                        {account.role}
                      </span>
                    </p>
                    <p>
                      Aktualisiert:{" "}
                      <span className="font-semibold text-white">
                        {formatDateTime(account.updatedAt)}
                      </span>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-3 text-3xl font-bold">
                    Kein Account eingerichtet
                  </h2>

                  <p className="mt-4 leading-7 text-slate-400">
                    Lege zuerst einen lokalen Demo-Account an, damit Werkstatt
                    und Bearbeiter automatisch in Berichte übernommen werden.
                  </p>
                </>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/login"
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
                >
                  Account verwalten
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
                Im Prototyp wird die Nutzung lokal im Browser gezählt. Später
                muss das serverseitig über Benutzerkonto und Datenbank laufen.
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
                    Lokale Fallhistorie
                  </h2>
                </div>

                <a
                  href="/#diagnose"
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  Neuen Fall starten
                </a>
              </div>

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
                            onClick={() => deleteSavedCase(savedCase.id)}
                            className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
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

                  <h2 className="mt-2 text-3xl font-bold">
                    Vormerkungen
                  </h2>
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