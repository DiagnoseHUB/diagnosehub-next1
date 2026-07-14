import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import InstructionStepVisual from "@/components/InstructionStepVisual";
import PrintButton from "../../../components/PrintButton";
import ProtocolPrintButton from "@/components/ProtocolPrintButton";
import TrainingMode from "@/components/TrainingMode";
import { getInstructionBySlug, instructions } from "../../../data/instructions";
import type { InstructionGuide } from "../../../types/instruction";
import { loadSavedInstructionGuideBySlug } from "@/lib/supabase/instructionGuideStorage";
import type { RawTrainingQuestion } from "@/lib/trainingShuffle";

type InstructionDetailPageProps = {
  params: Promise<{ slug: string }>;
};

type InstructionWithTraining = InstructionGuide & {
  trainingQuestions?: RawTrainingQuestion[];
  questions?: RawTrainingQuestion[];
  quizQuestions?: RawTrainingQuestion[];
};

export function generateStaticParams() {
  return instructions.map((instruction) => ({
    slug: instruction.slug,
  }));
}

async function getInstruction(slug: string): Promise<InstructionGuide | null> {
  const staticInstruction = getInstructionBySlug(slug);

  if (staticInstruction) {
    return staticInstruction;
  }

  try {
    const savedInstruction = await loadSavedInstructionGuideBySlug(slug);
    return savedInstruction;
  } catch (error) {
    console.error("Gespeicherte Anleitung konnte nicht geladen werden:", error);
    return null;
  }
}

function getTrainingQuestions(
  instruction: InstructionGuide
): RawTrainingQuestion[] {
  const instructionWithTraining = instruction as InstructionWithTraining;

  if (
    Array.isArray(instructionWithTraining.trainingQuestions) &&
    instructionWithTraining.trainingQuestions.length > 0
  ) {
    return instructionWithTraining.trainingQuestions;
  }

  if (
    Array.isArray(instructionWithTraining.questions) &&
    instructionWithTraining.questions.length > 0
  ) {
    return instructionWithTraining.questions;
  }

  if (
    Array.isArray(instructionWithTraining.quizQuestions) &&
    instructionWithTraining.quizQuestions.length > 0
  ) {
    return instructionWithTraining.quizQuestions;
  }

  return [];
}

