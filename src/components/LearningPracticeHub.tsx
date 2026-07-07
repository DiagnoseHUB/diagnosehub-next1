"use client";

import Link from "next/link";

const PENDING_PREFILL_STORAGE_KEY = "diagnosehub-pending-prefill";

const diagnosisCases = [
  {
    title: "Diesel mit Leistungsverlust",
    code: "P0299",
    symptom: "Notlauf bei Autobahnauffahrt, Ladedruck-Istwert bleibt deutlich unter Soll.",
    focus: "Dichtheit, Ladedruckregelung, Luftmasse und DPF-Gegendruck trennen.",
    checks: [
      "Freeze-Frame und Lastzustand sichern",
      "Ladeluftstrecke mit Druck oder Rauch prüfen",
      "Soll-/Ist-Ladedruck und Luftmasse unter Last vergleichen",
    ],
  },
  {
    title: "Benziner ruckelt im Leerlauf",
    code: "P0171",
    symptom: "Leerlauf schwankt, Fuel Trim positiv, nach Kaltstart stärker.",
    focus: "Falschluft, Kraftstoffdruck, KGE und Lambdasignal plausibilisieren.",
    checks: [
      "Short- und Long-Term-Fuel-Trim bewerten",
      "Ansaugsystem abnebeln",
      "Kraftstoffdruck und LMM-Wert plausibilisieren",
    ],
  },
  {
    title: "ABS-Fehler an einer Radecke",
    code: "C0035",
    symptom: "ABS/ESP-Lampe an, Raddrehzahl vorne links fällt sporadisch aus.",
    focus: "Sensor, Leitung, Magnetring und Radlager nicht verwechseln.",
    checks: [
      "Istwerte aller Raddrehzahlen vergleichen",
      "Stecker, Leitung und Sensorabstand sichtprüfen",
      "Magnetring/Radlager auf Beschädigung prüfen",
    ],
  },
];

const examQuestions = [
  {
    question: "Warum ist ein Fehlercode kein Bauteilname?",
    answer:
      "Der Code beschreibt eine erkannte Abweichung. Ursache kann Sensorik, Leitung, Mechanik, Undichtigkeit oder Betriebszustand sein.",
  },
  {
    question: "Wie begründest du eine Prüfreihenfolge im Fachgespräch?",
    answer:
      "Erst Sichtprüfung und einfache Ausschlüsse, dann Versorgung/Signal/Messwerte, danach Funktionsprüfung und erst am Ende Teiletausch.",
  },
  {
    question: "Was gehört zu einer belastbaren Abschlussprüfung?",
    answer:
      "Fehler löschen, passenden Betriebszustand herstellen, Istwerte vergleichen, Probefahrt oder Funktionstest machen und erneut auslesen.",
  },
];

const componentKnowledgeTopics = [
  {
    title: "NTC erklären",
    question: "Warum sinkt der Widerstand bei Wärme?",
    href: "/lernen/ntc-temperatursensor-verstehen",
    points: ["Temperaturkennlinie", "Spannungsteiler", "Unterbrechung/Kurzschluss"],
  },
  {
    title: "Wechslerrelais",
    question: "Welche Klemmen hat es?",
    href: "/lernen/wechslerrelais-klemmen-und-funktion",
    points: ["85/86 Spule", "30 gemeinsamer Kontakt", "87 und 87a"],
  },
  {
    title: "Drehstromgenerator",
    question: "Wie entsteht Bordnetz-Ladung?",
    href: "/lernen/drehstromgenerator-ladesystem-konkret",
    points: ["Rotor und Stator", "Dioden", "Regler und B+"],
  },
];

function buildDiagnosisCaseText(caseItem: (typeof diagnosisCases)[number]) {
  return [
    `${caseItem.title} - ${caseItem.code}`,
    `Symptom: ${caseItem.symptom}`,
    `Lernfokus: ${caseItem.focus}`,
    "Vorbereitete Prüfpunkte:",
    ...caseItem.checks.map((check) => `- ${check}`),
    "Bitte daraus einen Diagnosepfad mit Messwerten, Entscheidung und nächsten Schritten erstellen.",
  ].join("\n");
}

export default function LearningPracticeHub() {
  function openDiagnosisCase(caseItem: (typeof diagnosisCases)[number]) {
    try {
      window.sessionStorage.setItem(
        PENDING_PREFILL_STORAGE_KEY,
        buildDiagnosisCaseText(caseItem),
      );
    } catch {
      // Die Navigation funktioniert trotzdem, nur ohne vorausgefüllten Text.
    }

    window.location.assign("/#diagnose");
  }

  return (
    <section className="mt-8 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Diagnosefälle
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">
              Falltraining für Azubis
            </h2>
          </div>

          <Link
            href="/lernen/gesellenpruefung"
            className="rounded-xl border border-blue-500/40 px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-600 hover:text-white dark:text-blue-300"
          >
            Prüfung üben
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {diagnosisCases.map((caseItem) => (
            <article
              key={caseItem.title}
              className="flex min-h-72 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70"
            >
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">
                  {caseItem.code}
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  Fall
                </span>
              </div>

              <h3 className="mt-4 text-lg font-black text-slate-950 dark:text-slate-100">
                {caseItem.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {caseItem.symptom}
              </p>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                {caseItem.focus}
              </p>

              <button
                type="button"
                onClick={() => openDiagnosisCase(caseItem)}
                className="mt-auto rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500"
              >
                Fall in Diagnose öffnen
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Prüfungsfragen
        </p>
        <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">
          Typische Antworten trainieren
        </h2>

        <div className="mt-5 grid gap-3">
          {examQuestions.map((item, index) => (
            <div
              key={item.question}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70"
            >
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Frage {index + 1}
              </p>
              <h3 className="mt-2 font-black text-slate-950 dark:text-slate-100">
                {item.question}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {item.answer}
              </p>
            </div>
          ))}
        </div>

        <Link
          href="/lernen/quiz"
          className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
        >
          Quiz starten
        </Link>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 xl:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Bauteilwissen
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">
              Kurz erklärt, direkt prüfbar
            </h2>
          </div>

          <Link
            href="/lernen/bauteile-verstehen-sensoren-relais-generator"
            className="rounded-xl border border-blue-500/40 px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-600 hover:text-white dark:text-blue-300"
          >
            Modul öffnen
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {componentKnowledgeTopics.map((topic) => (
            <Link
              key={topic.href}
              href={topic.href}
              className="flex min-h-56 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-blue-500/60 dark:hover:bg-blue-950/30"
            >
              <span className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                {topic.question}
              </span>
              <h3 className="mt-3 text-lg font-black text-slate-950 dark:text-slate-100">
                {topic.title}
              </h3>

              <ul className="mt-4 space-y-2">
                {topic.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-2 text-sm leading-5 text-slate-600 dark:text-slate-300"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <span className="mt-auto pt-4 text-sm font-black text-blue-700 dark:text-blue-300">
                Lektion öffnen
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
