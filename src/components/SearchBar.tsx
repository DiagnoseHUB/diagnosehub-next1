"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  deleteDiagnosisCaseFromSupabase,
  loadDiagnosisCasesFromSupabase,
  migrateLocalDiagnosisCasesToSupabase,
  saveDiagnosisCaseToSupabase,
  type ChatMessage,
  type EngineContext,
  type FaultCodeContext,
  type SavedDiagnosisCase,
} from "@/services/diagnosisCasesSupabase";
import {
  getInitialDiagnosisUsage,
  loadDiagnosisUsageFromSupabase,
  normalizeDiagnosisUsage,
  type DiagnosisUsage,
} from "@/services/diagnosisUsageSupabase";

type UserPlan = "free" | "werkstatt" | "pro";

type CurrentDiagnosisCase = {
  messages: ChatMessage[];
  engineContext: EngineContext | null;
  faultCodeContext: FaultCodeContext | null;
  qualityCheck: string;
  openedCaseId?: string | null;
};

type CaseStorageSource = "local" | "supabase";
type UsageStorageSource = "local" | "supabase";

type UsageLimitPayload = {
  enabled: boolean;
  source: "disabled" | "supabase";
  plan: UserPlan;
  planLabel: string;
  todayKey: string;
  countBefore: number;
  countAfter: number | null;
  maxDailyDiagnoses: number;
  remainingBefore: number;
  remainingAfter: number | null;
  limitReached: boolean;
  warning?: string;
};

type DiagnosisApiResponse = {
  result?: string;
  engineContext?: EngineContext;
  faultCodeContext?: FaultCodeContext | null;
  qualityCheck?: string;
  usageLimit?: UsageLimitPayload;
  error?: string;
};

const STORAGE_KEY = "diagnosehub-current-case";
const SAVED_CASES_STORAGE_KEY = "diagnosehub-saved-cases";
const USER_PLAN_STORAGE_KEY = "diagnosehub-user-plan";
const DIAGNOSIS_USAGE_STORAGE_KEY = "diagnosehub-diagnosis-usage";

const planLimits: Record<
  UserPlan,
  {
    label: string;
    dailyLimit: number;
    savedCaseLimit: number;
    badge: string;
    description: string;
  }
> = {
  free: {
    label: "Free",
    dailyLimit: 3,
    savedCaseLimit: 3,
    badge: "Kostenlos",
    description: "Für Tests und einzelne Diagnosefälle.",
  },
  werkstatt: {
    label: "Werkstatt Demo",
    dailyLimit: 30,
    savedCaseLimit: 25,
    badge: "Premium Demo",
    description: "Vorbereitung für den späteren Werkstatt-Zugang.",
  },
  pro: {
    label: "Werkstatt Pro Demo",
    dailyLimit: 100,
    savedCaseLimit: 100,
    badge: "Pro Demo",
    description: "Vorbereitung für größere Betriebe und höhere Nutzung.",
  },
};

const showLocalPlanSwitcher = process.env.NODE_ENV === "development";

const baseQuickQuestions = [
  "Welche Messwerte prüfen?",
  "Was prüfe ich als erstes?",
  "Häufigste Ursache eingrenzen",
  "Welche Live-Daten sind wichtig?",
];

function isValidUserPlan(value: string | null): value is UserPlan {
  return value === "free" || value === "werkstatt" || value === "pro";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unbekannter Fehler";
}

function buildDynamicQuickQuestions(
  engineContext: EngineContext | null,
  faultCodeContext: FaultCodeContext | null
) {
  const questions: string[] = [...baseQuickQuestions];

  if (engineContext?.engineType === "Diesel") {
    questions.push(
      "Raildruck Soll/Ist prüfen?",
      "Injektor-Rücklaufmenge prüfen?",
      "Ladedruck Soll/Ist prüfen?",
      "DPF-Differenzdruck prüfen?",
      "AGR Soll/Ist prüfen?"
    );
  }

  if (engineContext?.engineType === "Benziner") {
    questions.push(
      "Fuel Trims prüfen?",
      "Zündaussetzer je Zylinder prüfen?",
      "Falschluft prüfen?",
      "Kraftstoffdruck prüfen?",
      "Ladedruck Soll/Ist prüfen?"
    );
  }

  const firstFaultCode = faultCodeContext?.foundCodes[0];

  if (firstFaultCode) {
    questions.unshift(
      `Was bedeutet ${firstFaultCode.code}?`,
      `Prüfplan für ${firstFaultCode.code}`,
      `Messwerte zu ${firstFaultCode.code}`
    );

    const system = firstFaultCode.system.toLowerCase();

    if (system.includes("ladedruck") || system.includes("aufladung")) {
      questions.push(
        "Ladeluftstrecke abdrücken?",
        "VTG/Wastegate prüfen?",
        "Ladedrucksensor plausibel?",
        "Unterdrucksystem prüfen?"
      );
    }

    if (system.includes("raildruck") || system.includes("kraftstoffdruck")) {
      questions.push(
        "Raildruck beim Starten?",
        "Niederdruckversorgung prüfen?",
        "Mengenregelventil prüfen?",
        "Kraftstofffilter prüfen?"
      );
    }

    if (system.includes("agr")) {
      questions.push(
        "AGR Stellgliedtest?",
        "LMM Reaktion bei AGR prüfen?",
        "AGR Strecke verkokt?",
        "AGR Soll/Ist vergleichen?"
      );
    }

    if (system.includes("dieselpartikelfilter")) {
      questions.push(
        "DPF Differenzdruck Sollwert?",
        "Rußmasse und Aschemasse prüfen?",
        "Regeneration möglich?",
        "Differenzdrucksensor prüfen?"
      );
    }

    if (system.includes("gemisch")) {
      questions.push(
        "Short Term Fuel Trim?",
        "Long Term Fuel Trim?",
        "Ansaugsystem abnebeln?",
        "Lambdasonde plausibel?"
      );
    }

    if (system.includes("verbrennung") || system.includes("laufunruhe")) {
      questions.push(
        "Aussetzerzähler prüfen?",
        "Zylinder eingrenzen?",
        "Kompression prüfen?",
        "Injektor/Zündung quer prüfen?"
      );
    }
  }

  return Array.from(new Set(questions)).slice(0, 12);
}

