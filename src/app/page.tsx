import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SearchBar from "@/components/SearchBar";

const featureCards = [
  {
    title: "KI-Diagnose",
    description:
      "Fehlerbild, Fehlercode, Symptome und Messwerte eingeben. DiagnoseHUB erstellt daraus eine strukturierte technische Einschätzung.",
  },
  {
    title: "Prüfstrategie",
    description:
      "Die Antwort wird als Werkstatt-Prüfplan aufgebaut: mögliche Ursachen, sinnvolle Reihenfolge, Messwerte und nächste Schritte.",
  },
  {
    title: "Fallhistorie",
    description:
      "Diagnosefälle können gespeichert, später geöffnet und für Folgefragen oder Prüfprotokolle weiterverwendet werden.",
  },
  {
    title: "Prüfprotokoll",
    description:
      "Aus einem Diagnosefall lässt sich ein druckbares Prüfprotokoll für Werkstattdokumentation und Kundenakte erstellen.",
  },
];

const workflowSteps = [
  {
    title: "1. Fehlerfall beschreiben",
    description:
      "Fahrzeug, Motorcode, Fehlercode, Symptome, Live-Daten oder Kundenbeanstandung eingeben.",
  },
  {
    title: "2. Prüfplan erhalten",
    description:
      "DiagnoseHUB strukturiert den Fall und schlägt eine technische Prüfstrategie vor.",
  },
  {
    title: "3. Fall dokumentieren",
    description:
      "Fall speichern, später öffnen, weiterbearbeiten und als Prüfprotokoll nutzen.",
  },
];

const betaHighlights = [
  "Supabase Login",
  "Werkstattprofil",
  "Planlimits",
  "Fallhistorie",
  "Premium-Vormerkung",
  "Prüfprotokoll",
];

