"use client";

import Link from "next/link";

const PENDING_PREFILL_STORAGE_KEY = "diagnosehub-pending-prefill";

type DiagnosisCase = {
  title: string;
  code: string;
  system: string;
  risk: string;
  symptom: string;
  learningGoal: string;
  focus: string;
  checks: string[];
  decisions: string[];
};

const diagnosisCases: DiagnosisCase[] = [
  {
    title: "Diesel mit Leistungsverlust",
    code: "P0299",
    system: "Ladedruck",
    risk: "Weiterfahrt eingeschränkt",
    symptom:
      "Notlauf bei Autobahnauffahrt, Ladedruck-Istwert bleibt deutlich unter Soll.",
    learningGoal:
      "Luftpfad, Ladedruckregelung, Unterdruck/Ansteuerung und DPF-Gegendruck trennen.",
    focus: "Dichtheit, Regelung, Luftmasse und Abgasgegendruck nicht vermischen.",
    checks: [
      "Freeze-Frame und Lastzustand sichern",
      "Ladeluftstrecke mit Druck oder Rauch prüfen",
      "Soll-/Ist-Ladedruck, Luftmasse und Ansteuerung unter Last vergleichen",
      "DPF-Differenzdruck und AGR-Stellung plausibilisieren",
    ],
    decisions: [
      "Ist der Ladedruck nur unter Last zu niedrig?",
      "Passt die Luftmasse zum fehlenden Ladedruck?",
      "Reagiert die Verstellung auf Ansteuerung?",
    ],
  },
  {
    title: "Benziner ruckelt im Leerlauf",
    code: "P0171",
    system: "Gemischbildung",
    risk: "Katalysator und Motorlauf beachten",
    symptom: "Leerlauf schwankt, Fuel Trim positiv, nach Kaltstart stärker.",
    learningGoal:
      "Magerlauf durch Falschluft, Kraftstoffdruck, KGE, LMM oder Lambdaregelung unterscheiden.",
    focus: "Ein positiver Fuel Trim ist ein Hinweis, aber noch keine Ursache.",
    checks: [
      "Short- und Long-Term-Fuel-Trim in Leerlauf und Teillast vergleichen",
      "Ansaugsystem und KGE abnebeln",
      "Kraftstoffdruck und Fördermenge prüfen",
      "Lambdasignal auf Reaktion und Plausibilität bewerten",
    ],
    decisions: [
      "Wird der Trim bei höherer Drehzahl besser?",
      "Ändert Bremsenreiniger oder Rauchprüfung den Lauf?",
      "Ist die Sonde träge oder meldet sie nur korrekt mager?",
    ],
  },
  {
    title: "ABS-Fehler an einer Radecke",
    code: "C0035",
    system: "ABS/ESP",
    risk: "Bremsen und Fahrstabilität",
    symptom:
      "ABS/ESP-Lampe an, Raddrehzahl vorne links fällt sporadisch aus.",
    learningGoal:
      "Sensor, Leitung, Magnetring, Radlager und Steuergerät logisch voneinander trennen.",
    focus: "Bei ABS nie nur den Sensor tauschen, ohne Ring und Leitung zu prüfen.",
    checks: [
      "Istwerte aller Raddrehzahlen bei langsamer Fahrt vergleichen",
      "Stecker, Leitung und Sensorabstand sichtprüfen",
      "Magnetring/Radlager auf Beschädigung, Rost und falsche Montage prüfen",
      "Signalverlauf mit geeignetem Messgerät unter Bewegung prüfen",
    ],
    decisions: [
      "Fällt nur ein Rad aus oder sind mehrere Werte unplausibel?",
      "Ist der Fehler drehzahlabhängig oder erschütterungsabhängig?",
      "Passt der Fehler zu mechanischem Spiel am Radlager?",
    ],
  },
  {
    title: "Bordnetzspannung zu niedrig",
    code: "P0562",
    system: "Ladesystem",
    risk: "Fahrzeug kann liegen bleiben",
    symptom:
      "Batteriewarnung, Start-Stopp deaktiviert, Spannung bricht bei Verbrauchern ein.",
    learningGoal:
      "Batterie, Generator, Riemenantrieb, Massepfad und Energiemanagement unterscheiden.",
    focus:
      "Eine niedrige Spannung kann Folge eines hohen Spannungsfalls sein, nicht nur Generatorfehler.",
    checks: [
      "Batteriezustand und Ruhespannung bewerten",
      "Ladespannung im Leerlauf und mit Verbrauchern messen",
      "Spannungsfall Plus- und Massepfad unter Last prüfen",
      "Riemen, Freilauf, B+ Leitung und Generatoransteuerung prüfen",
    ],
    decisions: [
      "Bricht die Spannung nur unter Last ein?",
      "Liegt der Spannungsfall auf Plus oder Masse?",
      "Wird der Generator korrekt angesteuert?",
    ],
  },
  {
    title: "Klimaanlage kühlt sporadisch",
    code: "P0532",
    system: "Klima",
    risk: "Druck, Kältemittel und Lüfter beachten",
    symptom:
      "Kühlleistung fällt im Stand aus, Drucksensorwert zeitweise unplausibel.",
    learningGoal:
      "Kältemittelmenge, Drucksensor, Lüftersteuerung, Kompressorregelung und Vereisung trennen.",
    focus:
      "Klimadiagnose braucht Druck, Temperatur und Ansteuerung zusammen, nicht nur gefühlte Lufttemperatur.",
    checks: [
      "Hoch- und Niederdruck nach Herstellervorgabe bewerten",
      "Drucksensorversorgung, Masse und Signal prüfen",
      "Kondensatorlüfter und Luftführung prüfen",
      "Kompressoransteuerung und Regelventil plausibilisieren",
    ],
    decisions: [
      "Ist der Druckwert elektrisch unplausibel oder physikalisch erklärbar?",
      "Ändert sich der Fehler mit Lüfterlauf und Außentemperatur?",
      "Passt die Ausblastemperatur zu den Drücken?",
    ],
  },
  {
    title: "Kommunikationsfehler nach Batteriewechsel",
    code: "U0100",
    system: "CAN-Bus",
    risk: "Startfähigkeit und Steuergerätekommunikation",
    symptom:
      "Mehrere Warnlampen, Motorsteuergerät zeitweise nicht erreichbar, Fehler nach Unterspannung.",
    learningGoal:
      "Versorgung, Masse, Busruhe, Abschlusswiderstand und Folgefehler unterscheiden.",
    focus:
      "U-Codes sind oft Folgefehler. Erst Versorgung und Busgrundlage prüfen, dann einzelne Steuergeräte verdächtigen.",
    checks: [
      "Batterie, Sicherungen und Massepunkte prüfen",
      "Kommunikationsübersicht und betroffene Steuergeräte vergleichen",
      "CAN-H/CAN-L Ruhespannung und Abschlusswiderstand prüfen",
      "Fehler löschen, Schlaf-/Wachzustand herstellen und erneut auslesen",
    ],
    decisions: [
      "Ist ein Steuergerät wirklich offline oder nur Folge eines Spannungsabfalls?",
      "Sind beide Busleitungen plausibel?",
      "Tritt der Fehler nach Wake-up oder erst während der Fahrt auf?",
    ],
  },
];

