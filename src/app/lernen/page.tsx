import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import LearningLevelOverview from "@/components/LearningLevelOverview";
import LearningPracticeHub from "@/components/LearningPracticeHub";
import PlanAccessGate from "@/components/PlanAccessGate";
import { loadPublishedLearningModules } from "@/lib/supabase/learningStorage";

export const metadata = {
  title: "Lernen | DiagnoseHUB",
  description:
    "Lerne Kfz-Diagnose, Elektrik, Diesel, Klima, Bremse, Fahrwerk und Werkstattpraxis mit DiagnoseHUB.",
};

const quickStartCards = [
  {
    label: "Quiz",
    title: "Prüfungsfragen trainieren",
    description:
      "Kurze Fragen für Wiederholung, Grundlagen und Prüfungsvorbereitung.",
    href: "/lernen/quiz",
    cta: "Zum Quiz",
  },
  {
    label: "Wissen",
    title: "Bauteil erklären lassen",
    description:
      "Sensoren, Aktoren und Systeme mit Aufgabe, Symptomen und Prüfstrategie verstehen.",
    href: "/lernen/wissen",
    cta: "Bauteilwissen öffnen",
  },
  {
    label: "GP",
    title: "Gesellenprüfung üben",
    description:
      "Teil 1 und Teil 2 mit realistischen Kfz-Fällen, Bewertung und Musterlösung.",
    href: "/lernen/gesellenpruefung",
    cta: "Prüfung trainieren",
  },
];

const learningPrinciples = [
  "Erst Grundlagen, dann Systemdiagnose, dann komplexe Fälle.",
  "Jede Lektion soll am Ende einen konkreten Prüfpunkt liefern.",
  "Fortschritt und Erfolge bleiben für deine Wiederholung sichtbar.",
];

export default async function LernenPage() {
  const modules = await loadPublishedLearningModules();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <section className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                DiagnoseHUB Lernen
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
                Lernen mit klarer Reihenfolge.
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Der Lernbereich ist als Diagnosepfad aufgebaut: Grundlagen
                verstehen, Systeme prüfen, Fälle bearbeiten und
                Prüfungssituationen trainieren.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#lernmodule"
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                >
                  Lernpfad ansehen
                </a>

                <Link
                  href="/lernen/gesellenpruefung"
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Prüfung üben
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Lernlogik
              </p>

              <div className="mt-4 grid gap-3">
                {learningPrinciples.map((principle, index) => (
                  <div
                    key={principle}
                    className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white dark:bg-slate-100 dark:text-slate-950">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                      {principle}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <PlanAccessGate feature="learning">
            <section className="mt-8">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    Schnellstart
                  </p>
                  <h2 className="text-2xl font-black text-slate-950 dark:text-slate-100">
                    Direkt in den passenden Lernmodus
                  </h2>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {quickStartCards.map((card) => (
                  <Link
                    key={card.href}
                    href={card.href}
                    className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-base font-black text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-500/10 dark:text-blue-300">
                      {card.label}
                    </div>

                    <h3 className="text-xl font-black text-slate-950 dark:text-slate-100">
                      {card.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {card.description}
                    </p>

                    <p className="mt-5 text-sm font-black text-blue-700 group-hover:text-blue-800 dark:text-blue-300">
                      {card.cta}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            <LearningPracticeHub />

            <section id="lernmodule" className="mt-10">
              <div className="mb-5">
                <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  Lernmodule
                </p>
                <h2 className="text-3xl font-black text-slate-950 dark:text-slate-100">
                  Lernpfad, Themen und Fortschritt
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Module sind nach Stufe und Thema sortiert. So findest du
                  schneller den passenden Einstieg und siehst, was als nächstes
                  sinnvoll ist.
                </p>
              </div>

              <LearningLevelOverview modules={modules} />
            </section>
          </PlanAccessGate>
        </div>
      </main>

      <Footer />
    </div>
  );
}