export default async function InstructionDetailPage({
  params,
}: InstructionDetailPageProps) {
  const { slug } = await params;
  const instruction = await getInstruction(slug);

  if (!instruction) {
    notFound();
  }

  const trainingQuestions = getTrainingQuestions(instruction);
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
      title: "Fehlende Daten für mehr Genauigkeit",
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
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
            <Link
              href="/anleitungen"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              ← Zurück zu den Anleitungen
            </Link>

            <div className="flex flex-wrap gap-3">
              <ProtocolPrintButton instruction={instruction} />
              <PrintButton />
            </div>
          </div>

          <header className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                {instruction.category}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Schwierigkeit: {instruction.difficulty}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {instruction.estimatedTime}
              </span>

              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                Stand: {instruction.lastUpdated}
              </span>

              {instruction.requiredSkill && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  {instruction.requiredSkill}
                </span>
              )}
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
              {instruction.title}
            </h1>

            <p className="mt-4 text-lg leading-8 text-slate-700 dark:text-slate-300">
              {instruction.subtitle}
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <strong className="text-slate-950 dark:text-slate-100">
                Gültigkeit / Datenbasis:
              </strong>{" "}
              {instruction.vehicleApplicability}
            </div>
          </header>

          {overviewBoxes.length > 0 && (
            <section className="mt-6 grid gap-5 lg:grid-cols-2">
              {overviewBoxes.map((box) => (
                <InfoBox key={box.title} title={box.title} items={box.items} />
              ))}
            </section>
          )}

          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            <InfoBox title="Symptome" items={instruction.symptoms} />
            <InfoBox title="Benötigte Werkzeuge" items={instruction.tools} />
            <InfoBox title="Sicherheit" items={instruction.safetyNotes} />
            <InfoBox title="Erstprüfung" items={instruction.initialChecks} />
          </section>

          {qualityBoxes.length > 0 && (
            <section className="mt-6 grid gap-5 lg:grid-cols-3">
              {qualityBoxes.map((box) => (
                <InfoBox key={box.title} title={box.title} items={box.items} />
              ))}
            </section>
          )}

          <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl transition-colors dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-black text-slate-950 dark:text-slate-100">
              Schritt-für-Schritt-Ablauf
            </h2>

            <div className="mt-6 grid gap-4">
              {instruction.steps.map((step, index) => (
                <div
                  key={`${step.title}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
                    <InstructionStepVisual
                      step={step}
                      stepNumber={index + 1}
                    />

                    <div className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-black text-slate-950 dark:text-slate-100">
                        {step.title}
                      </h3>

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

                      <StepDetailNote
                        title="Messung"
                        value={step.measurement}
                        tone="green"
                      />
                      <StepDetailNote
                        title="Sollzustand"
                        value={step.expectedResult}
                        tone="blue"
                      />
                      <StepDetailNote
                        title="Entscheidung"
                        value={step.decision}
                        tone="slate"
                      />
                      <StepDetailNote
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

          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            <InfoBox
              title="Typische Fehler / mögliche Ursachen"
              items={instruction.commonCauses}
            />
            <InfoBox title="Nächste Maßnahmen" items={instruction.nextActions} />
          </section>

          {instruction.proHint && (
            <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                DiagnoseHUB Hinweis
              </p>

              <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
                {instruction.proHint}
              </p>
            </section>
          )}

          <section className="mt-6 print:hidden">
            <TrainingMode
              title={`Training: ${instruction.title}`}
              questions={trainingQuestions}
            />
          </section>

          <footer className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <strong>Hinweis:</strong> Diese Anleitung ersetzt keine
            Herstellerdaten. Drehmomente, Spezialwerkzeug, Sicherheitsvorgaben
            und fahrzeugspezifische Varianten müssen vor Arbeitsbeginn geprüft
            werden.
          </footer>
        </article>
      </main>

      <Footer />
    </div>
  );
}

type InfoBoxProps = {
  title: string;
  items: string[];
};

function parseInfoCauseItem(item: string) {
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

function getInfoCauseBadgeClass(priority: string) {
  const normalizedPriority = priority.toLowerCase();

  if (normalizedPriority.includes("hoch")) {
    return "border-red-300 bg-red-50 text-red-800 dark:border-red-800/70 dark:bg-red-950/20 dark:text-red-200";
  }

  if (normalizedPriority.includes("mittel")) {
    return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/20 dark:text-amber-200";
  }

  return "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
}

function parseInfoRequirementItem(item: string) {
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

function InfoBox({ title, items }: InfoBoxProps) {
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
    : "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900";
  const titleClass = "text-xl font-black text-slate-950 dark:text-slate-100";
  const itemClass = isCauseBox || isRequirementBox
    ? "flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300"
    : "flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300";
  const dotClass = isCauseBox || isRequirementBox
    ? "mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-500 dark:bg-slate-400"
    : "mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500";

  return (
    <section className={wrapperClass}>
      <h2 className={titleClass}>{title}</h2>

      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item, index) => {
            const causeItem = isCauseBox
              ? parseInfoCauseItem(item)
              : { priority: "", text: item };
            const requirementItem =
              !isCauseBox && isRequirementBox
                ? parseInfoRequirementItem(item)
                : { label: "", text: item };
            const itemText = isCauseBox ? causeItem.text : requirementItem.text;

            return (
              <li key={`${item}-${index}`} className={itemClass}>
                <span className={dotClass} />
                <span className="min-w-0 flex-1">
                  {causeItem.priority && (
                    <span
                      className={`mb-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${getInfoCauseBadgeClass(
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

type StepDetailNoteProps = {
  title: string;
  value?: string;
  tone: "blue" | "green" | "yellow" | "slate";
};

function StepDetailNote({ title, value, tone }: StepDetailNoteProps) {
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
