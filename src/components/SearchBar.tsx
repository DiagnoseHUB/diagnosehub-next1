"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

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

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
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

const STORAGE_KEY = "diagnosehub-current-case";
const SAVED_CASES_STORAGE_KEY = "diagnosehub-saved-cases";

const baseQuickQuestions = [
  "Welche Messwerte prüfen?",
  "Was prüfe ich als erstes?",
  "Häufigste Ursache eingrenzen",
  "Welche Live-Daten sind wichtig?",
];

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

export default function SearchBar() {
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [engineContext, setEngineContext] = useState<EngineContext | null>(null);
  const [faultCodeContext, setFaultCodeContext] =
    useState<FaultCodeContext | null>(null);
  const [qualityCheck, setQualityCheck] = useState("");
  const [savedCases, setSavedCases] = useState<SavedDiagnosisCase[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [openedCaseId, setOpenedCaseId] = useState<string | null>(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedCaseRef = useRef(false);

  const quickQuestions = useMemo(() => {
    return buildDynamicQuickQuestions(engineContext, faultCodeContext);
  }, [engineContext, faultCodeContext]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  useEffect(() => {
    try {
      const savedCurrentCase = localStorage.getItem(STORAGE_KEY);
      const savedCaseList = localStorage.getItem(SAVED_CASES_STORAGE_KEY);

      if (savedCurrentCase) {
        const parsedCase = JSON.parse(savedCurrentCase);

        setMessages(parsedCase.messages || []);
        setEngineContext(parsedCase.engineContext || null);
        setFaultCodeContext(parsedCase.faultCodeContext || null);
        setQualityCheck(parsedCase.qualityCheck || "");
        setOpenedCaseId(parsedCase.openedCaseId || null);
      }

      if (savedCaseList) {
        const parsedSavedCases = JSON.parse(savedCaseList);

        if (Array.isArray(parsedSavedCases)) {
          setSavedCases(parsedSavedCases);
        }
      }
    } catch (error) {
      console.error("Gespeicherte Diagnosefälle konnten nicht geladen werden:", error);
    } finally {
      hasLoadedCaseRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedCaseRef.current) {
      return;
    }

    if (messages.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const currentCase = {
      messages,
      engineContext,
      faultCodeContext,
      qualityCheck,
      openedCaseId,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentCase));
  }, [messages, engineContext, faultCodeContext, qualityCheck, openedCaseId]);

  async function sendDiagnosis(questionOverride?: string) {
    const currentInput = (questionOverride ?? search).trim();

    if (currentInput === "") {
      alert("Bitte gib zuerst ein Fahrzeug, einen Fehlercode oder ein Symptom ein.");
      return;
    }

    if (loading) {
      return;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: currentInput,
    };

    const nextMessages = [...messages, userMessage];

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
      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: currentInput,
          messages: messages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unbekannter Fehler bei der KI-Diagnose.");
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.result,
      };

      setMessages([...nextMessages, assistantMessage]);
      setEngineContext(data.engineContext);
      setFaultCodeContext(data.faultCodeContext || null);
      setQualityCheck(data.qualityCheck || "");
    } catch (error) {
      console.error(error);
      setError(
        "Die KI-Diagnose konnte nicht erstellt werden. Prüfe API-Key, Guthaben oder Server-Log."
      );
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
    localStorage.removeItem(STORAGE_KEY);
  }

  function saveCurrentCase() {
    if (messages.length === 0) {
      return;
    }

    const now = new Date().toISOString();

    const caseToSave: SavedDiagnosisCase = {
      id: openedCaseId ?? crypto.randomUUID(),
      title: getCaseTitle(messages),
      createdAt:
        savedCases.find((savedCase) => savedCase.id === openedCaseId)
          ?.createdAt ?? now,
      updatedAt: now,
      messages,
      engineContext,
      faultCodeContext,
      qualityCheck,
    };

    const updatedSavedCases = [
      caseToSave,
      ...savedCases.filter((savedCase) => savedCase.id !== caseToSave.id),
    ].slice(0, 25);

    setSavedCases(updatedSavedCases);
    setOpenedCaseId(caseToSave.id);
    localStorage.setItem(
      SAVED_CASES_STORAGE_KEY,
      JSON.stringify(updatedSavedCases)
    );

    setSaveSuccess(true);
    setCopySuccess(false);
    setDownloadSuccess(false);
    setCopiedMessageIndex(null);

    window.setTimeout(() => {
      setSaveSuccess(false);
    }, 2500);
  }

  function openSavedCase(savedCase: SavedDiagnosisCase) {
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
  }

  function deleteSavedCase(caseId: string) {
    const updatedSavedCases = savedCases.filter(
      (savedCase) => savedCase.id !== caseId
    );

    setSavedCases(updatedSavedCases);
    localStorage.setItem(
      SAVED_CASES_STORAGE_KEY,
      JSON.stringify(updatedSavedCases)
    );

    if (openedCaseId === caseId) {
      setOpenedCaseId(null);
    }
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

      window.setTimeout(() => {
        setDownloadSuccess(false);
      }, 2500);
    } catch (error) {
      console.error(error);
      setError("Fallbericht konnte nicht heruntergeladen werden.");
    }
  }

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
                  onClick={saveCurrentCase}
                  className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-5 py-3 font-semibold text-blue-300 transition hover:bg-blue-500 hover:text-white"
                >
                  Fall speichern
                </button>

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
              onClick={() => sendDiagnosis()}
              disabled={loading}
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
                Lokal im Browser gespeichert. Später wird das durch Benutzerkonto
                und Datenbank ersetzt.
              </p>
            </div>

            <p className="text-sm text-slate-500">{savedCases.length} Fälle</p>
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
                onClick={() => sendDiagnosis(question)}
                disabled={loading}
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
              className={
                message.role === "user"
                  ? "ml-auto max-w-3xl rounded-2xl bg-blue-600 px-5 py-4 text-white"
                  : "mr-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4 text-slate-300"
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
            <div className="mr-auto max-w-4xl rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-blue-300">
              DiagnoseHUB analysiert...
            </div>
          )}

          <div ref={messageEndRef} />
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