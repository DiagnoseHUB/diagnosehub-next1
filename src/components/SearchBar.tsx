"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import RelatedLearningPanel from "@/components/RelatedLearningPanel";
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
import {
  PLAN_CONFIG,
  SELECTABLE_USER_PLANS,
  getPlanConfig,
  isUnlimitedPlan,
  isValidUserPlan,
  type UserPlan,
} from "@/config/plans";
import { fetchJsonWithTimeout } from "@/utils/clientApi";

type CurrentDiagnosisCase = {
  messages: ChatMessage[];
  engineContext: EngineContext | null;
  faultCodeContext: FaultCodeContext | null;
  qualityCheck: string;
  causingPart?: string;
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

const showLocalPlanSwitcher = process.env.NODE_ENV === "development";

const baseQuickQuestions = [
  "Kurze Ausbauanleitung erstellen",
  "Welche Messwerte prüfen?",
  "Was prüfe ich als erstes?",
  "Häufigste Ursache eingrenzen",
  "Welche Live-Daten sind wichtig?",
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unbekannter Fehler";
}

function getFriendlyDiagnosisError(error: unknown) {
  const message = getErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("networkerror") ||
    normalizedMessage.includes("network error")
  ) {
    return "Die Diagnose konnte die Serververbindung nicht erreichen. Bitte prüfe Internet/VPN und versuche es erneut.";
  }

  return message;
}

function buildDynamicQuickQuestions(
  engineContext: EngineContext | null,
  faultCodeContext: FaultCodeContext | null,
) {
  const questions: string[] = [...baseQuickQuestions];

  if (engineContext?.engineType === "Diesel") {
    questions.push(
      "Raildruck Soll/Ist prüfen?",
      "Injektor-Rücklaufmenge prüfen?",
      "Ladedruck Soll/Ist prüfen?",
      "DPF-Differenzdruck prüfen?",
      "AGR Soll/Ist prüfen?",
    );
  }

  if (engineContext?.engineType === "Benziner") {
    questions.push(
      "Fuel Trims prüfen?",
      "Zuendaussetzer je Zylinder prüfen?",
      "Falschluft prüfen?",
      "Kraftstoffdruck prüfen?",
      "Ladedruck Soll/Ist prüfen?",
    );
  }

  const firstFaultCode = faultCodeContext?.foundCodes[0];

  if (firstFaultCode) {
    questions.unshift(
      `Was bedeutet ${firstFaultCode.code}?`,
      `Prüfplan für ${firstFaultCode.code}`,
      `Messwerte zu ${firstFaultCode.code}`,
    );

    const system = firstFaultCode.system.toLowerCase();

    if (system.includes("ladedruck") || system.includes("aufladung")) {
      questions.push(
        "Ladeluftstrecke abdrücken?",
        "VTG/Wastegate prüfen?",
        "Ladedrucksensor plausibel?",
        "Unterdrucksystem prüfen?",
      );
    }

    if (system.includes("raildruck") || system.includes("kraftstoffdruck")) {
      questions.push(
        "Raildruck beim Starten?",
        "Niederdruckversorgung prüfen?",
        "Mengenregelventil prüfen?",
        "Kraftstofffilter prüfen?",
      );
    }

    if (system.includes("agr")) {
      questions.push(
        "AGR Stellgliedtest?",
        "LMM Reaktion bei AGR prüfen?",
        "AGR Strecke verkokt?",
        "AGR Soll/Ist vergleichen?",
      );
    }

    if (system.includes("dieselpartikelfilter")) {
      questions.push(
        "DPF Differenzdruck Sollwert?",
        "Rußmasse und Aschemasse prüfen?",
        "Regeneration möglich?",
        "Differenzdrucksensor prüfen?",
      );
    }

    if (system.includes("gemisch")) {
      questions.push(
        "Short Term Fuel Trim?",
        "Long Term Fuel Trim?",
        "Ansaugsystem abnebeln?",
        "Lambdasonde plausibel?",
      );
    }

    if (system.includes("verbrennung") || system.includes("laufunruhe")) {
      questions.push(
        "Aussetzerzähller prüfen?",
        "Zylinder eingrenzen?",
        "Kompression prüfen?",
        "Injektor/Zündung quer prüfen?",
      );
    }
  }

  return Array.from(new Set(questions)).slice(0, 12);
}

type AssistantSection = {
  title: string;
  lines: string[];
};

function cleanMarkdownMarkers(value: string) {
  return value.replaceAll("**", "").trim();
}