const examQuestions = [
  {
    area: "Diagnose",
    question: "Warum ist ein Fehlercode kein Bauteilname?",
    answer:
      "Der Code beschreibt eine erkannte Abweichung. Ursache kann Sensorik, Leitung, Mechanik, Undichtigkeit, Versorgung oder Betriebszustand sein.",
  },
  {
    area: "Prüfstrategie",
    question: "Wie begründest du eine Prüfreihenfolge im Fachgespräch?",
    answer:
      "Erst Sichtprüfung und einfache Ausschlüsse, dann Versorgung/Masse, Signal und Messwerte, danach Funktionsprüfung und erst am Ende Teiletausch.",
  },
  {
    area: "Messwerte",
    question: "Warum müssen Sollwerte und Betriebszustand zusammen genannt werden?",
    answer:
      "Ein Messwert ist nur aussagekräftig, wenn Temperatur, Last, Drehzahl, Spannung und Herstellervorgabe zum Prüfzustand passen.",
  },
  {
    area: "Elektrik",
    question: "Warum misst man Spannungsfall unter Last?",
    answer:
      "Übergangswiderstände zeigen sich oft erst, wenn Strom fließt. Ohne Last kann eine Leitung scheinbar in Ordnung wirken.",
  },
  {
    area: "Sicherheit",
    question: "Was ist bei Bremsen, Airbag und Hochvolt immer anders?",
    answer:
      "Diese Systeme sind sicherheitsrelevant. Qualifikation, Herstellervorgaben, geeignete Ausrüstung und dokumentierte Abschlussprüfung sind Pflicht.",
  },
  {
    area: "Abschluss",
    question: "Was gehört zu einer belastbaren Abschlussprüfung?",
    answer:
      "Fehler löschen, passenden Betriebszustand herstellen, Istwerte vergleichen, Probefahrt oder Funktionstest durchführen und erneut auslesen.",
  },
];

