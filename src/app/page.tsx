import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PublicOnly from "@/components/PublicOnly";
import SearchBar from "@/components/SearchBar";

const heroStats = [
  { label: "Weniger Raten", value: "Prüfen" },
  { label: "Besser erklären", value: "Dokumentieren" },
  { label: "Weiterlernen", value: "Verstehen" },
];

const valueCards = [
  {
    title: "Fehlteile vermeiden",
    description:
      "DiagnoseHUB zwingt den Fall in eine Prüfreihenfolge: erst einfache Checks, dann Messwerte, dann Teiletausch.",
  },
  {
    title: "Zeit im Fall sparen",
    description:
      "Fehlercode, Symptom, Messwert und Vorprüfung werden zu einem Arbeitsplan, statt lose in Notizen zu verschwinden.",
  },
  {
    title: "Kunden und Azubis besser abholen",
    description:
      "Werkstattantworten bleiben technisch, Hobby- und Lernantworten erklären Risiken, Begriffe und nächste Schritte verständlicher.",
  },
];

const paidReasons = [
  "Wenn ein unüberlegter Teiletausch teurer wäre als ein Monat DiagnoseHUB.",
  "Wenn Fälle später wieder auffindbar sein müssen, auch mit anderen Suchbegriffen.",
  "Wenn Diagnose, Anleitung, Lerninhalt und Dokumentation nicht in vier getrennten Werkzeugen liegen sollen.",
];

const quickActions = [
  {
    step: "01",
    title: "Fehler strukturiert prüfen",
    description:
      "Fahrzeug, Fehlercode, Symptom oder Messwert eingeben und einen geordneten Prüfplan erhalten.",
    href: "/#diagnose",
    cta: "Diagnose starten",
  },
  {
    step: "02",
    title: "Fälle wiederfinden",
    description:
      "Eigene Diagnosefälle, Nutzung, Tarif und Profil an einem zentralen Ort prüfen.",
    href: "/dashboard",
    cta: "Zum Dashboard",
  },
  {
    step: "03",
    title: "Lernen und Prüfung üben",
    description:
      "Lernmodule, Quiz, Bauteilwissen und Gesellenprüfung in klaren Stufen nutzen.",
    href: "/lernen",
    cta: "Lernen öffnen",
  },
  {
    step: "04",
    title: "Service erinnern lassen",
    description:
      "Private Fahrzeuge zentral speichern und HU, Service, Bremsflüssigkeit und Kilometer im Blick behalten.",
    href: "/service-erinnerung",
    cta: "Service verwalten",
  },
];

const workflowSteps = [
  {
    title: "Eingabe",
    description:
      "Je genauer Fahrzeug, Fehlercode, Symptom und Messwerte sind, desto besser wird der Ablauf.",
  },
  {
    title: "Prüfpunkte",
    description:
      "DiagnoseHUB sortiert Ursachen, Messpunkte und nächste Schritte in eine sinnvolle Reihenfolge.",
  },
  {
    title: "Folgefragen",
    description:
      "Du kannst im selben Fall weiterfragen, statt jedes Mal neu zu starten.",
  },
  {
    title: "Dokumentation",
    description:
      "Fälle lassen sich speichern und später im Dashboard oder Prüfprotokoll wiederverwenden.",
  },
];

const audienceCards = [
  {
    title: "Hobby-Schrauber",
    description:
      "Normale Sprache, klare Risiken und eine Einstufung, was selbst machbar ist und was in die Werkstatt gehört.",
    href: "/login?setup=profile",
    cta: "Account einrichten",
  },
  {
    title: "Werkstätten",
    description:
      "Fehlerfälle strukturieren, Ursachen eingrenzen und Arbeitsabläufe nachvollziehbar dokumentieren.",
    href: "/login?setup=profile",
    cta: "Account einrichten",
  },
  {
    title: "Azubis",
    description:
      "Diagnosewege verstehen, Prüfungsfragen üben und technische Zusammenhänge greifbar machen.",
    href: "/azubis",
    cta: "Mehr erfahren",
  },
  {
    title: "Schulen",
    description:
      "Fallbasierter Unterricht mit klaren Aufgaben, Fachgespräch und prüfungsnahen Abläufen.",
    href: "/schulen",
    cta: "Mehr erfahren",
  },
];