function parseAssistantSections(content: string): AssistantSection[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sections: AssistantSection[] = [];
  let currentSection: AssistantSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);

    if (headingMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }

      currentSection = {
        title: cleanMarkdownMarkers(headingMatch[1]),
        lines: [],
      };

      continue;
    }

    if (!currentSection) {
      currentSection = {
        title: "Antwort",
        lines: [],
      };
    }

    currentSection.lines.push(line);
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections
    .map((section) => ({
      ...section,
      lines: section.lines.filter((line) => line.trim() !== ""),
    }))
    .filter((section) => section.title || section.lines.length > 0);
}

function getAssistantSectionClasses(title: string) {
  const normalizedTitle = title.toLowerCase();

  if (
    normalizedTitle.includes("kritisch") ||
    normalizedTitle.includes("achtung") ||
    normalizedTitle.includes("hinweis")
  ) {
    return {
      wrapper: "rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4",
      title: "text-yellow-200",
      badge: "bg-yellow-500/20 text-yellow-200",
      dot: "bg-yellow-300",
    };
  }

  if (
    normalizedTitle.includes("sofort") ||
    normalizedTitle.includes("prüfen") ||
    normalizedTitle.includes("diagnose")
  ) {
    return {
      wrapper: "rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4",
      title: "text-blue-100",
      badge: "bg-blue-500/20 text-blue-200",
      dot: "bg-blue-300",
    };
  }

  if (
    normalizedTitle.includes("nächste") ||
    normalizedTitle.includes("schritt") ||
    normalizedTitle.includes("arbeit") ||
    normalizedTitle.includes("zugang") ||
    normalizedTitle.includes("werkzeug")
  ) {
    return {
      wrapper: "rounded-2xl border border-green-500/30 bg-green-500/10 p-4",
      title: "text-green-100",
      badge: "bg-green-500/20 text-green-200",
      dot: "bg-green-300",
    };
  }

  return {
    wrapper: "rounded-2xl border border-slate-800 bg-slate-950/70 p-4",
    title: "text-slate-100",
    badge: "bg-slate-800 text-slate-300",
    dot: "bg-slate-500",
  };
}

