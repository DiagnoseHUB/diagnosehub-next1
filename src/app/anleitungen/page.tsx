"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import InstructionCard from "../../components/InstructionCard";
import { instructions } from "../../data/instructions";
import type {
  InstructionCategory,
  InstructionGuide,
} from "../../types/instruction";
import { fetchJsonWithTimeout } from "@/utils/clientApi";

const allCategoryLabel = "Alle";

type SimilarInstructionMatch = {
  score: number;
  matchedTerms: string[];
  guide: {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    category: InstructionCategory;
  };
};

type GenerateInstructionResponse = {
  guide?: InstructionGuide;
  error?: string;
  jobId?: string;
  status?: string;
  saveWarning?: string;
  reusedExisting?: boolean;
  matchScore?: number;
  matchedTerms?: string[];
  similarMatches?: SimilarInstructionMatch[];
};

type SavedInstructionsResponse = {
  guides?: InstructionGuide[];
  error?: string;
};

export default function InstructionsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <Suspense
        fallback={
          <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
            <section className="mx-auto max-w-7xl">
              <p className="text-slate-600 dark:text-slate-300">
                Anleitungen werden geladen...
              </p>
            </section>
          </main>
        }
      >
        <InstructionsPageContent />
      </Suspense>

      <Footer />
    </div>
  );
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function pollGeneratedInstruction(
  jobId: string,
  query: string
): Promise<GenerateInstructionResponse> {
  const maxAttempts = 120;
  const pollingIntervalMs = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(
      `/api/anleitungen/generate?jobId=${encodeURIComponent(
        jobId
      )}&query=${encodeURIComponent(query)}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const responseText = await response.text();

    if (!responseText) {
      throw new Error(
        `Die API hat beim Abrufen leer geantwortet. Status: ${response.status}`
      );
    }

    let data: GenerateInstructionResponse;

    try {
      data = JSON.parse(responseText) as GenerateInstructionResponse;
    } catch {
      throw new Error(
        `Die API hat beim Abrufen keine gültige JSON-Antwort geliefert. Status: ${
          response.status
        }. Antwort: ${responseText.slice(0, 300)}`
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
          `KI-Job konnte nicht gelesen werden. Status: ${response.status}`
      );
    }

    if (data.guide) {
      return data;
    }

    if (
      data.status &&
      data.status !== "queued" &&
      data.status !== "in_progress"
    ) {
      throw new Error(`KI-Job wurde beendet mit Status: ${data.status}`);
    }

    await wait(pollingIntervalMs);
  }

  throw new Error(
    "Die KI-Anleitung dauert laenger als 10 Minuten. Bitte die Anfrage etwas kuerzer formulieren oder später erneut versuchen."
  );
}

function InstructionsPageContent() {
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    InstructionCategory | typeof allCategoryLabel
  >(allCategoryLabel);

  const [savedInstructions, setSavedInstructions] = useState<
    InstructionGuide[]
  >([]);
  const [savedInstructionsLoading, setSavedInstructionsLoading] =
    useState(true);
  const [savedInstructionsError, setSavedInstructionsError] = useState("");

  const [generatedInstruction, setGeneratedInstruction] =
    useState<InstructionGuide | null>(null);
  const [generatingInstruction, setGeneratingInstruction] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [reusedExistingInstruction, setReusedExistingInstruction] =
    useState(false);
  const [instructionMatchScore, setInstructionMatchScore] = useState<
    number | null
  >(null);

  const autoGenerationStartedRef = useRef(false);

  const allInstructions = useMemo(() => {
    const uniqueInstructions = new Map<string, InstructionGuide>();

    for (const instruction of savedInstructions) {
      uniqueInstructions.set(instruction.slug, instruction);
    }

    for (const instruction of instructions) {
      if (!uniqueInstructions.has(instruction.slug)) {
        uniqueInstructions.set(instruction.slug, instruction);
      }
    }

    return Array.from(uniqueInstructions.values());
  }, [savedInstructions]);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(allInstructions.map((instruction) => instruction.category))
    );

    return [allCategoryLabel, ...uniqueCategories];
  }, [allInstructions]);

  const filteredInstructions = useMemo(() => {
    const normalizedSearch = activeSearchTerm.trim().toLowerCase();

    return allInstructions.filter((instruction) => {
      const matchesCategory =
        selectedCategory === allCategoryLabel ||
        instruction.category === selectedCategory;

      const searchableText = [
        instruction.title,
        instruction.subtitle,
        instruction.category,
        instruction.vehicleApplicability,
        ...instruction.tags,
        ...instruction.symptoms,
        ...instruction.commonCauses,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        normalizedSearch.length === 0 ||
        searchableText.includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [activeSearchTerm, selectedCategory, allInstructions]);

  const canGenerateInstruction = searchTerm.trim().length >= 3;

  useEffect(() => {
    let ignoreResult = false;

    async function loadSavedInstructions() {
      setSavedInstructionsLoading(true);
      setSavedInstructionsError("");

      try {
        const { response, data } =
          await fetchJsonWithTimeout<SavedInstructionsResponse>(
            "/api/anleitungen/saved",
            {
              method: "GET",
              cache: "no-store",
            },
            12000
          );

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Gespeicherte Anleitungen konnten nicht geladen werden."
          );
        }

        if (!ignoreResult) {
          setSavedInstructions(Array.isArray(data.guides) ? data.guides : []);
        }
      } catch (error) {
        if (!ignoreResult) {
          setSavedInstructionsError(
            error instanceof Error
              ? error.message
              : "Gespeicherte Anleitungen konnten nicht geladen werden."
          );
        }
      } finally {
        if (!ignoreResult) {
          setSavedInstructionsLoading(false);
        }
      }
    }

    void loadSavedInstructions();

    return () => {
      ignoreResult = true;
    };
  }, []);

  useEffect(() => {
    if (!searchParams) {
      return;
    }

    const queryFromDiagnosis = searchParams.get("ki") ?? "";
    const shouldAutoGenerate = searchParams.get("auto") === "1";

    if (!queryFromDiagnosis) {
      return;
    }

    const initTimer = window.setTimeout(() => {
      setSearchTerm(queryFromDiagnosis);
      setActiveSearchTerm(queryFromDiagnosis);
      setSelectedCategory(allCategoryLabel);

      if (shouldAutoGenerate && !autoGenerationStartedRef.current) {
        autoGenerationStartedRef.current = true;
        void handleGenerateInstruction(queryFromDiagnosis, "diagnosis");
      }
    }, 0);

    return () => window.clearTimeout(initTimer);
  }, [searchParams]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setActiveSearchTerm(searchTerm.trim());
    resetGeneratedInstruction();
  }

  function addSavedInstructionToState(instruction: InstructionGuide) {
    setSavedInstructions((currentInstructions) => {
      const withoutDuplicate = currentInstructions.filter(
        (savedInstruction) => savedInstruction.slug !== instruction.slug
      );

      return [instruction, ...withoutDuplicate];
    });
  }

  async function handleGenerateInstruction(
    queryOverride?: string,
    source: "search" | "diagnosis" = "search"
  ) {
    const query = (queryOverride || searchTerm).trim();

    if (query.length < 3) {
      setGenerationError("Bitte mindestens 3 Zeichen eingeben.");
      return;
    }

    setGeneratingInstruction(true);
    setGenerationError("");
    setSaveWarning("");
    setGeneratedInstruction(null);
    setReusedExistingInstruction(false);
    setInstructionMatchScore(null);

    try {
      const response = await fetch("/api/anleitungen/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          source,
          diagnosisText: source === "diagnosis" ? query : "",
        }),
      });

      const responseText = await response.text();

      if (!responseText) {
        throw new Error(
          `Die API hat leer geantwortet. Status: ${response.status} ${response.statusText}`
        );
      }

      let data: GenerateInstructionResponse;

      try {
        data = JSON.parse(responseText) as GenerateInstructionResponse;
      } catch {
        throw new Error(
          `Die API hat keine gültige JSON-Antwort geliefert. Status: ${
            response.status
          }. Antwort: ${responseText.slice(0, 300)}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Die Anleitung konnte nicht geprüft oder erstellt werden."
        );
      }

      if (data.guide) {
        addSavedInstructionToState(data.guide);
        setGeneratedInstruction(data.guide);
        setActiveSearchTerm(query);
        setSaveWarning(data.saveWarning || "");
        setReusedExistingInstruction(Boolean(data.reusedExisting));
        setInstructionMatchScore(
          typeof data.matchScore === "number" ? data.matchScore : null
        );
        return;
      }

      if (data.jobId) {
        const pollResult = await pollGeneratedInstruction(data.jobId, query);

        if (!pollResult.guide) {
          throw new Error("Die API hat keine fertige Anleitung geliefert.");
        }

        addSavedInstructionToState(pollResult.guide);
        setGeneratedInstruction(pollResult.guide);
        setActiveSearchTerm(query);
        setSaveWarning(pollResult.saveWarning || "");
        setReusedExistingInstruction(Boolean(pollResult.reusedExisting));
        setInstructionMatchScore(
          typeof pollResult.matchScore === "number"
            ? pollResult.matchScore
            : null
        );
        return;
      }

      throw new Error(
        "Die API hat weder eine Anleitung noch eine Job-ID geliefert."
      );
    } catch (error) {
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler beim Prüfen oder Erstellen der Anleitung."
      );
    } finally {
      setGeneratingInstruction(false);
    }
  }

  function resetGeneratedInstruction() {
    setGeneratedInstruction(null);
    setGenerationError("");
    setSaveWarning("");
    setReusedExistingInstruction(false);
    setInstructionMatchScore(null);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50 p-8 shadow-sm transition-colors dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <p className="text-sm font-black uppercase tracking-wide text-slate-950 dark:text-slate-100">
            DiagnoseHUB Anleitungen
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-4xl">
            Reparatur- und Diagnoseabläufe
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-700 dark:text-slate-300">
            Suche nach gespeicherten Werkstatt-Anleitungen. Wenn noch keine
            passende Anleitung vorhanden ist, kann DiagnoseHUB direkt hier eine
            KI-Anleitung erstellen.
          </p>
        </div>

        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg transition-colors dark:border-slate-800 dark:bg-slate-900">
          <form
            onSubmit={handleSearchSubmit}
            className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end"
          >
            <div>
              <label
                htmlFor="instruction-search"
                className="mb-2 block text-sm font-bold text-slate-950 dark:text-slate-100"
              >
                Anleitung suchen oder neues Thema eingeben
              </label>

              <input
                id="instruction-search"
                type="search"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  resetGeneratedInstruction();
                }}
                placeholder="z. B. Golf VII GTI Oelservice..."
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none ring-blue-500 transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div>
              <label
                htmlFor="instruction-category"
                className="mb-2 block text-sm font-bold text-slate-950 dark:text-slate-100"
              >
                Kategorie
              </label>

              <select
                id="instruction-category"
                value={selectedCategory}
                onChange={(event) =>
                  setSelectedCategory(
                    event.target.value as
                      | InstructionCategory
                      | typeof allCategoryLabel
                  )
                }
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none ring-blue-500 transition focus:border-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 lg:w-56"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Suche starten
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {filteredInstructions.length} gespeicherte Anleitung
                {filteredInstructions.length === 1 ? "" : "en"} gefunden
              </p>

              {savedInstructionsLoading && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Gespeicherte Supabase-Anleitungen werden geladen...
                </p>
              )}

              {savedInstructionsError && (
                <p className="mt-1 text-xs font-semibold text-red-700 dark:text-red-300">
                  {savedInstructionsError}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={!canGenerateInstruction || generatingInstruction}
              onClick={() => void handleGenerateInstruction()}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none"
            >
              {generatingInstruction ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Anleitung wird gesucht / erstellt...
                </span>
              ) : (
                "Anleitung suchen / mit KI erstellen"
              )}
            </button>
          </div>

          {generatingInstruction && (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
              <div className="flex gap-3">
                <div className="mt-1 h-3 w-3 shrink-0 animate-pulse rounded-full bg-blue-600 dark:bg-blue-400" />

                <div>
                  <p className="font-black">
                    Anleitung wird gesucht oder erstellt
                  </p>

                  <p className="mt-1">
                    DiagnoseHUB prüft zuerst gespeicherte Supabase-Anleitungen.
                    Nur wenn keine passende Anleitung gefunden wird, startet die
                    KI-Erstellung.
                  </p>

                  <p className="mt-2 font-semibold">
                    Bitte nicht mehrfach starten oder die Seite neu laden.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!canGenerateInstruction && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Gib mindestens 3 Zeichen ein, um eine Anleitung zu suchen oder per
              KI zu erstellen.
            </p>
          )}

          {filteredInstructions.length === 0 && canGenerateInstruction && (
            <div className="mt-5 rounded-2xl border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700/60 dark:bg-yellow-950/40">
              <p className="text-sm font-black text-yellow-950 dark:text-yellow-100">
                Keine exakt passende gespeicherte Anleitung gefunden.
              </p>

              <p className="mt-2 text-sm leading-6 text-yellow-950 dark:text-yellow-100">
                Über den blauen Button sucht DiagnoseHUB zusätzlich nach
                ähnlichen gespeicherten Anleitungen. Falls nichts Passendes
                gefunden wird, wird automatisch eine neue KI-Anleitung erstellt
                und in Supabase gespeichert.
              </p>
            </div>
          )}

          {generationError && (
            <div className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-950 dark:border-red-700/70 dark:bg-red-950/40 dark:text-red-100">
              {generationError}
            </div>
          )}

          {saveWarning && (
            <div className="mt-5 rounded-2xl border border-yellow-300 bg-yellow-50 p-4 text-sm font-semibold text-yellow-950 dark:border-yellow-700/70 dark:bg-yellow-950/40 dark:text-yellow-100">
              {saveWarning}
            </div>
          )}
        </div>

        {generatedInstruction && (
          <GeneratedInstructionPanel
            instruction={generatedInstruction}
            reusedExisting={reusedExistingInstruction}
            matchScore={instructionMatchScore}
          />
        )}

        {filteredInstructions.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredInstructions.map((instruction) => (
              <InstructionCard
                key={instruction.id}
                instruction={instruction}
              />
            ))}
          </div>
        ) : !generatedInstruction ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-950 dark:text-slate-100">
              Keine gespeicherte Anleitung gefunden
            </h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Suche nach Bauteil, Symptom, Fahrzeugmodell oder Fehlerbereich —
              oder prüfe per blauem Button, ob eine ähnliche Anleitung existiert
              oder neu erstellt werden muss.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