function DiagnosticBoardPreview() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
      <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">
          Beispiel-Ablauf
        </p>
        <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
          P0299 Ladedruck zu gering
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Aus einer groben Fehlermeldung wird ein prüfbarer Arbeitsplan mit Reihenfolge, Messwertlogik und Risiko.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        {[
          "Fehlerspeicher und Freeze-Frame prüfen",
          "Ladeluftstrecke mit Druck oder Rauch testen",
          "Soll-/Ist-Ladedruck im Fahrbetrieb vergleichen",
          "VTG/Wastegate, Sensorik und Unterdruck bewerten",
        ].map((item, index) => (
          <div
            key={item}
            className="grid grid-cols-[2.5rem_1fr] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white dark:bg-slate-100 dark:text-slate-950">
              P{index + 1}
            </span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {item}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
        Gute Eingabe: Fahrzeug, Baujahr, Motorcode, Fehlercode, Symptom,
        Messwert und was schon geprüft wurde. Je mehr Kontext, desto genauer die Antwort.
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main>
        <PublicOnly>
        <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:py-16">
            <div>
              <p className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                DiagnoseHUB Beta 0.9
              </p>

              <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
                Kfz-Diagnose so sortieren, dass weniger Zeit und Geld verloren geht.
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                DiagnoseHUB macht aus Fehlercode, Symptom, Messwert und Vorprüfung einen nachvollziehbaren Prüfplan. Für Werkstätten, Azubis und private Schrauber, die nicht blind Teile tauschen wollen.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#diagnose"
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-500 dark:shadow-blue-950/40"
                >
                  Diagnose starten
                </a>
                <Link
                  href="/preise"
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Preise ansehen
                </Link>
                <Link
                  href="/login?setup=profile"
                  className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                >
                  Kostenlos testen
                </Link>
              </div>

              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <p className="text-2xl font-black text-slate-950 dark:text-white">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <DiagnosticBoardPreview />
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50 py-10 dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-4 md:grid-cols-3">
              {valueCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">
                    {card.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {card.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-12">
          <div className="mb-6 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">
              Schnellstart
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              Was möchtest du jetzt tun?
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white transition group-hover:bg-blue-600 dark:bg-slate-100 dark:text-slate-950 dark:group-hover:bg-blue-500 dark:group-hover:text-white">
                  {action.step}
                </span>
                <h3 className="mt-5 text-xl font-black text-slate-950 dark:text-white">
                  {action.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {action.description}
                </p>
                <p className="mt-5 text-sm font-black text-blue-700 dark:text-blue-300">
                  {action.cta}
                </p>
              </Link>
            ))}
          </div>
        </section>

        </PublicOnly>

        <section
          id="diagnose"
          className="border-y border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-900/70"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">
                  KI-Diagnose
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  Fehlerfall eingeben
                </h2>
                <p className="mt-3 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">
                  Schreibe den Fall so, wie du ihn in der Werkstatt oder am
                  Fahrzeug vor dir hast. Fehlercode, Motorcode und bereits
                  geprüfte Punkte helfen am meisten.
                </p>
              </div>
            </div>

            <SearchBar />
          </div>
        </section>

        <PublicOnly>
        <section id="workflow" className="mx-auto max-w-7xl px-6 py-14">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">
              Ablauf
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
              So nutzt du DiagnoseHUB
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="text-sm font-black text-blue-700 dark:text-blue-300">
                  Schritt {index + 1}
                </span>
                <h3 className="mt-3 text-xl font-black text-slate-950 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[0.8fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">
                Warum bezahlen?
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                DiagnoseHUB soll sich im Alltag rechnen.
              </h2>
              <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
                Der Wert entsteht nicht durch eine hübsche Antwort, sondern durch weniger Sucherei,
                bessere Prüfreihenfolge, wiederverwendbare Fälle und verständlichere Dokumentation.
              </p>
            </div>

            <div className="grid gap-3">
              {paidReasons.map((reason) => (
                <div
                  key={reason}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <span className="mt-1 h-5 w-5 shrink-0 rounded-full border border-blue-500 bg-blue-50 dark:bg-blue-500/10" />
                  <p className="text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
                    {reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="zielgruppen"
          className="border-y border-slate-200 bg-slate-100 py-14 dark:border-slate-800 dark:bg-slate-900/70"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-8 max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">
                Zielgruppen
              </p>
              <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
                Hobby oder Werkstatt einrichten
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {audienceCards.map((group) => (
                <Link
                  key={`${group.title}-${group.href}`}
                  href={group.href}
                  className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
                >
                  <h3 className="text-xl font-black text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                    {group.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {group.description}
                  </p>
                  <p className="mt-5 text-sm font-black text-blue-700 dark:text-blue-300">
                    {group.cta}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        </PublicOnly>

        <section id="hinweis" className="mx-auto max-w-7xl px-6 py-14">
          <div className="rounded-3xl border border-yellow-300 bg-yellow-50 p-8 dark:border-yellow-700/60 dark:bg-yellow-950/30">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-yellow-800 dark:text-yellow-300">
              Wichtig
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
              Diagnosehilfe, keine Reparaturfreigabe
            </h2>
            <p className="mt-4 max-w-4xl leading-7 text-yellow-950 dark:text-yellow-100">
              DiagnoseHUB liefert technische Einschätzungen und strukturierte
              Prüfvorschläge. Verantwortung für Messung, Sicherheit,
              Herstellervorgaben und Reparaturentscheidung bleibt beim
              ausführenden Nutzer oder Fachbetrieb.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