function renderAssistantLine(
  line: string,
  lineIndex: number,
  dotClassName: string,
) {
  const trimmedLine = cleanMarkdownMarkers(line);

  if (!trimmedLine || trimmedLine === "---") {
    return null;
  }

  const bulletMatch = trimmedLine.match(/^[-•]\s+(.+)$/);
  const numberMatch = trimmedLine.match(/^(\d+)[.)]\s+(.+)$/);

  if (bulletMatch) {
    return (
      <div
        key={`${trimmedLine}-${lineIndex}`}
        className="flex gap-3 text-sm leading-6 text-slate-300"
      >
        <span
          className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClassName}`}
        />
        <span>{bulletMatch[1]}</span>
      </div>
    );
  }

  if (numberMatch) {
    return (
      <div
        key={`${trimmedLine}-${lineIndex}`}
        className="flex gap-3 text-sm leading-6 text-slate-300"
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-black text-slate-300">
          {numberMatch[1]}
        </span>
        <span>{numberMatch[2]}</span>
      </div>
    );
  }

  return (
    <p
      key={`${trimmedLine}-${lineIndex}`}
      className="text-sm leading-7 text-slate-300"
    >
      {trimmedLine}
    </p>
  );
}

function AssistantAnswer({ content }: { content: string }) {
  const sections = parseAssistantSections(content);

  if (sections.length === 0) {
    return (
      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
        {content}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section, sectionIndex) => {
        const classes = getAssistantSectionClasses(section.title);

        return (
          <section
            key={`${section.title}-${sectionIndex}`}
            className={classes.wrapper}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wide ${classes.badge}`}
              >
                {sectionIndex + 1}
              </span>

              <h3 className={`text-base font-black ${classes.title}`}>
                {section.title}
              </h3>
            </div>

            <div className="space-y-2">
              {section.lines.map((line, lineIndex) =>
                renderAssistantLine(line, lineIndex, classes.dot),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
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

function loadLocalSavedCases(userId?: string | null) {
  try {
    const savedCaseList = readAccountScopedLocalStorage(
      SAVED_CASES_STORAGE_KEY,
      userId,
    );

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

function saveCasesToLocalStorage(
  savedCases: SavedDiagnosisCase[],
  userId?: string | null,
) {
  writeAccountScopedLocalStorage(
    SAVED_CASES_STORAGE_KEY,
    JSON.stringify(savedCases),
    userId,
  );
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
  const [causingPart, setCausingPart] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [engineContext, setEngineContext] = useState<EngineContext | null>(
    null,
  );
  const [faultCodeContext, setFaultCodeContext] =
    useState<FaultCodeContext | null>(null);
  const [qualityCheck, setQualityCheck] = useState("");
  const [savedCases, setSavedCases] = useState<SavedDiagnosisCase[]>([]);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [diagnosisUsage, setDiagnosisUsage] = useState<DiagnosisUsage>(
    getInitialDiagnosisUsage(),
  );
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [openedCaseId, setOpenedCaseId] = useState<string | null>(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null,
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

  const currentPlan = getPlanConfig(userPlan);

  const monthlyLimit = currentPlan.dailyDiagnosisLimit;
  const planIsUnlimited = isUnlimitedPlan(userPlan);
  const diagnosisLimitLabel = planIsUnlimited ? "unbegrenzt" : String(monthlyLimit);
  const savedCaseLimitLabel = planIsUnlimited
    ? "unbegrenzt"
    : String(currentPlan.savedCaseLimit);

  const remainingDiagnoses = Math.max(monthlyLimit - normalizedUsage.count, 0);
  const remainingDiagnosesLabel = planIsUnlimited
    ? "unbegrenzt"
    : String(remainingDiagnoses);

  const savingDisabledForPlan = currentPlan.savedCaseLimit <= 0;

  const remainingSavedCases = savingDisabledForPlan
    ? 0
    : Math.max(currentPlan.savedCaseLimit - savedCases.length, 0);
  const remainingSavedCasesLabel = planIsUnlimited
    ? "unbegrenzt"
    : String(remainingSavedCases);

  const diagnosisLimitReached = remainingDiagnoses <= 0;

  const openedCaseStillExists =
    openedCaseId !== null &&
    savedCases.some((savedCase) => savedCase.id === openedCaseId);

  const savedCaseLimitReached =
    savingDisabledForPlan ||
    (savedCases.length >= currentPlan.savedCaseLimit && !openedCaseStillExists);

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
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        const nextUser = nextSession?.user ?? null;

        setUser(nextUser);

        if (nextUser) {
          loadCurrentCaseFromLocalStorage(nextUser.id);
          setSavedCases(loadLocalSavedCases(nextUser.id));
          window.setTimeout(() => {
            void (async () => {
              await loadPlanForAuthenticatedUser(nextUser);
              await loadUsageForAuthenticatedUser(nextUser);
              await loadCasesForAuthenticatedUser(nextUser, []);
            })();
          }, 0);
        } else {
          setCaseStorageSource("local");
          setUsageStorageSource("local");
          setCaseSyncMessage("");
          setUsageSyncMessage("");
          loadCurrentCaseFromLocalStorage(null);
          loadLocalSavedCasesIntoState(null);
          loadLocalPlanAndUsage();
        }
      },
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
      removeAccountScopedLocalStorage(STORAGE_KEY, user?.id);
      return;
    }

    const currentCase: CurrentDiagnosisCase = {
      messages,
      engineContext,
      faultCodeContext,
      qualityCheck,
      causingPart,
      openedCaseId,
    };

    writeAccountScopedLocalStorage(
      STORAGE_KEY,
      JSON.stringify(currentCase),
      user?.id,
    );
  }, [
    messages,
    engineContext,
    faultCodeContext,
    qualityCheck,
    causingPart,
    openedCaseId,
    user,
  ]);

  async function initializeSearchBar() {
    try {
      loadLocalPlanAndUsage();

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setError(error.message);
        loadCurrentCaseFromLocalStorage(null);
        loadLocalSavedCasesIntoState(null);
        setCaseStorageSource("local");
        setUsageStorageSource("local");
        return;
      }

      const activeUser = data.session?.user ?? null;

      setUser(activeUser);

      if (activeUser) {
        loadCurrentCaseFromLocalStorage(activeUser.id);
        setSavedCases(loadLocalSavedCases(activeUser.id));
        await loadPlanForAuthenticatedUser(activeUser);
        await loadUsageForAuthenticatedUser(activeUser);
        await loadCasesForAuthenticatedUser(activeUser, []);
      } else {
        loadCurrentCaseFromLocalStorage(null);
        loadLocalSavedCasesIntoState(null);
        setCaseStorageSource("local");
        setUsageStorageSource("local");
      }
    } catch (error) {
      console.error("SearchBar konnte nicht initialisiert werden:", error);
      setError(
        "DiagnoseHUB konnte gespeicherte Daten nicht vollständig laden.",
      );
    } finally {
      hasLoadedCaseRef.current = true;
    }
  }

  function loadCurrentCaseFromLocalStorage(userId?: string | null) {
    try {
      const savedCurrentCase = readAccountScopedLocalStorage(
        STORAGE_KEY,
        userId,
      );

      if (!savedCurrentCase) {
        setMessages([]);
        setEngineContext(null);
        setFaultCodeContext(null);
        setQualityCheck("");
        setCausingPart("");
        setOpenedCaseId(null);
        return;
      }

      const parsedCase = JSON.parse(savedCurrentCase) as CurrentDiagnosisCase;

      setMessages(parsedCase.messages || []);
      setEngineContext(parsedCase.engineContext || null);
      setFaultCodeContext(parsedCase.faultCodeContext || null);
      setQualityCheck(parsedCase.qualityCheck || "");
      setCausingPart(parsedCase.causingPart || "");
      setOpenedCaseId(parsedCase.openedCaseId || null);
    } catch (error) {
      console.error(
        "Aktueller Diagnosefall konnte nicht geladen werden:",
        error,
      );
    }
  }

  function loadLocalSavedCasesIntoState(userId?: string | null) {
    const localCases = loadLocalSavedCases(userId);

    setSavedCases(localCases);
  }

  function loadLocalPlanAndUsage() {
    try {
      const savedUserPlan = localStorage.getItem(USER_PLAN_STORAGE_KEY);
      const savedDiagnosisUsage = localStorage.getItem(
        DIAGNOSIS_USAGE_STORAGE_KEY,
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
        "Supabase-Plan konnte nicht geladen werden. Lokaler Plan bleibt aktiv.",
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
        activeUser,
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
        "Supabase-Nutzungszähler konnte nicht geladen werden. Lokaler Zähler bleibt aktiv.",
      );
    } finally {
      setUsageSyncLoading(false);
    }
  }

  async function loadCasesForAuthenticatedUser(
    activeUser: User,
    localCasesForMigration: SavedDiagnosisCase[],
  ) {
    setCaseSyncLoading(true);
    setError("");
    setSavedCases(loadLocalSavedCases(activeUser.id));

    try {
      if (localCasesForMigration.length > 0) {
        await migrateLocalDiagnosisCasesToSupabase(
          supabase,
          activeUser,
          localCasesForMigration,
        );
      }

      const remoteCases = await loadDiagnosisCasesFromSupabase(
        supabase,
        activeUser,
      );

      setSavedCases(remoteCases);
      saveCasesToLocalStorage(remoteCases, activeUser.id);
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
      console.error(
        "Supabase-Fallhistorie konnte nicht geladen werden:",
        error,
      );
      setCaseStorageSource("local");
      setError(
        "Supabase-Fallhistorie konnte nicht geladen werden. Lokale Fälle bleiben verfügbar.",
      );
      loadLocalSavedCasesIntoState(activeUser.id);
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

    await loadCasesForAuthenticatedUser(user, loadLocalSavedCases(user.id));
  }

  function changeUserPlan(nextPlan: UserPlan) {
    if (user) {
      setError(
        "Bei aktivem Supabase-Login wird der Plan über Login/Profil gespeichert. Die Schnellumschaltung ist nur für lokale Tests ohne Login aktiv.",
      );
      return;
    }

    setUserPlan(nextPlan);
    localStorage.setItem(USER_PLAN_STORAGE_KEY, nextPlan);
    setError("");
    setCopySuccess(false);
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
        `Serverlimit aktiv: ${nextCount} / ${usageLimit.maxDailyDiagnoses} KI-Anfragen diesen Monat.`,
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

  function isInstructionRequest(value: string) {
    const text = value.toLowerCase();

    return [
      "anleitung",
      "ausbau",
      "ausbauen",
      "ausbauen?",
      "einbau",
      "einbauen",
      "tauschen",
      "wechseln",
      "ersetzen",
      "demontieren",
      "montieren",
      "reparaturanleitung",
      "schritt für schritt",
      "druckbar",
    ].some((term) => text.includes(term));
  }

  function buildUnifiedDiagnosisInput(currentInput: string) {
    const cleanInput = currentInput.trim();

    if (!isInstructionRequest(cleanInput)) {
      return cleanInput;
    }

    return `Erstelle direkt im aktuellen Diagnosefall eine kompakte Werkstatt-Anleitung.

Aktuelle Eingabe:
${cleanInput}

Regeln für diese Antwort:
- Keine neue allgemeine Diagnose, sondern eine konkrete Anleitung aus der Eingabe und dem bisherigen Verlauf erstellen.
- Kompakt bleiben, aber arbeitstechnisch brauchbar.
- Nicht schreiben "Zugang schaffen", sondern konkrete typische Demontage nennen.
- Konkrete Verkleidungen, Abdeckungen, Stecker, Halter, Befestigungen und Richtung/Lage nennen, wenn sinnvoll.
- Linksgewinde nennen, wenn möglich oder typisch.
- Schrauben, Exzenter, Einstellpunkte oder Markierungen nennen, die nicht gelöst oder nicht verstellt werden dürfen.
- Keine erfundenen Drehmomente, Fuellmengen oder Herstellersollwerte.
- Daten sichern nur nennen, wenn Steuergerät/Codierung/Programmierung/Anlernung betroffen ist.
- Batterie abklemmen nur nennen, wenn technisch notwendig.

Antwortformat exakt:
# Werkzeug
# Zugang
# Arbeitsschritte
# Kritische Punkte
# Abschlussprüfung`;
  }

  async function sendDiagnosis(questionOverride?: string) {
    const currentInput = (questionOverride ?? search).trim();

    if (currentInput === "") {
      alert(
        "Bitte gib zuerst ein Fahrzeug, einen Fehlercode oder ein Symptom ein.",
      );
      return;
    }

    if (loading) {
      return;
    }

    if (!user) {
      setError(
        "Bitte zuerst einloggen. Free-Diagnosen werden serverseitig gezählt, damit die Monatslimits fair bleiben.",
      );
      return;
    }

    const usageBeforeRequest = normalizeDiagnosisUsage(diagnosisUsage);
    const requestPlan = getPlanConfig(userPlan);
    const limitBeforeRequest = requestPlan.dailyDiagnosisLimit;

    if (usageBeforeRequest.count >= limitBeforeRequest) {
      setDiagnosisUsage(usageBeforeRequest);
      saveUsageToLocalStorage(usageBeforeRequest);

      setError(
        `Monatslimit erreicht: Im ${requestPlan.label}-Plan sind aktuell ${limitBeforeRequest} KI-Anfragen pro Monat vorgesehen. Folgefragen zählen mit.`,
      );

      return;
    }

    const diagnosisInput = buildUnifiedDiagnosisInput(currentInput);

    const userMessage: ChatMessage = {
      role: "user",
      content: diagnosisInput,
    };

    const nextMessages = [...messages, userMessage];

    shouldAutoScrollRef.current = true;

    setMessages(nextMessages);
    setSearch("");
    setLoading(true);
    setError("");
    setQualityCheck("");
    setCopySuccess(false);
    setSaveSuccess(false);
    setCopiedMessageIndex(null);

    try {
      const accessToken = await getAccessTokenForServerLimit();

      const { response, data } =
        await fetchJsonWithTimeout<DiagnosisApiResponse>(
          "/api/diagnose",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: diagnosisInput,
              messages,
              accessToken,
            }),
          },
          65000
        );

      if (!response.ok) {
        if (data.usageLimit) {
          applyServerUsageLimit(data.usageLimit);
        }

        throw new Error(
          data.error || "Unbekannter Fehler bei der KI-Diagnose.",
        );
      }

      if (!data.result || !data.engineContext) {
        throw new Error(
          "Die API hat keine vollständige Diagnose zurückgegeben.",
        );
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
      setError(getFriendlyDiagnosisError(error));
      shouldAutoScrollRef.current = false;
    } finally {
      setLoading(false);
    }
  }

  function resetDiagnosis() {
    setSearch("");
    setCausingPart("");
    setMessages([]);
    setEngineContext(null);
    setFaultCodeContext(null);
    setQualityCheck("");
    setCopySuccess(false);
    setSaveSuccess(false);
    setCopiedMessageIndex(null);
    setOpenedCaseId(null);
    setError("");
    shouldAutoScrollRef.current = false;
    removeAccountScopedLocalStorage(STORAGE_KEY, user?.id);
  }

  async function saveCurrentCase() {
    if (messages.length === 0) {
      return;
    }

    if (savingDisabledForPlan) {
      setError(
        `Speichern ist im ${currentPlan.label}-Plan nicht enthalten. Für gespeicherte Fälle brauchst du Pro.`,
      );
      setSaveSuccess(false);
      setCopySuccess(false);
      setCopiedMessageIndex(null);
      return;
    }

    if (savedCaseLimitReached) {
      setError(
        `Falllimit erreicht: Im ${currentPlan.label}-Plan können aktuell ${currentPlan.savedCaseLimit} Fälle gespeichert werden.`,
      );
      setSaveSuccess(false);
      setCopySuccess(false);
      setCopiedMessageIndex(null);
      return;
    }

    const now = new Date().toISOString();

    const existingCase = savedCases.find(
      (savedCase) => savedCase.id === openedCaseId,
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
          caseToSave,
        );
        setCaseStorageSource("supabase");
        setCaseSyncMessage("Fall wurde in Supabase gespeichert.");
      } catch (error) {
        console.error(
          "Fall konnte nicht in Supabase gespeichert werden:",
          error,
        );
        setError(
          "Fall konnte nicht in Supabase gespeichert werden. Speichern wurde abgebrochen.",
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
    saveCasesToLocalStorage(updatedSavedCases, user?.id);

    setSaveSuccess(true);
    setCopySuccess(false);
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
          "Fall konnte nicht aus Supabase gelöscht werden. Löschen wurde abgebrochen.",
        );
        setCaseSyncLoading(false);
        return;
      } finally {
        setCaseSyncLoading(false);
      }
    }

    const updatedSavedCases = savedCases.filter(
      (savedCase) => savedCase.id !== caseId,
    );

    setSavedCases(updatedSavedCases);
    saveCasesToLocalStorage(updatedSavedCases, user?.id);

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

    const causingPartText = causingPart.trim()
      ? `Schadensverursachendes Teil:\n${causingPart.trim()}`
      : "Schadensverursachendes Teil:\nüber Eingabe/Fallverlauf";

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

