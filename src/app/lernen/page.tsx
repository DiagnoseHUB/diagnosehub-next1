import Link from "next/link";
import Header from "@/components/Header";
import LearningLevelOverview from "@/components/LearningLevelOverview";
import { loadPublishedLearningModules } from "@/lib/supabase/learningStorage";

export const metadata = {
  title: "Lernen | DiagnoseHUB",
  description:
    "Lerne Kfz-Diagnose, Elektrik, Diesel, Klima, Bremse, Fahrwerk und Werkstattpraxis mit DiagnoseHUB.",
};

export default async function LernenPage() {
  const modules = await loadPublishedLearningModules();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
        <section className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            DiagnoseHUB Lernen
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-100 sm:text-4xl">
            Lernen & Kfz-Wissen
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            Trainiere Diagnosewissen, prüfe dein Verständnis im Quiz oder
            lass dir einzelne Bauteile und Systeme praxisnah erklären.
          </p>
        </section>

        <section className="mb-10 grid gap-4 md:grid-cols-3">
          <Link
            href="/lernen/quiz"
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-blue-500"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              ?
            </div>

            <h2 className="text-xl font-bold text-slate-950 dark:text-slate-100">Quiz starten</h2>

            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Trainiere mit Prüfungsfragen und Werkstattfällen. Ideal für
              Azubis, Gesellen und zur Wiederholung von Diagnosegrundlagen.
            </p>

            <p className="mt-4 text-sm font-semibold text-blue-700 group-hover:text-blue-800 dark:text-blue-300 dark:group-hover:text-blue-200">
              Zum Quiz
            </p>
          </Link>

          <Link
            href="/lernen/wissen"
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-blue-500"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              i
            </div>

            <h2 className="text-xl font-bold text-slate-950 dark:text-slate-100">Bauteilwissen</h2>

            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Lass dir Sensoren, Aktoren, Bauteile und Fahrzeugsysteme
              erklären, inklusive Aufgabe, Symptomen und sinnvoller
              Prüfstrategie.
            </p>

            <p className="mt-4 text-sm font-semibold text-blue-700 group-hover:text-blue-800 dark:text-blue-300 dark:group-hover:text-blue-200">
              Bauteil erklären lassen
            </p>
          </Link>

          <Link
            href="/lernen/gesellenprüfung"
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-blue-500"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-xl font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              GP
            </div>

            <h2 className="text-xl font-bold text-slate-950 dark:text-slate-100">
              Gesellenprüfung
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Uebe Teil 1 und Teil 2 mit realistischen Kfz-Fällen,
              Auswertung, Musterloesung und gespeicherten Ergebnissen.
            </p>

            <p className="mt-4 text-sm font-semibold text-blue-700 group-hover:text-blue-800 dark:text-blue-300 dark:group-hover:text-blue-200">
              Prüfung trainieren
            </p>
          </Link>
        </section>

        <section>
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-slate-950 dark:text-slate-100">Lernmodule</h2>

            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Wähle eine Stufe oder ein Modul aus und speichere deinen
              Lernfortschritt pro Lektion.
            </p>
          </div>

          <LearningLevelOverview modules={modules} />
        </section>
        </div>
      </main>
    </div>
  );
}