function getCaseTitle(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user");

  if (!firstUserMessage) {
    return "Unbenannter Diagnosefall";
  }

  const cleanTitle = firstUserMessage.content.replace(/\s+/g, " ").trim();

  if (cleanTitle.length <= 70) {
    return cleanTitle;
  }

  return `${cleanTitle.slice(0, 70)}...`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
    console.error("Lokale Diagnosefälle konnten nicht gelesen werden:", error);
    return [];
  }
}

function saveCasesToLocalStorage(savedCases: SavedDiagnosisCase[]) {
  localStorage.setItem(SAVED_CASES_STORAGE_KEY, JSON.stringify(savedCases));
}

function saveUsageToLocalStorage(usage: DiagnosisUsage) {
  localStorage.setItem(DIAGNOSIS_USAGE_STORAGE_KEY, JSON.stringify(usage));
}

export default function SearchBar() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);

  const [caseStorageSource, setCaseStorageSource] =
    useState<CaseStorageSource>("local");
  const [caseSyncLoading, setCaseSyncLoading] = useState(false);
  const [caseSyncMessage, setCaseSyncMessage] = useState("");

  const [usageStorageSource, setUsageStorageSource] =
    useState<UsageStorageSource>("local");
  const [usageSyncLoading, setUsageSyncLoading] = useState(false);
  const [usageSyncMessage, setUsageSyncMessage] = useState("");

  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [engineContext, setEngineContext] = useState<EngineContext | null>(null);
  const [faultCodeContext, setFaultCodeContext] =
    useState<FaultCodeContext | null>(null);
  const [qualityCheck, setQualityCheck] = useState("");
  const [savedCases, setSavedCases] = useState<SavedDiagnosisCase[]>([]);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [diagnosisUsage, setDiagnosisUsage] = useState<DiagnosisUsage>(
    getInitialDiagnosisUsage()
  );
  const [copySuccess, setCopySuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [openedCaseId, setOpenedCaseId] = useState<string | null>(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const latestAssistantMessageRef = useRef<HTMLDivElement | null>(null);
  const loadingMessageRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedCaseRef = useRef(false);
  const shouldAutoScrollRef = useRef(false);

  const quickQuestions = useMemo(() => {
    return buildDynamicQuickQuestions(engineContext, faultCodeContext);
  }, [engineContext, faultCodeContext]);

  const latestAssistantMessageIndex = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") {
        return index;
      }
    }

    return -1;
  }, [messages]);

  const normalizedUsage = useMemo(() => {
    return normalizeDiagnosisUsage(diagnosisUsage);
  }, [diagnosisUsage]);

  const currentPlan = planLimits[userPlan];

  const remainingDiagnoses = Math.max(
    currentPlan.dailyLimit - normalizedUsage.count,
    0
  );

  const remainingSavedCases = Math.max(
    currentPlan.savedCaseLimit - savedCases.length,
    0
  );

  const diagnosisLimitReached = remainingDiagnoses <= 0;

  const openedCaseStillExists =
    openedCaseId !== null &&
    savedCases.some((savedCase) => savedCase.id === openedCaseId);

  const savedCaseLimitReached =
    savedCases.length >= currentPlan.savedCaseLimit && !openedCaseStillExists;

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    if (loading) {
      loadingMessageRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      return;
    }

    const lastMessage = messages[messages.length - 1];

    if (lastMessage?.role === "assistant") {
      latestAssistantMessageRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      shouldAutoScrollRef.current = false;
    }
  }, [messages, loading]);

  useEffect(() => {
    void initializeSearchBar();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, nextSession: Session | null) => {
        const nextUser = nextSession?.user ?? null;

        setUser(nextUser);

        if (nextUser) {
          await loadPlanForAuthenticatedUser(nextUser);
          await loadUsageForAuthenticatedUser(nextUser);
          await loadCasesForAuthenticatedUser(nextUser, loadLocalSavedCases());
        } else {
          setCaseStorageSource("local");
          setUsageStorageSource("local");
          setCaseSyncMessage("");
          setUsageSyncMessage("");
          loadLocalSavedCasesIntoState();
          loadLocalPlanAndUsage();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!hasLoadedCaseRef.current) {
      return;
    }

    if (messages.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const currentCase: CurrentDiagnosisCase = {
      messages,
      engineContext,
      faultCodeContext,
      qualityCheck,
      openedCaseId,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentCase));
  }, [messages, engineContext, faultCodeContext, qualityCheck, openedCaseId]);

  async function initializeSearchBar() {
    try {
      loadCurrentCaseFromLocalStorage();
      loadLocalPlanAndUsage();

      const localCases = loadLocalSavedCases();

      setSavedCases(localCases);

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setError(error.message);
        setCaseStorageSource("local");
        setUsageStorageSource("local");
        return;
      }

      const activeUser = data.session?.user ?? null;

      setUser(activeUser);

      if (activeUser) {
        await loadPlanForAuthenticatedUser(activeUser);
        await loadUsageForAuthenticatedUser(activeUser);
        await loadCasesForAuthenticatedUser(activeUser, localCases);
      } else {
        setCaseStorageSource("local");
        setUsageStorageSource("local");
      }
    } catch (error) {
      console.error("SearchBar konnte nicht initialisiert werden:", error);
      setError("DiagnoseHUB konnte gespeicherte Daten nicht vollständig laden.");
    } finally {
      hasLoadedCaseRef.current = true;
    }
  }

  function loadCurrentCaseFromLocalStorage() {
    try {
      const savedCurrentCase = localStorage.getItem(STORAGE_KEY);

      if (!savedCurrentCase) {
        return;
      }

      const parsedCase = JSON.parse(savedCurrentCase) as CurrentDiagnosisCase;

      setMessages(parsedCase.messages || []);
      setEngineContext(parsedCase.engineContext || null);
      setFaultCodeContext(parsedCase.faultCodeContext || null);
      setQualityCheck(parsedCase.qualityCheck || "");
      setOpenedCaseId(parsedCase.openedCaseId || null);
    } catch (error) {
      console.error("Aktueller Diagnosefall konnte nicht geladen werden:", error);
    }
  }

  function loadLocalSavedCasesIntoState() {
    const localCases = loadLocalSavedCases();

    setSavedCases(localCases);
  }

  function loadLocalPlanAndUsage() {
    try {
      const savedUserPlan = localStorage.getItem(USER_PLAN_STORAGE_KEY);
      const savedDiagnosisUsage = localStorage.getItem(
        DIAGNOSIS_USAGE_STORAGE_KEY
      );

      if (isValidUserPlan(savedUserPlan)) {
        setUserPlan(savedUserPlan);
      }

      if (savedDiagnosisUsage) {
        const parsedUsage = JSON.parse(savedDiagnosisUsage);
        const normalizedSavedUsage = normalizeDiagnosisUsage({
          date: parsedUsage.date || getInitialDiagnosisUsage().date,
          count: Number(parsedUsage.count) || 0,
        });

        setDiagnosisUsage(normalizedSavedUsage);
        saveUsageToLocalStorage(normalizedSavedUsage);
      }
    } catch (error) {
      console.error("Plan oder Nutzung konnte nicht geladen werden:", error);
    }
  }

  async function loadPlanForAuthenticatedUser(activeUser: User) {
    try {
      const { data, error } = await supabase
        .from("workshop_profiles")
        .select("plan")
        .eq("id", activeUser.id)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      const remotePlan =
        data && isValidUserPlan(String(data.plan)) ? data.plan : "free";

      setUserPlan(remotePlan);
      localStorage.setItem(USER_PLAN_STORAGE_KEY, remotePlan);
    } catch (error) {
      console.error("Supabase-Plan konnte nicht geladen werden:", error);
      setError(
        "Supabase-Plan konnte nicht geladen werden. Lokaler Plan bleibt aktiv."
      );
      loadLocalPlanAndUsage();
    }
  }

  async function loadUsageForAuthenticatedUser(activeUser: User) {
    setUsageSyncLoading(true);
    setError("");

    try {
      const remoteUsage = await loadDiagnosisUsageFromSupabase(
        supabase,
        activeUser
      );

      setDiagnosisUsage(remoteUsage);
      saveUsageToLocalStorage(remoteUsage);
      setUsageStorageSource("supabase");
      setUsageSyncMessage("Supabase-Nutzungszähler wurde geladen.");

      window.setTimeout(() => {
        setUsageSyncMessage("");
      }, 3000);
    } catch (error) {
      console.error("Supabase-Nutzung konnte nicht geladen werden:", error);
      setUsageStorageSource("local");
      setError(
        "Supabase-Nutzungszähler konnte nicht geladen werden. Lokaler Zähler bleibt aktiv."
      );
    } finally {
      setUsageSyncLoading(false);
    }
  }

  async function loadCasesForAuthenticatedUser(
    activeUser: User,
    localCasesForMigration: SavedDiagnosisCase[]
  ) {
    setCaseSyncLoading(true);
    setError("");

    try {
      if (localCasesForMigration.length > 0) {
        await migrateLocalDiagnosisCasesToSupabase(
          supabase,
          activeUser,
          localCasesForMigration
        );
      }

      const remoteCases = await loadDiagnosisCasesFromSupabase(
        supabase,
        activeUser
      );

      setSavedCases(remoteCases);
      saveCasesToLocalStorage(remoteCases);
      setCaseStorageSource("supabase");

      if (localCasesForMigration.length > 0) {
        setCaseSyncMessage("Lokale Fälle wurden mit Supabase synchronisiert.");
      } else {
        setCaseSyncMessage("Supabase-Fallhistorie wurde geladen.");
      }

      window.setTimeout(() => {
        setCaseSyncMessage("");
      }, 3000);
    } catch (error) {
      console.error("Supabase-Fallhistorie konnte nicht geladen werden:", error);
      setCaseStorageSource("local");
      setError(
        "Supabase-Fallhistorie konnte nicht geladen werden. Lokale Fälle bleiben verfügbar."
      );
      loadLocalSavedCasesIntoState();
    } finally {
      setCaseSyncLoading(false);
    }
  }

  async function reloadSupabaseCases() {
    if (!user) {
      setError("Für Supabase-Fallhistorie zuerst einloggen.");
      return;
    }

    await loadCasesForAuthenticatedUser(user, []);
  }

  async function reloadSupabaseUsage() {
    if (!user) {
      setError("Für Supabase-Nutzungszähler zuerst einloggen.");
      return;
    }

    await loadPlanForAuthenticatedUser(user);
    await loadUsageForAuthenticatedUser(user);
  }

  async function migrateLocalCasesNow() {
    if (!user) {
      setError("Für Migration zuerst einloggen.");
      return;
    }

    await loadCasesForAuthenticatedUser(user, loadLocalSavedCases());
  }

  function changeUserPlan(nextPlan: UserPlan) {
    if (user) {
      setError(
        "Bei aktivem Supabase-Login wird der Plan über Login/Profil gespeichert. Die Schnellumschaltung ist nur für lokale Tests ohne Login aktiv."
      );
      return;
    }

    setUserPlan(nextPlan);
    localStorage.setItem(USER_PLAN_STORAGE_KEY, nextPlan);
    setError("");
    setCopySuccess(false);
    setDownloadSuccess(false);
    setSaveSuccess(false);
  }

  function applyServerUsageLimit(usageLimit: UsageLimitPayload) {
    if (isValidUserPlan(usageLimit.plan)) {
      setUserPlan(usageLimit.plan);
      localStorage.setItem(USER_PLAN_STORAGE_KEY, usageLimit.plan);
    }

    const nextCount =
      typeof usageLimit.countAfter === "number"
        ? usageLimit.countAfter
        : usageLimit.countBefore;

    const nextUsage: DiagnosisUsage = {
      date: usageLimit.todayKey,
      count: nextCount,
    };

    setDiagnosisUsage(nextUsage);
    saveUsageToLocalStorage(nextUsage);
    setUsageStorageSource("supabase");

    if (usageLimit.warning) {
      setUsageSyncMessage(usageLimit.warning);
    } else {
      setUsageSyncMessage(
        `Serverlimit aktiv: ${nextCount} / ${usageLimit.maxDailyDiagnoses} Diagnosen heute.`
      );
    }

    window.setTimeout(() => {
      setUsageSyncMessage("");
    }, 3000);
  }

  function registerLocalSuccessfulDiagnosis() {
    const usageBeforeRequest = normalizeDiagnosisUsage(diagnosisUsage);

    const nextUsage: DiagnosisUsage = {
      date: usageBeforeRequest.date,
      count: usageBeforeRequest.count + 1,
    };

    setDiagnosisUsage(nextUsage);
    saveUsageToLocalStorage(nextUsage);
    setUsageStorageSource("local");
  }

  async function getAccessTokenForServerLimit() {
    if (!user) {
      return "";
    }

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Supabase-Session konnte nicht gelesen werden:", error);
      return "";
    }

    return data.session?.access_token || "";
  }

  async function sendDiagnosis(questionOverride?: string) {
    const currentInput = (questionOverride ?? search).trim();

    if (currentInput === "") {
      alert("Bitte gib zuerst ein Fahrzeug, einen Fehlercode oder ein Symptom ein.");
      return;
    }

    if (loading) {
      return;
    }

    const usageBeforeRequest = normalizeDiagnosisUsage(diagnosisUsage);
    const limitBeforeRequest = planLimits[userPlan].dailyLimit;

    if (usageBeforeRequest.count >= limitBeforeRequest) {
      setDiagnosisUsage(usageBeforeRequest);
      saveUsageToLocalStorage(usageBeforeRequest);

      setError(
        `Tageslimit erreicht: Im ${planLimits[userPlan].label}-Plan sind aktuell ${limitBeforeRequest} KI-Diagnosen pro Tag vorgesehen.`
      );

      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: currentInput,
    };

    const nextMessages = [...messages, userMessage];

    shouldAutoScrollRef.current = true;

    setMessages(nextMessages);
    setSearch("");
    setLoading(true);
    setError("");
    setQualityCheck("");
    setCopySuccess(false);
    setDownloadSuccess(false);
    setSaveSuccess(false);
    setCopiedMessageIndex(null);

    try {
      const accessToken = await getAccessTokenForServerLimit();
      const useServerUsageTracking = accessToken.length > 0;

      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: currentInput,
          messages,
          accessToken,
          useServerUsageTracking,
        }),
      });

      const data = (await response.json()) as DiagnosisApiResponse;

      if (!response.ok) {
        if (data.usageLimit) {
          applyServerUsageLimit(data.usageLimit);
        }

        throw new Error(data.error || "Unbekannter Fehler bei der KI-Diagnose.");
      }

      if (!data.result || !data.engineContext) {
        throw new Error("Die API hat keine vollständige Diagnose zurückgegeben.");
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.result,
      };

      setMessages([...nextMessages, assistantMessage]);
      setEngineContext(data.engineContext);
      setFaultCodeContext(data.faultCodeContext || null);
      setQualityCheck(data.qualityCheck || "");

      if (data.usageLimit?.enabled) {
        applyServerUsageLimit(data.usageLimit);
      } else {
        registerLocalSuccessfulDiagnosis();
      }
    } catch (error) {
      console.error(error);
      setError(getErrorMessage(error));
      shouldAutoScrollRef.current = false;
    } finally {
      setLoading(false);
    }
  }

  function resetDiagnosis() {
    setSearch("");
    setMessages([]);
    setEngineContext(null);
    setFaultCodeContext(null);
    setQualityCheck("");
    setCopySuccess(false);
    setDownloadSuccess(false);
    setSaveSuccess(false);
    setCopiedMessageIndex(null);
    setOpenedCaseId(null);
    setError("");
    shouldAutoScrollRef.current = false;
    localStorage.removeItem(STORAGE_KEY);
  }

  async function saveCurrentCase() {
    if (messages.length === 0) {
      return;
    }

    if (savedCaseLimitReached) {
      setError(
        `Falllimit erreicht: Im ${currentPlan.label}-Plan können aktuell ${currentPlan.savedCaseLimit} Fälle gespeichert werden. Für mehr gespeicherte Fälle den Werkstatt-Demo-Plan aktivieren.`
      );
      setSaveSuccess(false);
      setCopySuccess(false);
      setDownloadSuccess(false);
      setCopiedMessageIndex(null);
      return;
    }

    const now = new Date().toISOString();

    const existingCase = savedCases.find(
      (savedCase) => savedCase.id === openedCaseId
    );

    const caseToSave: SavedDiagnosisCase = {
      id: openedCaseId ?? crypto.randomUUID(),
      title: getCaseTitle(messages),
      createdAt: existingCase?.createdAt ?? now,
      updatedAt: now,
      messages,
      engineContext,
      faultCodeContext,
      qualityCheck,
    };

    let persistedCase = caseToSave;

    if (user) {
      setCaseSyncLoading(true);

      try {
        persistedCase = await saveDiagnosisCaseToSupabase(
          supabase,
          user,
          caseToSave
        );
        setCaseStorageSource("supabase");
        setCaseSyncMessage("Fall wurde in Supabase gespeichert.");
      } catch (error) {
        console.error("Fall konnte nicht in Supabase gespeichert werden:", error);
        setError(
          "Fall konnte nicht in Supabase gespeichert werden. Speichern wurde abgebrochen."
        );
        setCaseSyncLoading(false);
        return;
      } finally {
        setCaseSyncLoading(false);
      }
    }

    const updatedSavedCases = [
      persistedCase,
      ...savedCases.filter((savedCase) => savedCase.id !== persistedCase.id),
    ].slice(0, currentPlan.savedCaseLimit);

    setSavedCases(updatedSavedCases);
    setOpenedCaseId(persistedCase.id);
    saveCasesToLocalStorage(updatedSavedCases);

    setSaveSuccess(true);
    setCopySuccess(false);
    setDownloadSuccess(false);
    setCopiedMessageIndex(null);
    setError("");

    window.setTimeout(() => {
      setSaveSuccess(false);
      setCaseSyncMessage("");
    }, 2500);
  }

  function openSavedCase(savedCase: SavedDiagnosisCase) {
    shouldAutoScrollRef.current = false;

    setMessages(savedCase.messages);
    setEngineContext(savedCase.engineContext);
    setFaultCodeContext(savedCase.faultCodeContext);
    setQualityCheck(savedCase.qualityCheck);
    setOpenedCaseId(savedCase.id);
    setSearch("");
    setError("");
    setCopySuccess(false);
    setDownloadSuccess(false);
    setSaveSuccess(false);
    setCopiedMessageIndex(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteSavedCase(caseId: string) {
    if (user) {
      setCaseSyncLoading(true);

      try {
        await deleteDiagnosisCaseFromSupabase(supabase, user, caseId);
        setCaseSyncMessage("Fall wurde aus Supabase gelöscht.");
      } catch (error) {
        console.error("Fall konnte nicht aus Supabase gelöscht werden:", error);
        setError(
          "Fall konnte nicht aus Supabase gelöscht werden. Löschen wurde abgebrochen."
        );
        setCaseSyncLoading(false);
        return;
      } finally {
        setCaseSyncLoading(false);
      }
    }

    const updatedSavedCases = savedCases.filter(
      (savedCase) => savedCase.id !== caseId
    );

    setSavedCases(updatedSavedCases);
    saveCasesToLocalStorage(updatedSavedCases);

    if (openedCaseId === caseId) {
      setOpenedCaseId(null);
    }

    setError("");

    window.setTimeout(() => {
      setCaseSyncMessage("");
    }, 2500);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendDiagnosis();
    }
  }

  function buildFaultCodeReport() {
    if (!faultCodeContext || faultCodeContext.foundCodes.length === 0) {
      return "Keine bekannten Fehlercodes erkannt.";
    }

    return faultCodeContext.foundCodes
      .map((faultCode) => {
        return `${faultCode.code} - ${faultCode.title}
System: ${faultCode.system}
Beschreibung: ${faultCode.description}

Typische Ursachen:
${faultCode.typicalCauses.map((cause) => `- ${cause}`).join("\n")}

Empfohlene Prüfungen:
${faultCode.suggestedChecks.map((check) => `- ${check}`).join("\n")}`;
      })
      .join("\n\n---\n\n");
  }

  function buildCaseReport() {
    const createdAt = new Date().toLocaleString("de-DE");

    const motorInfo = engineContext
      ? [
          `Motortyp: ${engineContext.engineType}`,
          `Erkennung: ${engineContext.source}`,
          `Motorcode: ${engineContext.code ?? "nicht erkannt"}`,
          `Motor: ${engineContext.label}`,
          engineContext.notes ? `Hinweis: ${engineContext.notes}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "Motorkontext: nicht erkannt";

    const chatText = messages
      .map((message) => {
        const sender = message.role === "user" ? "Werkstatt" : "DiagnoseHUB";
        return `${sender}:\n${message.content}`;
      })
      .join("\n\n---\n\n");

    return `DiagnoseHUB Fallbericht
=========================

Erstellt am:
${createdAt}

Motorkontext:
${motorInfo}

Fehlercode-Kontext:
${buildFaultCodeReport()}

Qualitätsprüfung:
${qualityCheck || "Keine Qualitätsprüfung vorhanden."}

Diagnoseverlauf:
${chatText}
`;
  }

  async function copyCaseReport() {
    if (messages.length === 0) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildCaseReport());
      setCopySuccess(true);
      setDownloadSuccess(false);
      setSaveSuccess(false);
      setCopiedMessageIndex(null);
      setError("");

      window.setTimeout(() => {
        setCopySuccess(false);
      }, 2500);
    } catch (error) {
      console.error(error);
      setError("Fallbericht konnte nicht in die Zwischenablage kopiert werden.");
    }
  }

  async function copySingleMessage(content: string, index: number) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      setCopySuccess(false);
      setDownloadSuccess(false);
      setSaveSuccess(false);
      setError("");

      window.setTimeout(() => {
        setCopiedMessageIndex(null);
      }, 2500);
    } catch (error) {
      console.error(error);
      setError("Antwort konnte nicht in die Zwischenablage kopiert werden.");
    }
  }

  function downloadCaseReport() {
    if (messages.length === 0) {
      return;
    }

    try {
      const report = buildCaseReport();
      const blob = new Blob([report], {
        type: "text/plain;charset=utf-8",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const date = new Date().toISOString().slice(0, 10);
      const motorCode = engineContext?.code ?? "fall";
      const firstFaultCode = faultCodeContext?.foundCodes[0]?.code;
      const fileName = firstFaultCode
        ? `diagnosehub-${motorCode}-${firstFaultCode}-${date}.txt`
        : `diagnosehub-${motorCode}-${date}.txt`;

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setCopySuccess(false);
      setSaveSuccess(false);
      setCopiedMessageIndex(null);
      setError("");

      window.setTimeout(() => {
        setDownloadSuccess(false);
      }, 2500);
    } catch (error) {
      console.error(error);
      setError("Fallbericht konnte nicht heruntergeladen werden.");
    }
  }

  const caseStorageLabel =
    caseStorageSource === "supabase"
      ? "Supabase-Fallhistorie"
      : "Lokale Fallhistorie";

  const usageStorageLabel =
    usageStorageSource === "supabase"
      ? "Supabase-Nutzung"
      : "Lokale Nutzung";

  return (
    <div className="w-full">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-blue-950/30">
        <textarea
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            messages.length === 0
              ? "Beschreibe den Fehlerfall, z. B. VW Passat CBAB P0299 Leistungsverlust..."
              : "Folgefrage stellen, z. B. Ladedruck Sollwert?"
          }
          rows={4}
          className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
        />

        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-300">
                  {currentPlan.badge}
                </span>

                <p className="font-bold text-white">{currentPlan.label}</p>

                <p className="text-sm text-slate-500">
                  {normalizedUsage.count} / {currentPlan.dailyLimit} Diagnosen heute
                </p>

                <p className="text-sm text-slate-500">
                  {savedCases.length} / {currentPlan.savedCaseLimit} Fälle gespeichert
                </p>

                <span
                  className={
                    caseStorageSource === "supabase"
                      ? "rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-300"
                      : "rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-300"
                  }
                >
                  {caseStorageLabel}
                </span>

                <span
                  className={
                    usageStorageSource === "supabase"
                      ? "rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-300"
                      : "rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-300"
                  }
                >
                  {usageStorageLabel}
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-500">
                {currentPlan.description} Noch verfügbar:{" "}
                <span className="font-bold text-slate-300">
                  {remainingDiagnoses}
                </span>{" "}
                Diagnosen und{" "}
                <span className="font-bold text-slate-300">
                  {remainingSavedCases}
                </span>{" "}
                neue Speicherplätze.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                {user
                  ? `Supabase-Login aktiv: ${user.email}. Planänderung über Login/Profil speichern.`
                  : "Nicht eingeloggt: Fälle und Nutzung bleiben lokal auf diesem Gerät."}
              </p>
            </div>

         {showLocalPlanSwitcher && !user && (
  <div className="flex flex-wrap gap-2">
    {(["free", "werkstatt", "pro"] as UserPlan[]).map((plan) => (
      <button
        key={plan}
        onClick={() => changeUserPlan(plan)}
        title="Lokalen Testplan ändern"
        className={
          userPlan === plan
            ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
            : "rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-slate-800"
        }
      >
        {planLimits[plan].label}
      </button>
    ))}
  </div>
)}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={reloadSupabaseCases}
              disabled={!user || caseSyncLoading}
              className="rounded-xl border border-green-500/40 px-4 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {caseSyncLoading ? "Synchronisiert..." : "Fälle neu laden"}
            </button>

            <button
              onClick={reloadSupabaseUsage}
              disabled={!user || usageSyncLoading}
              className="rounded-xl border border-green-500/40 px-4 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {usageSyncLoading ? "Lädt..." : "Plan/Nutzung neu laden"}
            </button>

            <button
              onClick={migrateLocalCasesNow}
              disabled={!user || caseSyncLoading}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Lokale Fälle migrieren
            </button>

            {!user && (
              <a
                href="/login"
                className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500 hover:text-white"
              >
                Einloggen für Cloud-Speicher
              </a>
            )}
          </div>

          {caseSyncMessage && (
            <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              {caseSyncMessage}
            </div>
          )}

          {usageSyncMessage && (
            <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
              {usageSyncMessage}
            </div>
          )}

          {diagnosisLimitReached && (
            <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
              Tageslimit erreicht. Ändere den Plan im Login-Profil oder warte
              bis zum nächsten Tag.
            </div>
          )}

          {savedCaseLimitReached && (
            <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
              Falllimit erreicht. Du kannst bestehende Fälle überschreiben oder
              löschen. Für mehr gespeicherte Fälle den Werkstatt-Demo-Plan
              aktivieren.
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-slate-500">
            {messages.length === 0
              ? "Enter zum Senden · Shift + Enter für neue Zeile"
              : openedCaseId
                ? "Gespeicherter Fall geöffnet · Folgefrage im gleichen Fall stellen"
                : "Folgefrage im gleichen Diagnosefall stellen"}
          </p>

          <div className="flex flex-wrap gap-3">
            {messages.length > 0 && (
              <>
                <button
                  onClick={() => void saveCurrentCase()}
                  disabled={savedCaseLimitReached || caseSyncLoading}
                  className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-5 py-3 font-semibold text-blue-300 transition hover:bg-blue-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {caseSyncLoading ? "Speichert..." : "Fall speichern"}
                </button>

                <a
                  href="/pruefprotokoll"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-5 py-3 font-semibold text-blue-300 transition hover:bg-blue-500 hover:text-white"
                >
                  Prüfprotokoll drucken
                </a>

                <button
                  onClick={copyCaseReport}
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  Fallbericht kopieren
                </button>

                <button
                  onClick={downloadCaseReport}
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  TXT speichern
                </button>

                <button
                  onClick={resetDiagnosis}
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  Neuer Fall
                </button>
              </>
            )}

            <button
              onClick={() => void sendDiagnosis()}
              disabled={loading || diagnosisLimitReached}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Analysiere..."
                : messages.length === 0
                  ? "Diagnose starten"
                  : "Frage senden"}
            </button>
          </div>
        </div>
      </div>

      {copySuccess && (
        <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 px-6 py-4 text-green-300">
          Fallbericht wurde kopiert.
        </div>
      )}

      {downloadSuccess && (
        <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 px-6 py-4 text-green-300">
          Fallbericht wurde als TXT-Datei gespeichert.
        </div>
      )}

      {saveSuccess && (
        <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 px-6 py-4 text-green-300">
          Diagnosefall wurde gespeichert.
        </div>
      )}

      {savedCases.length > 0 && (
        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                Gespeicherte Fälle
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {caseStorageSource === "supabase"
                  ? "In Supabase gespeichert und lokal gespiegelt."
                  : "Lokal im Browser gespeichert."}{" "}
                Aktueller Plan:{" "}
                <span className="font-semibold text-slate-300">
                  {savedCases.length} / {currentPlan.savedCaseLimit}
                </span>{" "}
                Fälle.
              </p>
            </div>

            <p className="text-sm text-slate-500">
              {remainingSavedCases} Speicherplätze frei
            </p>
          </div>

          <div className="space-y-3">
            {savedCases.map((savedCase) => (
              <div
                key={savedCase.id}
                className={
                  openedCaseId === savedCase.id
                    ? "rounded-2xl border border-blue-500/50 bg-blue-500/10 p-4"
                    : "rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                }
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="font-bold text-white">{savedCase.title}</h3>

                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                      <span>Aktualisiert: {formatDateTime(savedCase.updatedAt)}</span>

                      {savedCase.engineContext?.code && (
                        <span>Motorcode: {savedCase.engineContext.code}</span>
                      )}

                      {savedCase.faultCodeContext?.foundCodes?.[0]?.code && (
                        <span>
                          Fehlercode:{" "}
                          {savedCase.faultCodeContext.foundCodes[0].code}
                        </span>
                      )}

                      <span>{savedCase.messages.length} Nachrichten</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => openSavedCase(savedCase)}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-blue-500 hover:text-blue-300"
                    >
                      Öffnen
                    </button>

                    <button
                      onClick={() => void deleteSavedCase(savedCase.id)}
                      disabled={caseSyncLoading}
                      className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {messages.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Schnellfragen
          </p>

          <div className="flex flex-wrap gap-3">
            {quickQuestions.map((question) => (
              <button
                key={question}
                onClick={() => void sendDiagnosis(question)}
                disabled={loading || diagnosisLimitReached}
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {engineContext && (
        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-blue-950/20">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-400">
            Erkannter Motorkontext
          </p>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm text-slate-500">Motortyp</p>
              <p className="mt-2 font-bold text-white">
                {engineContext.engineType}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm text-slate-500">Erkennung</p>
              <p className="mt-2 font-bold text-white">
                {engineContext.source}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm text-slate-500">Motorcode</p>
              <p className="mt-2 font-bold text-white">
                {engineContext.code ?? "nicht erkannt"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm text-slate-500">Motor</p>
              <p className="mt-2 font-bold text-white">{engineContext.label}</p>
            </div>
          </div>

          {engineContext.notes && (
            <p className="mt-4 text-sm text-slate-400">
              {engineContext.notes}
            </p>
          )}
        </section>
      )}

      {faultCodeContext && faultCodeContext.foundCodes.length > 0 && (
        <section className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-blue-950/20">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-400">
            Erkannte Fehlercodes
          </p>

          <div className="space-y-5">
            {faultCodeContext.foundCodes.map((faultCode) => (
              <div
                key={faultCode.code}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Fehlercode</p>
                    <h3 className="mt-1 text-2xl font-bold text-white">
                      {faultCode.code}
                    </h3>
                  </div>

                  <div className="md:text-right">
                    <p className="text-sm text-slate-500">System</p>
                    <p className="mt-1 font-semibold text-blue-300">
                      {faultCode.system}
                    </p>
                  </div>
                </div>

                <h4 className="mt-5 text-xl font-bold text-white">
                  {faultCode.title}
                </h4>

                <p className="mt-3 leading-7 text-slate-400">
                  {faultCode.description}
                </p>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="mb-3 font-semibold text-white">
                      Typische Ursachen
                    </p>

                    <ul className="space-y-2 text-slate-300">
                      {faultCode.typicalCauses.map((cause) => (
                        <li key={cause} className="flex gap-3">
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                          <span>{cause}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="mb-3 font-semibold text-white">
                      Empfohlene Prüfungen
                    </p>

                    <ol className="space-y-2 text-slate-300">
                      {faultCode.suggestedChecks.map((check, index) => (
                        <li key={check} className="flex gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <span>{check}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {qualityCheck && (
        <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
            Qualitätsprüfung
          </p>

          <p className="mt-2 text-slate-300">{qualityCheck}</p>
        </section>
      )}

      {messages.length > 0 && (
        <section className="mt-8 space-y-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-blue-950/30">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
            Diagnoseverlauf
          </p>

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              ref={
                message.role === "assistant" &&
                index === latestAssistantMessageIndex
                  ? latestAssistantMessageRef
                  : undefined
              }
              className={
                message.role === "user"
                  ? "ml-auto max-w-3xl rounded-2xl bg-blue-600 px-5 py-4 text-white"
                  : "mr-auto max-w-4xl scroll-mt-28 rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4 text-slate-300"
              }
            >
              <div className="mb-2 flex items-center justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                  {message.role === "user" ? "Du" : "DiagnoseHUB"}
                </p>

                {message.role === "assistant" && (
                  <button
                    onClick={() => copySingleMessage(message.content, index)}
                    className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-400 transition hover:border-blue-500 hover:text-blue-300"
                  >
                    {copiedMessageIndex === index ? "Kopiert" : "Antwort kopieren"}
                  </button>
                )}
              </div>

              <div className="whitespace-pre-wrap leading-8">
                {message.content}
              </div>
            </div>
          ))}

          {loading && (
            <div
              ref={loadingMessageRef}
              className="mr-auto max-w-4xl rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-blue-300"
            >
              DiagnoseHUB analysiert...
            </div>
          )}
        </section>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}