const componentKnowledgeTopics = [
  {
    title: "NTC-Temperatursensor",
    question: "Warum sinkt der Widerstand bei Wärme?",
    href: "/lernen/ntc-temperatursensor-verstehen",
    points: ["Kennlinie", "Spannungsteiler", "Plausibilität im Steuergerät"],
  },
  {
    title: "Wechslerrelais",
    question: "Welche Klemmen hat es?",
    href: "/lernen/wechslerrelais-klemmen-und-funktion",
    points: ["85/86 Spule", "30 Eingang", "87 Schließer", "87a Öffner"],
  },
  {
    title: "Drehstromgenerator",
    question: "Wie entsteht Bordnetz-Ladung?",
    href: "/lernen/drehstromgenerator-ladesystem-konkret",
    points: ["Rotor/Stator", "Dioden", "Regler", "B+ und Masse"],
  },
  {
    title: "Lambdasonde",
    question: "Was regelt das Gemisch?",
    href: "/lernen/ottomotor-gemisch-zuendaussetzer-lambda",
    points: ["Sondensignal", "Fuel Trim", "Falschluft und Abgasleck"],
  },
  {
    title: "Raddrehzahlsensor",
    question: "Warum zählt der Magnetring mit?",
    href: "/lernen/bremse-fahrwerk-abs-esp-diagnose",
    points: ["Signalbild", "Sensorabstand", "Radlager und Ring"],
  },
  {
    title: "Drucksensor Klima",
    question: "Wie passt Druck zu Temperatur?",
    href: "/lernen/klima-kuehlung-thermomanagement-pruefen",
    points: ["Versorgung", "Signal", "Lüfter", "Kompressorfreigabe"],
  },
];

function buildDiagnosisCaseText(caseItem: DiagnosisCase) {
  return [
    `${caseItem.title} - ${caseItem.code}`,
    `System: ${caseItem.system}`,
    `Risiko: ${caseItem.risk}`,
    `Symptom: ${caseItem.symptom}`,
    `Lernziel: ${caseItem.learningGoal}`,
    `Fokus: ${caseItem.focus}`,
    "Vorbereitete Prüfpunkte:",
    ...caseItem.checks.map((check) => `- ${check}`),
    "Entscheidungsfragen:",
    ...caseItem.decisions.map((decision) => `- ${decision}`),
    "Bitte daraus einen Diagnosepfad mit möglichen Ursachen, Messwerten, Entscheidung und nächsten Schritten erstellen.",
  ].join("\n");
}

export default function LearningPracticeHub() {
  function openDiagnosisCase(caseItem: DiagnosisCase) {
    try {
      window.sessionStorage.setItem(
        PENDING_PREFILL_STORAGE_KEY,
        buildDiagnosisCaseText(caseItem),
      );
    } catch {
      // Die Navigation funktioniert trotzdem, nur ohne vorausgefüllten Text.
    }

    window.location.assign("/diagnose");
  }

  return (
    <section id="falltraining" className="mt-8 space-y-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Praxisübungen
          </p>
          <h2 className="text-3xl font-black text-slate-950 dark:text-slate-100">
            Diagnosefälle, Fachfragen und Bauteilwissen
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Jeder Fall trainiert eine saubere Entscheidung: Ursache eingrenzen,
            Messwerte prüfen, Risiken erkennen und erst danach reparieren.
          </p>
        </div>

        <Link
          href="/lernen/gesellenpruefung"
          className="rounded-xl border border-blue-500/40 px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-600 hover:text-white dark:text-blue-300"
        >
          Prüfung üben
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {diagnosisCases.map((caseItem) => (
          <article
            key={caseItem.title}
            className="flex min-h-[24rem] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
          >
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white dark:bg-slate-100 dark:text-slate-950">
                {caseItem.code}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {caseItem.system}
              </span>
            </div>

            <h3 className="mt-4 text-lg font-black text-slate-950 dark:text-slate-100">
              {caseItem.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {caseItem.symptom}
            </p>

            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Lernziel
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
                {caseItem.learningGoal}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                Erste Prüfpunkte
              </p>
              <ul className="mt-2 space-y-2">
                {caseItem.checks.slice(0, 3).map((check) => (
                  <li
                    key={check}
                    className="flex gap-2 text-sm leading-5 text-slate-600 dark:text-slate-300"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {caseItem.risk}
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

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Prüfungsfragen
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">
            Antworten wie im Fachgespräch
          </h2>

          <div className="mt-5 divide-y divide-slate-200 dark:divide-slate-800">
            {examQuestions.map((item) => (
              <div key={item.question} className="py-4 first:pt-0 last:pb-0">
                <p className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  {item.area}
                </p>
                <h3 className="mt-1 font-black text-slate-950 dark:text-slate-100">
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

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Bauteilwissen
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">
                Kurz erklärt, direkt prüfbar
              </h2>
            </div>

            <Link
              href="/lernen/wissen"
              className="rounded-xl border border-blue-500/40 px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-600 hover:text-white dark:text-blue-300"
            >
              Bauteil suchen
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {componentKnowledgeTopics.map((topic) => (
              <Link
                key={topic.href}
                href={topic.href}
                className="group flex min-h-48 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-blue-500/60 dark:hover:bg-blue-950/30"
              >
                <span className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  {topic.question}
                </span>
                <h3 className="mt-3 text-lg font-black text-slate-950 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
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
      </div>
    </section>
  );
}