const targetGroups = [
  {
    title: "Freie Werkstätten",
    description:
      "Für Betriebe, die Diagnosefälle schneller strukturieren und sauber dokumentieren wollen.",
  },
  {
    title: "Kfz-Mechatroniker",
    description:
      "Für den Alltag zwischen Fehlerspeicher, Messwerten, Probefahrt und Reparaturentscheidung.",
  },
  {
    title: "Meisterschule & Lernen",
    description:
      "Geplant als Lernplattform für Diagnoseverständnis, Prüfungsfragen und technische Fallbeispiele.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main>
        <section className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute left-1/2 top-20 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-600 blur-[120px]" />
            <div className="absolute bottom-0 right-10 h-72 w-72 rounded-full bg-cyan-500 blur-[130px]" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 md:py-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-5 py-2 text-sm font-bold uppercase tracking-[0.25em] text-blue-300">
                DiagnoseHUB Beta 0.1
              </div>

              <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">
                KI-Diagnose für Kfz-Werkstätten.
              </h1>

              <p className="mt-6 max-w-3xl text-lg leading-9 text-slate-300">
                DiagnoseHUB hilft dabei, Fehlerfälle schneller zu strukturieren:
                Fehlercode, Symptom, Motorcode oder Messwerte eingeben und eine
                praxisnahe Prüfstrategie für die Werkstatt erhalten.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="#diagnose"
                  className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500"
                >
                  Diagnose starten
                </a>

                <a
                  href="/dashboard"
                  className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  Dashboard öffnen
                </a>

                <a
                  href="/premium"
                  className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-6 py-3 font-semibold text-yellow-300 transition hover:bg-yellow-500 hover:text-slate-950"
                >
                  Premium vormerken
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {betaHighlights.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-blue-950/40 backdrop-blur">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-400">
                Beispiel
              </p>

              <h2 className="mt-4 text-3xl font-black text-white">
                VW Passat B8 · P0299
              </h2>

              <p className="mt-4 leading-8 text-slate-400">
                Leistungsverlust, Ladedruck zu niedrig, sporadischer Notlauf.
                DiagnoseHUB strukturiert daraus mögliche Ursachen und eine
                sinnvolle Prüfreihenfolge.
              </p>

              <div className="mt-6 grid gap-3">
                {[
                  "Fehlerspeicher und Freeze-Frame prüfen",
                  "Ladeluftstrecke auf Undichtigkeiten prüfen",
                  "Soll-/Ist-Ladedruck vergleichen",
                  "Unterdrucksystem oder Ladedrucksteller prüfen",
                  "VTG-Verstellung und Sensorwerte bewerten",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4 text-slate-300"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <p className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm leading-7 text-yellow-100">
                Hinweis: DiagnoseHUB ersetzt keine fachgerechte Prüfung am
                Fahrzeug. Herstellerangaben und eigene Messwerte bleiben
                maßgeblich.
              </p>
            </div>
          </div>
        </section>

        <section id="diagnose" className="mx-auto max-w-7xl px-6 py-12">
          <div className="mb-8">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-400">
              Diagnose
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
              Fehlerfall analysieren
            </h2>

            <p className="mt-4 max-w-3xl leading-8 text-slate-400">
              Gib Fahrzeugdaten, Fehlercodes, Symptome oder Live-Daten ein.
              Folgefragen bleiben im selben Diagnoseverlauf.
            </p>
          </div>

          <SearchBar />
        </section>

        <section
          id="workflow"
          className="border-y border-slate-800 bg-slate-900/50"
        >
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="mb-8">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-400">
                Ablauf
              </p>

              <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
                Vom Fehlerbild zum Prüfplan
              </h2>

              <p className="mt-4 max-w-3xl leading-8 text-slate-400">
                Die Plattform ist für reale Werkstattfälle gebaut: erst
                eingrenzen, dann prüfen, dann dokumentieren.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {workflowSteps.map((step) => (
                <div
                  key={step.title}
                  className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6"
                >
                  <h3 className="text-xl font-bold text-white">
                    {step.title}
                  </h3>

                  <p className="mt-4 leading-7 text-slate-400">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 py-16">
          <div className="mb-8">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-400">
              Funktionen
            </p>

            <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
              Für den Werkstattalltag gebaut
            </h2>

            <p className="mt-4 max-w-3xl leading-8 text-slate-400">
              DiagnoseHUB kombiniert KI-Antworten mit Werkstattlogik,
              Fallhistorie, Planlimits und druckbarer Dokumentation.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-blue-950/20"
              >
                <h3 className="text-xl font-bold text-white">
                  {feature.title}
                </h3>

                <p className="mt-4 leading-7 text-slate-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-800 bg-slate-900/50">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="mb-8">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-400">
                Zielgruppe
              </p>

              <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
                Werkstatt, Diagnose und Lernen in einem System
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {targetGroups.map((group) => (
                <div
                  key={group.title}
                  className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6"
                >
                  <h3 className="text-xl font-bold text-white">
                    {group.title}
                  </h3>

                  <p className="mt-4 leading-7 text-slate-400">
                    {group.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="rounded-[2rem] border border-blue-500/20 bg-blue-500/10 p-8 shadow-2xl shadow-blue-950/30">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-300">
                  Lernplattform geplant
                </p>

                <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
                  Vorbereitung für Meisterschule und Diagnose-Training
                </h2>

                <p className="mt-4 leading-8 text-slate-300">
                  Der nächste Ausbauschritt ist ein Lernbereich mit Modulen,
                  Quizfragen, Fallbeispielen und Prüfungsmodus. Ziel ist eine
                  Plattform, die Diagnosepraxis und Meisterschule verbindet.
                </p>
              </div>

              <div className="grid gap-3">
                {[
                  "Motorentechnik",
                  "Elektrik und OBD",
                  "Abgasnachbehandlung",
                  "Klimaanlage",
                  "Fahrwerk und Bremse",
                  "Betriebsführung",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4 font-semibold text-slate-300"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="hinweis" className="mx-auto max-w-7xl px-6 pb-16">
          <div className="rounded-[2rem] border border-yellow-500/20 bg-yellow-500/10 p-8">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-yellow-300">
              Werkstatt-Hinweis
            </p>

            <h2 className="mt-3 text-3xl font-black text-white">
              Diagnosehilfe, keine Reparaturfreigabe
            </h2>

            <p className="mt-4 max-w-4xl leading-8 text-slate-300">
              DiagnoseHUB liefert technische Einschätzungen und strukturierte
              Prüfvorschläge. Die Verantwortung für Diagnose, Messung,
              Reparaturentscheidung, Herstellervorgaben und Arbeitssicherheit
              bleibt beim ausführenden Fachbetrieb.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
