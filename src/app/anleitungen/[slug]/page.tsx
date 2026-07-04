import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import PrintButton from "../../../components/PrintButton";
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

            <PrintButton />
          </div>

          <header className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl transition-colors dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                {instruction.category}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Schwierigkeit: {instruction.difficulty}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {instruction.estimatedTime}
              </span>

              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800 dark:bg-green-950 dark:text-green-200">
                Stand: {instruction.lastUpdated}
              </span>
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
              {instruction.title}
            </h1>

            <p className="mt-4 text-lg leading-8 text-slate-700 dark:text-slate-300">
              {instruction.subtitle}
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <strong className="text-slate-950 dark:text-slate-100">
                Gültigkeit:
              </strong>{" "}
              {instruction.vehicleApplicability}
            </div>
          </header>

          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            <InfoBox title="Symptome" items={instruction.symptoms} />
            <InfoBox title="Benötigtes Werkzeug" items={instruction.tools} />
            <InfoBox title="Sicherheit" items={instruction.safetyNotes} />
            <InfoBox title="Erstprüfung" items={instruction.initialChecks} />
          </section>

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
                  <div className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
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

          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            <InfoBox title="Häufige Ursachen" items={instruction.commonCauses} />
            <InfoBox title="Nächste Maßnahmen" items={instruction.nextActions} />
          </section>

          {instruction.proHint && (
            <section className="mt-6 rounded-[2rem] border border-blue-300 bg-blue-50 p-6 shadow-sm transition-colors dark:border-blue-700/60 dark:bg-blue-950/40">
              <p className="text-sm font-black uppercase tracking-wide text-blue-800 dark:text-blue-300">
                DiagnoseHUB Hinweis
              </p>

              <p className="mt-3 text-sm leading-7 text-blue-950 dark:text-blue-100">
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

          <footer className="mt-8 rounded-2xl border border-yellow-300 bg-yellow-50 p-5 text-sm leading-6 text-yellow-950 dark:border-yellow-700/60 dark:bg-yellow-950/40 dark:text-yellow-100">
            <strong>Hinweis:</strong> Diese Anleitung ersetzt keine
            Herstellerdaten. Drehmomente, Spezialwerkzeug, Sicherheitsvorgaben
            und fahrzeugspezifische Varianten müssen vor Arbeitsbeginn geprüft
            werden.
          </footer>
        </article>
      </main>
    </div>
  );
}

type InfoBoxProps = {
  title: string;
  items: string[];
};

function InfoBox({ title, items }: InfoBoxProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-black text-slate-950 dark:text-slate-100">
        {title}
      </h2>

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