type GeneratedInstructionPanelProps = {
  instruction: InstructionGuide;
  reusedExisting: boolean;
  matchScore: number | null;
};

function GeneratedInstructionPanel({
  instruction,
  reusedExisting,
  matchScore,
}: GeneratedInstructionPanelProps) {
  return (
    <article className="mb-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-700 dark:text-blue-400">
            {reusedExisting
              ? "Gespeicherte Anleitung gefunden"
              : "KI-generierte Anleitung"}
          </p>

          <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-slate-100">
            {instruction.title}
          </h2>

          <p className="mt-3 max-w-4xl leading-7 text-slate-700 dark:text-slate-300">
            {instruction.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 print:hidden"
        >
          Drucken
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          {instruction.category}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {instruction.difficulty}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {instruction.estimatedTime}
        </span>

        {reusedExisting && typeof matchScore === "number" && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800 dark:bg-green-950 dark:text-green-200">
            Treffer: {matchScore} %
          </span>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-green-300 bg-green-50 p-4 text-sm leading-6 text-green-950 dark:border-green-700/60 dark:bg-green-950/40 dark:text-green-100">
        {reusedExisting ? (
          <>
            <strong>Vorhandene Anleitung verwendet:</strong> DiagnoseHUB hat
            eine passende gespeicherte Anleitung gefunden. Es wurde keine neue
            KI-Anleitung erstellt.
          </>
        ) : (
          <>
            <strong>Gespeichert:</strong> Diese Anleitung wird automatisch in
            Supabase gesichert. Herstellerdaten, Sicherheitsvorgaben und
            fahrzeugspezifische Werte müssen zusätzlich geprüft werden.
          </>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GeneratedBox title="Symptome" items={instruction.symptoms} />
        <GeneratedBox title="Werkzeuge" items={instruction.tools} />
        <GeneratedBox title="Sicherheit" items={instruction.safetyNotes} />
        <GeneratedBox title="Erstprüfung" items={instruction.initialChecks} />
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-950">
        <h3 className="text-2xl font-black text-slate-950 dark:text-slate-100">
          Schritt-für-Schritt-Ablauf
        </h3>

        <div className="mt-5 grid gap-4">
          {instruction.steps.map((step, index) => (
            <div
              key={`${step.title}-${index}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
                  {index + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-lg font-black text-slate-950 dark:text-slate-100">
                    {step.title}
                  </h4>

                  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    {step.description}
                  </p>

                  {step.check && (
                    <div className="mt-4 rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-700/60 dark:bg-blue-950/40 dark:text-blue-100">
                      <strong className="font-black text-blue-900 dark:text-blue-200">
                        Prüfpunkt:
                      </strong>{" "}
                      {step.check}
                    </div>
                  )}

                  {step.warning && (
                    <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-950 dark:border-red-700/60 dark:bg-red-950/40 dark:text-red-100">
                      <strong className="font-black text-red-900 dark:text-red-200">
                        Achtung:
                      </strong>{" "}
                      {step.warning}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <GeneratedBox
          title="Häufige Ursachen"
          items={instruction.commonCauses}
        />

        <GeneratedBox
          title="Nächste Maßnahmen"
          items={instruction.nextActions}
        />
      </div>

      {instruction.proHint && (
        <section className="mt-6 rounded-3xl border border-blue-300 bg-blue-50 p-5 transition-colors dark:border-blue-700/60 dark:bg-blue-950/40">
          <p className="text-sm font-black uppercase tracking-wide text-blue-800 dark:text-blue-300">
            DiagnoseHUB Hinweis
          </p>

          <p className="mt-3 text-sm leading-7 text-blue-950 dark:text-blue-100">
            {instruction.proHint}
          </p>
        </section>
      )}
    </article>
  );
}

type GeneratedBoxProps = {
  title: string;
  items: string[];
};

function GeneratedBox({ title, items }: GeneratedBoxProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-xl font-black text-slate-950 dark:text-slate-100">
        {title}
      </h3>

      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item}
              className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300"
            >
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Keine Angaben vorhanden.
        </p>
      )}
    </section>
  );
}
