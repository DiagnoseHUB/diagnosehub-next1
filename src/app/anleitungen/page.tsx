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
import InstructionStepVisual from "@/components/InstructionStepVisual";
import InstructionCard from "../../components/InstructionCard";
import { instructions } from "../../data/instructions";
import type {
  InstructionCategory,
  InstructionGuide,
} from "../../types/instruction";
import { fetchJsonWithTimeout } from "@/utils/clientApi";
import { createClient } from "@/lib/supabase/client";

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
  query: string,
  accessToken: string
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
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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
    "Die KI-Anleitung dauert länger als 10 Minuten. Bitte die Anfrage etwas kürzer formulieren oder später erneut versuchen."
  );
}

function InstructionsPageContent() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/anleitungen/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
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
        const pollResult = await pollGeneratedInstruction(
          data.jobId,
          query,
          session.access_token
        );

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
                placeholder="z. B. Golf VII GTI Ölservice..."
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
                  Gespeicherte Anleitungen werden geladen...
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
                    DiagnoseHUB prüft zuerst gespeicherte Anleitungen.
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
                und gespeichert.
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
  const overviewBoxes = [
    {
      title: "Diagnoseziel",
      items: instruction.diagnosisGoal ? [instruction.diagnosisGoal] : [],
    },
    {
      title: "Benötigte Erfahrung",
      items: instruction.requiredSkill ? [instruction.requiredSkill] : [],
    },
    {
      title: "Fehlende Fahrzeugdaten",
      items: instruction.missingVehicleData ?? [],
    },
    {
      title: "Benötigte Ersatzteile / Material",
      items: instruction.partsAndMaterials ?? [],
    },
  ].filter((box) => box.items.length > 0);

  const qualityBoxes = [
    {
      title: "Messplan",
      items: instruction.measurementPlan ?? [],
    },
    {
      title: "Eskalation",
      items: instruction.escalationCriteria ?? [],
    },
    {
      title: "Endkontrolle",
      items: instruction.finalChecks ?? [],
    },
  ].filter((box) => box.items.length > 0);

  return (
    <article className="mb-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
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
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
          {instruction.category}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {instruction.difficulty}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {instruction.estimatedTime}
        </span>

        {reusedExisting && typeof matchScore === "number" && (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            Treffer: {matchScore} %
          </span>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
        {reusedExisting ? (
          <>
            <strong>Vorhandene Anleitung verwendet:</strong> DiagnoseHUB hat
            eine passende gespeicherte Anleitung gefunden. Es wurde keine neue
            KI-Anleitung erstellt.
          </>
        ) : (
          <>
            <strong>Gespeichert:</strong> Diese Anleitung wird automatisch in
            deinem Konto gesichert. Herstellerdaten, Sicherheitsvorgaben und
            fahrzeugspezifische Werte müssen zusätzlich geprüft werden.
          </>
        )}
      </div>

      {overviewBoxes.length > 0 && (
        <div className="mb-6 grid gap-5 lg:grid-cols-2">
          {overviewBoxes.map((box) => (
            <GeneratedBox key={box.title} title={box.title} items={box.items} />
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <GeneratedBox title="Symptome" items={instruction.symptoms} />
        <GeneratedBox title="Benötigte Werkzeuge" items={instruction.tools} />
        <GeneratedBox title="Sicherheit" items={instruction.safetyNotes} />
        <GeneratedBox title="Erstprüfung" items={instruction.initialChecks} />
      </div>

      {qualityBoxes.length > 0 && (
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          {qualityBoxes.map((box) => (
            <GeneratedBox key={box.title} title={box.title} items={box.items} />
          ))}
        </div>
      )}

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
              <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
                <InstructionStepVisual step={step} stepNumber={index + 1} />

                <div className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
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
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                      <strong className="font-black text-slate-950 dark:text-slate-100">
                        Prüfpunkt:
                      </strong>{" "}
                      {step.check}
                    </div>
                  )}

                  <GeneratedStepNote
                    title="Messung"
                    value={step.measurement}
                    tone="green"
                  />
                  <GeneratedStepNote
                    title="Sollzustand"
                    value={step.expectedResult}
                    tone="blue"
                  />
                  <GeneratedStepNote
                    title="Entscheidung"
                    value={step.decision}
                    tone="slate"
                  />
                  <GeneratedStepNote
                    title="Qualitätskontrolle"
                    value={step.qualityCheck}
                    tone="yellow"
                  />

                  {step.warning && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm leading-6 text-slate-800 dark:border-red-900/70 dark:bg-red-950/15 dark:text-slate-200">
                      <strong className="font-black text-red-800 dark:text-red-200">
                        Achtung:
                      </strong>{" "}
                      {step.warning}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <GeneratedBox
          title="Typische Fehler / mögliche Ursachen"
          items={instruction.commonCauses}
        />

        <GeneratedBox
          title="Nächste Maßnahmen"
          items={instruction.nextActions}
        />
      </div>

      {instruction.proHint && (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 transition-colors dark:border-slate-800 dark:bg-slate-950">
          <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            DiagnoseHUB Hinweis
          </p>

          <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
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

function parseGeneratedCauseItem(item: string) {
  const match = item.match(/^\[(hoch|mittel|niedrig|später|spaeter)\]\s*(.+)$/i);

  if (!match) {
    return {
      priority: "",
      text: item,
    };
  }

  return {
    priority: match[1].toLowerCase() === "spaeter" ? "später" : match[1],
    text: match[2],
  };
}

function getGeneratedCauseBadgeClass(priority: string) {
  const normalizedPriority = priority.toLowerCase();

  if (normalizedPriority.includes("hoch")) {
    return "border-red-300 bg-red-50 text-red-800 dark:border-red-800/70 dark:bg-red-950/20 dark:text-red-200";
  }

  if (normalizedPriority.includes("mittel")) {
    return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/20 dark:text-amber-200";
  }

  return "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
}

function parseGeneratedRequirementItem(item: string) {
  const match = item.match(
    /^(Pflicht|Diagnose|Messung|Spezial|Optional|Arbeitsplatz|Bereitlegen|Nur bei Befund|Einmalteil|Dichtung|Betriebsstoff|Nach Herstellerdaten):\s*(.+)$/i,
  );

  if (!match) {
    return {
      label: "",
      text: item,
    };
  }

  return {
    label: match[1],
    text: match[2],
  };
}

function GeneratedBox({ title, items }: GeneratedBoxProps) {
  const normalizedTitle = title.toLowerCase();
  const isCauseBox =
    normalizedTitle.includes("typische fehler") ||
    normalizedTitle.includes("ursachen");
  const isRequirementBox =
    normalizedTitle.includes("werkzeug") ||
    normalizedTitle.includes("ersatzteile") ||
    normalizedTitle.includes("material");
  const wrapperClass = isRequirementBox
    ? "rounded-3xl border border-slate-300 bg-slate-50 p-5 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-950"
    : "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-950";
  const titleClass = "text-xl font-black text-slate-950 dark:text-slate-100";
  const itemClass = isCauseBox || isRequirementBox
    ? "flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300"
    : "flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300";
  const dotClass = isCauseBox || isRequirementBox
    ? "mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-500 dark:bg-slate-400"
    : "mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500";

  return (
    <section className={wrapperClass}>
      <h3 className={titleClass}>{title}</h3>

      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item, index) => {
            const causeItem = isCauseBox
              ? parseGeneratedCauseItem(item)
              : { priority: "", text: item };
            const requirementItem =
              !isCauseBox && isRequirementBox
                ? parseGeneratedRequirementItem(item)
                : { label: "", text: item };
            const itemText = isCauseBox ? causeItem.text : requirementItem.text;

            return (
              <li key={`${item}-${index}`} className={itemClass}>
                <span className={dotClass} />
                <span className="min-w-0 flex-1">
                  {causeItem.priority && (
                    <span
                      className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${getGeneratedCauseBadgeClass(
                        causeItem.priority,
                      )}`}
                    >
                      {causeItem.priority}
                    </span>
                  )}
                  {requirementItem.label && (
                    <span className="mb-2 inline-flex rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-black uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                      {requirementItem.label}
                    </span>
                  )}
                  <span className="block">{itemText}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Keine Angaben vorhanden.
        </p>
      )}
    </section>
  );
}

type GeneratedStepNoteProps = {
  title: string;
  value?: string;
  tone: "blue" | "green" | "yellow" | "slate";
};

function GeneratedStepNote({ title, value, tone }: GeneratedStepNoteProps) {
  if (!value) {
    return null;
  }

  const toneClass =
    tone === "yellow"
      ? "border-amber-200 bg-amber-50/70 text-slate-800 dark:border-amber-900/70 dark:bg-amber-950/15 dark:text-slate-200"
      : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200";

  return (
    <div className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${toneClass}`}>
      <strong className="font-black">{title}:</strong> {value}
    </div>
  );
}
