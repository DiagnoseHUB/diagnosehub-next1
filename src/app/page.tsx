import Image from "next/image";
import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";

const exampleCases = [
  "VW Passat CBAB P0299 Leistungsverlust",
  "Audi A4 B8 CDHB P0171 ruckelt im Leerlauf",
  "BMW N47D20 P0087 startet schlecht",
  "Opel D14NEL Turbolader erneut defekt",
];

const workflowSteps = [
  {
    number: "01",
    title: "Fall eingeben",
    text: "Fahrzeug, Motorcode, Fehlercode, Symptom oder Messwert eingeben.",
  },
  {
    number: "02",
    title: "Kontext erkennen",
    text: "DiagnoseHUB erkennt Motortyp, Motorkennbuchstaben und bekannte Fehlercodes.",
  },
  {
    number: "03",
    title: "Prüfplan erhalten",
    text: "Die KI erstellt eine strukturierte Diagnose mit Ursachen, Messwerten und Prüfreihenfolge.",
  },
  {
    number: "04",
    title: "Folgefragen stellen",
    text: "Rückfragen wie „Ladedruck Sollwert?“ oder „Was zuerst prüfen?“ bleiben im gleichen Fallkontext.",
  },
];

const features = [
  {
    title: "Motorkennbuchstaben-Erkennung",
    text: "Bekannte Motorcodes werden vor der KI ausgewertet, damit Diesel und Benziner nicht verwechselt werden.",
  },
  {
    title: "Fehlercode-Datenbank",
    text: "OBD-Codes wie P0299, P0087, P0171 oder P2002 liefern festen technischen Kontext für die Diagnose.",
  },
  {
    title: "Qualitätsprüfung",
    text: "Grobe technische Konflikte wie Zündkerzen beim Diesel werden erkannt und automatisch neu geprüft.",
  },
  {
    title: "Folgefragen mit Kontext",
    text: "Der Diagnoseverlauf bleibt erhalten, sodass kurze Rückfragen praxisnah beantwortet werden.",
  },
  {
    title: "Fallbericht exportieren",
    text: "Diagnoseverlauf, Motorkontext und Fehlercode-Kontext können kopiert oder als TXT gespeichert werden.",
  },
  {
    title: "Werkstattgerechte Prüfreihenfolge",
    text: "Erst einfache Prüfungen, dann Live-Daten, dann mechanische Messungen statt blindem Teiletausch.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main>
        <section className="mx-auto grid max-w-7xl items-start gap-16 px-6 py-20 lg:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-5 py-2 text-sm font-medium text-blue-300">
              KI-Diagnose für Kfz-Werkstätten
            </div>

            <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
              Diagnose statt{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                Teile-Raten.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              DiagnoseHUB kombiniert Motorkennbuchstaben, Fehlercodes, Symptome,
              Live-Daten und KI zu einem strukturierten Prüfplan für den
              Werkstattalltag.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {exampleCases.map((example) => (
                <div
                  key={example}
                  className="rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300"
                >
                  {example}
                </div>
              ))}
            </div>

            <div id="diagnose" className="mt-10 scroll-mt-28">
              <SearchBar />
            </div>
          </div>

          <div className="space-y-8">
            <div className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/50 p-10 shadow-2xl shadow-blue-950/50">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

              <div className="relative flex flex-col items-center text-center">
                <div className="mb-6 flex h-72 w-72 items-center justify-center rounded-full border border-blue-500/20 bg-slate-950/70 p-8 shadow-2xl shadow-blue-950/60 md:h-96 md:w-96">
                  <Image
                    src="/diagnosehub-logo.png"
                    alt="DiagnoseHUB Logo"
                    width={420}
                    height={420}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>

                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-300">
                  DiagnoseHUB
                </p>

                <h2 className="mt-4 text-3xl font-bold md:text-4xl">
                  Werkstattdiagnose mit System.
                </h2>

                <p className="mt-4 max-w-xl leading-7 text-slate-400">
                  Motorcode, Fehlercode, Symptom und Verlauf werden in einem
                  Fall zusammengeführt.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-blue-950/40">
              <p className="mb-4 text-sm font-medium text-blue-400">
                DiagnoseHUB Workflow
              </p>

              <h2 className="text-3xl font-bold">
                Vom Fehlercode zum Prüfplan.
              </h2>

              <p className="mt-4 leading-7 text-slate-400">
                Starte mit einem echten Werkstattfall. Danach kannst du
                Folgefragen stellen, Messwerte abfragen und den kompletten
                Diagnoseverlauf als Fallbericht sichern.
              </p>

              <div className="mt-8 space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span>Motorkontext erkennen</span>
                    <span className="font-bold text-green-400">aktiv</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span>Fehlercodes zuordnen</span>
                    <span className="font-bold text-green-400">aktiv</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span>KI-Diagnose erstellen</span>
                    <span className="font-bold text-blue-400">aktiv</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span>Folgefragen im Fallkontext</span>
                    <span className="font-bold text-cyan-400">aktiv</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span>Fallbericht exportieren</span>
                    <span className="font-bold text-yellow-400">aktiv</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-20">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-400">
              Warum DiagnoseHUB?
            </p>

            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold">
                  Mehr Struktur als normale KI.
                </h2>

                <p className="mt-4 leading-8 text-slate-400">
                  Normale KI kann technische Zusammenhänge frei formulieren, aber
                  sie kennt deinen Diagnosefall nicht sauber genug. DiagnoseHUB
                  legt zuerst Werkstatt-Kontext über den Fall: Motorcode,
                  Kraftstoffart, Fehlercode, Verlauf und Qualitätsprüfung.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <div>
                    <p className="font-bold text-slate-400">Normale KI</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Antwortet frei und kann Diesel/Benziner oder Bauteile
                      verwechseln.
                    </p>
                  </div>

                  <div>
                    <p className="font-bold text-blue-300">DiagnoseHUB</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Nutzt Motorcode, Fehlercode-Kontext und technische
                      Prüfregeln.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <div>
                    <p className="font-bold text-slate-400">Normale KI</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Gibt oft allgemeine Tipps ohne klare Reihenfolge.
                    </p>
                  </div>

                  <div>
                    <p className="font-bold text-blue-300">DiagnoseHUB</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Erstellt eine prüfbare Reihenfolge mit Messwerten und
                      Folgefragen.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <div>
                    <p className="font-bold text-slate-400">Normale KI</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Der Verlauf ist schwer für Werkstattdokumentation nutzbar.
                    </p>
                  </div>

                  <div>
                    <p className="font-bold text-blue-300">DiagnoseHUB</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Fallbericht kopieren oder als TXT-Datei speichern.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="workflow"
          className="mx-auto max-w-7xl scroll-mt-28 px-6 pb-20"
        >
          <div className="mb-10">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-400">
              Ablauf
            </p>

            <h2 className="text-4xl font-bold">So arbeitet DiagnoseHUB.</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((step) => (
              <div
                key={step.number}
                className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7"
              >
                <p className="text-sm font-bold text-blue-400">
                  {step.number}
                </p>

                <h3 className="mt-5 text-xl font-bold">{step.title}</h3>

                <p className="mt-3 leading-7 text-slate-400">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="features"
          className="mx-auto max-w-7xl scroll-mt-28 px-6 pb-20"
        >
          <div className="mb-10">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-400">
              Funktionen
            </p>

            <h2 className="text-4xl font-bold">
              Gebaut für reale Werkstattfälle.
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-7"
              >
                <h3 className="text-xl font-bold">{feature.title}</h3>

                <p className="mt-3 leading-7 text-slate-400">
                  {feature.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="hinweis"
          className="mx-auto max-w-7xl scroll-mt-28 px-6 pb-24"
        >
          <div className="rounded-3xl border border-blue-500/20 bg-blue-500/10 p-8">
            <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr] lg:items-center">
              <div>
                <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-300">
                  Werkstatt-Hinweis
                </p>

                <h2 className="text-3xl font-bold">
                  DiagnoseHUB ersetzt keine Messung am Fahrzeug.
                </h2>

                <p className="mt-4 leading-8 text-slate-300">
                  Die Plattform unterstützt bei Eingrenzung, Prüfstrategie und
                  Dokumentation. Entscheidend bleiben Live-Daten, Messwerte,
                  Sichtprüfung und fachgerechte Diagnose am Fahrzeug.
                </p>
              </div>

              <div
                id="premium"
                className="scroll-mt-28 rounded-2xl border border-slate-800 bg-slate-950/70 p-6"
              >
                <p className="text-sm text-slate-500">Status</p>
                <p className="mt-2 text-2xl font-bold text-green-400">
                  Prototyp aktiv
                </p>

                <p className="mt-4 text-sm leading-6 text-slate-400">
                  Nächste Ausbaustufen: Login, Benutzerkonten, Fallhistorie,
                  PDF-Berichte und größere technische Datenbank.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}