${causingPartText}

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
      setSaveSuccess(false);
      setCopiedMessageIndex(null);
      setError("");

      window.setTimeout(() => {
        setCopySuccess(false);
      }, 2500);
    } catch (error) {
      console.error(error);
      setError(
        "Fallbericht konnte nicht in die Zwischenablage kopiert werden.",
      );
    }
  }

  async function copySingleMessage(content: string, index: number) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      setCopySuccess(false);
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

  const caseStorageLabel =
    caseStorageSource === "supabase"
      ? "Supabase-Fallhistorie"
      : "Lokale Fallhistorie";

  const usageStorageLabel =
    usageStorageSource === "supabase" ? "Supabase-Nutzung" : "Lokale Nutzung";

  return (
    <div className="w-full">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-blue-950/30">
        <textarea
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            messages.length === 0
              ? "Diagnose oder Anleitung eingeben, z. B. VW Passat P0299 Leistungsverlust oder Qashqai Gebläsemotor ausbauen..."
              : "Folgefrage, Messwertfrage oder Anleitung eingeben, z. B. Ladedruck Sollwert? oder Ausbauanleitung AGR-Ventil..."
          }
          rows={4}
          className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white outline-none placeholder:text-slate-400 focus:border-blue-500"
        />

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Ein Feld für alles
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Diagnose
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Anleitung
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Folgefrage
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5">
            Messwerte
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-300">
                  {currentPlan.badge}
                </span>

                <p className="font-bold text-white">{currentPlan.label}</p>

                <p className="text-sm text-slate-400">
                  {normalizedUsage.count} / {diagnosisLimitLabel} KI-Anfragen diesen
                  Monat
                </p>

                <p className="text-sm text-slate-400">
                  {savingDisabledForPlan
                    ? "Speichern erst ab Pro"
                    : `${savedCases.length} / ${savedCaseLimitLabel} Fälle gespeichert`}
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

              <p className="mt-2 text-sm text-slate-400">
                {currentPlan.description} Noch verfügbar:{" "}
                <span className="font-bold text-slate-300">
                  {remainingDiagnosesLabel}
                </span>{" "}
                KI-Anfragen. {savingDisabledForPlan ? (
                  <span className="font-bold text-yellow-300">
                    Speichern ist erst ab Pro enthalten.
                  </span>
                ) : (
                  <>
                    Noch freie Speicherplätze:{" "}
                    <span className="font-bold text-slate-300">
                      {remainingSavedCasesLabel}
                    </span>
                    .
                  </>
                )}
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {user
                  ? `Supabase-Login aktiv: ${user.email}.`
                  : "Nicht eingeloggt: Bitte einloggen, um Diagnosen mit serverseitigem Monatslimit zu starten."}
              </p>
            </div>

            {showLocalPlanSwitcher && !user && (
              <div className="flex flex-wrap gap-2">
                {SELECTABLE_USER_PLANS.map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => changeUserPlan(plan)}
                    title="Lokalen Testplan ändern"
                    className={
                      userPlan === plan
                        ? "rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
                        : "rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-slate-800"
                    }
                  >
                    {PLAN_CONFIG[plan].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reloadSupabaseCases}
              disabled={!user || caseSyncLoading}
              className="rounded-xl border border-green-500/40 px-4 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {caseSyncLoading ? "Synchronisiert..." : "Fälle neu laden"}
            </button>

            <button
              type="button"
              onClick={reloadSupabaseUsage}
              disabled={!user || usageSyncLoading}
              className="rounded-xl border border-green-500/40 px-4 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {usageSyncLoading ? "Lädt..." : "Plan/Nutzung neu laden"}
            </button>

            <button
              type="button"
              onClick={migrateLocalCasesNow}
              disabled={!user || caseSyncLoading}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Lokale Fälle migrieren
            </button>

            {!user && (
              <a
                href="/login"
                className="rounded-xl border border-blue-500/40 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500 hover:text-white"
              >
                Login öffnen
              </a>
            )}
          </div>

          {(caseSyncMessage || usageSyncMessage) && (
            <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm font-semibold text-green-300">
              {caseSyncMessage || usageSyncMessage}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void sendDiagnosis()}
            disabled={loading || diagnosisLimitReached || !user}
            className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "DiagnoseHUB arbeitet..."
              : !user
                ? "Login erforderlich"
              : diagnosisLimitReached
                ? "Monatslimit erreicht"
                : search.trim() && isInstructionRequest(search)
                  ? "Anleitung erstellen"
                  : messages.length === 0
                    ? "Diagnose starten"
                    : "Senden"}
          </button>

          <button
            type="button"
            onClick={resetDiagnosis}
            className="rounded-xl border border-slate-700 px-5 py-3 font-bold text-slate-300 transition hover:bg-slate-800"
          >
            Neuer Fall
          </button>

          <button
            type="button"
            onClick={() => void saveCurrentCase()}
            disabled={messages.length === 0 || savedCaseLimitReached}
            className="rounded-xl border border-green-500/40 px-5 py-3 font-bold text-green-300 transition hover:bg-green-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingDisabledForPlan ? "Speichern ab Pro" : "Fall speichern"}
          </button>

          <button
            type="button"
            onClick={copyCaseReport}
            disabled={messages.length === 0}
            className="rounded-xl border border-slate-700 px-5 py-3 font-bold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bericht kopieren
          </button>
        </div>

        {(copySuccess || saveSuccess) && (
          <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm font-semibold text-green-300">
            {copySuccess && "Fallbericht wurde kopiert."}
            {saveSuccess && "Fall wurde gespeichert."}
          </div>
        )}
      </div>

      {loading && (
        <div
          ref={loadingMessageRef}
          className="mt-6 rounded-3xl border border-blue-500/30 bg-blue-500/10 p-6 text-blue-100"
        >
          <p className="font-black">DiagnoseHUB analysiert den Fall...</p>
          <p className="mt-2 text-sm text-blue-200">
            Fehlercode, Motorkontext und bisherigen Verlauf werden verarbeitet.
          </p>
        </div>
      )}

      {messages.length > 0 && (
        <div className="mt-6 space-y-5">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              ref={
                index === latestAssistantMessageIndex
                  ? latestAssistantMessageRef
                  : null
              }
              className={
                message.role === "user"
                  ? "rounded-3xl border border-blue-300 bg-blue-50 p-6 text-slate-950 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-50"
                  : "rounded-3xl border border-slate-200 bg-white p-6 text-slate-950 shadow-lg shadow-blue-950/10 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-100 dark:shadow-blue-950/20"
              }
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p
                  className={
                    message.role === "user"
                      ? "text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-200"
                      : "text-sm font-black uppercase tracking-wide text-slate-600 dark:text-slate-400"
                  }
                >
                  {message.role === "user" ? "Werkstatt" : "DiagnoseHUB"}
                </p>

                {message.role === "assistant" && (
                  <button
                    type="button"
                    onClick={() =>
                      void copySingleMessage(message.content, index)
                    }
                    className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-slate-800"
                  >
                    {copiedMessageIndex === index
                      ? "Kopiert"
                      : "Antwort kopieren"}
                  </button>
                )}
              </div>

              {message.role === "assistant" ? (
                <AssistantAnswer content={message.content} />
              ) : (
                <div className="whitespace-pre-wrap leading-8">
                  {message.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Schnellfragen
          </p>

          <div className="flex flex-wrap gap-3">
            {quickQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => void sendDiagnosis(question)}
                disabled={loading || diagnosisLimitReached || !user}
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <RelatedLearningPanel
          faultCodes={
            faultCodeContext?.foundCodes.map((faultCode) => faultCode.code) ??
            []
          }
          parts={causingPart.trim() ? [causingPart.trim()] : []}
          systems={[
            engineContext?.engineType ?? "",
            ...(faultCodeContext?.foundCodes.map(
              (faultCode) => faultCode.system,
            ) ?? []),
          ].filter(Boolean)}
        />
      )}

      {(engineContext ||
        (faultCodeContext && faultCodeContext.foundCodes.length > 0) ||
        qualityCheck) && (
        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-blue-300">
                Technische Zusatzinfos
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Motorkontext, Fehlercodes und Qualitätsprüfung bei Bedarf
                öffnen.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {engineContext && (
              <details className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-100">
                      Erkannter Motorkontext
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {engineContext.engineType} ·{" "}
                      {engineContext.code ?? "Motorcode nicht erkannt"}
                    </p>
                  </div>

                  <span className="rounded-xl border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400 transition group-open:bg-slate-800 group-open:text-slate-200">
                    Öffnen
                  </span>
                </summary>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Motortyp
                    </p>
                    <p className="mt-1 font-bold text-white">
                      {engineContext.engineType}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Motor
                    </p>
                    <p className="mt-1 font-bold text-white">
                      {engineContext.label}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Motorcode
                    </p>
                    <p className="mt-1 font-bold text-white">
                      {engineContext.code ?? "nicht erkannt"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-900/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Erkennung
                    </p>
                    <p className="mt-1 font-bold text-white">
                      {engineContext.source}
                    </p>
                  </div>
                </div>

                {engineContext.notes && (
                  <p className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
                    {engineContext.notes}
                  </p>
                )}
              </details>
            )}

            {faultCodeContext && faultCodeContext.foundCodes.length > 0 && (
              <details className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-100">
                      Erkannte Fehlercodes
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {faultCodeContext.foundCodes.length} erkannte Codes
                    </p>
                  </div>

                  <span className="rounded-xl border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400 transition group-open:bg-slate-800 group-open:text-slate-200">
                    Öffnen
                  </span>
                </summary>

                <div className="mt-4 grid gap-4">
                  {faultCodeContext.foundCodes.map((faultCode) => (
                    <div
                      key={faultCode.code}
                      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-blue-600 px-3 py-1 text-sm font-black text-white">
                          {faultCode.code}
                        </span>

                        <h3 className="text-lg font-black text-white">
                          {faultCode.title}
                        </h3>
                      </div>

                      <p className="mt-2 text-sm font-semibold text-slate-400">
                        {faultCode.system}
                      </p>

                      <p className="mt-3 leading-7 text-slate-300">
                        {faultCode.description}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {qualityCheck && (
              <details className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-100">
                      Qualitätsprüfung
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Technische Plausibilitätskontrolle der Antwort
                    </p>
                  </div>

                  <span className="rounded-xl border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400 transition group-open:bg-slate-800 group-open:text-slate-200">
                    Öffnen
                  </span>
                </summary>

                <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm leading-6 text-slate-300">
                  {qualityCheck}
                </p>
              </details>
            )}
          </div>
        </div>
      )}

      {savedCases.length > 0 && (
        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-blue-300">
                Fallhistorie
              </p>

              <h2 className="mt-1 text-2xl font-black text-white">
                Gespeicherte Fälle
              </h2>
            </div>

            <p className="text-sm text-slate-400">
              {savingDisabledForPlan
                ? "Speichern erst ab Pro"
                : `${savedCases.length} / ${savedCaseLimitLabel}`}
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            {savedCases.map((savedCase) => (
              <div
                key={savedCase.id}
                className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-bold text-white">{savedCase.title}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Aktualisiert: {formatDateTime(savedCase.updatedAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openSavedCase(savedCase)}
                      className="rounded-xl border border-blue-500/40 px-4 py-2 text-sm font-bold text-blue-300 transition hover:bg-blue-500 hover:text-white"
                    >
                      Öffnen
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteSavedCase(savedCase.id)}
                      className="rounded-xl border border-red-500/40 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500 hover:text-white"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
