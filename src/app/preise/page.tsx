import Link from "next/link";
import Header from "@/components/Header";
import StripeCheckoutButton from "@/components/StripeCheckoutButton";

export const metadata = {
  title: "Preise | DiagnoseHUB",
  description:
    "Wähle den passenden DiagnoseHUB-Tarif für Kfz-Diagnose, Lernen und private Fahrzeugpflege.",
};

const plans = [
  {
    name: "Free",
    price: "0 €",
    interval: "",
    description: "Zum Testen und für den ersten Einstieg.",
    features: [
      "Basiszugriff auf Lerninhalte",
      "Begrenzte Nutzung von Bauteilwissen",
      "Begrenzte Quiz-Nutzung",
      "Ideal zum Ausprobieren",
    ],
    cta: "Kostenlos starten",
    href: "/lernen",
    highlighted: false,
    type: "link",
  },
  {
    name: "Service-Erinnerung",
    price: "9,99 €",
    interval: "/ Jahr",
    description: "Für private Nutzer: HU, AU, Service und Wartungstermine.",
    features: [
      "Eigene Fahrzeuge und Kilometerstände verwalten",
      "HU/AU-Fälligkeit berechnen",
      "Hersteller-Serviceintervall nach Datum und km berücksichtigen",
      "Bremsflüssigkeit und eigene Wartungstermine vorbereiten",
      "Zentrale Speicherung im DiagnoseHUB Account",
    ],
    cta: "Service-Erinnerung aktivieren",
    href: "/service-erinnerung",
    highlighted: false,
    type: "stripe",
    plan: "service_reminder",
  },
  {
    name: "Pro",
    price: "49 €",
    interval: "/ Monat",
    description: "Für regelmäßige Nutzung in Diagnose, Lernen und Praxis.",
    features: [
      "KI-Diagnose und Anleitungen in einem Eingabefeld",
      "Mehr Quizfragen und Lernfunktionen",
      "Bauteilwissen für Sensoren, Aktoren und Systeme",
      "Praxisnahe Prüfstrategien",
      "Geeignet für Azubis, Gesellen und private Schrauber",
      "Weitere Funktionen werden laufend ergänzt",
    ],
    cta: "Pro aktivieren",
    href: "",
    highlighted: true,
    type: "stripe",
    plan: "pro",
  },
  {
    name: "Privat Plus",
    price: "Auf Anfrage",
    interval: "",
    description: "Für Familien, mehrere Fahrzeuge oder intensivere Nutzung.",
    features: [
      "Mehrere Fahrzeuge möglich",
      "Geeignet für Lernen und eigene Wartungsplanung",
      "Zentrale Nutzung im Account",
      "Perspektivisch Familienfreigabe",
      "Individuelle Einführung möglich",
    ],
    cta: "Privat Plus anfragen",
    href: "mailto:info@diagnosehub.de?subject=Privat%20Plus%20DiagnoseHUB",
    highlighted: false,
    type: "link",
  },
];

export default function PreisePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
        <section className="mb-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            DiagnoseHUB Preise
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Wähle deinen Zugang
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            Starte kostenlos und schalte später mehr Funktionen für Lernen,
            Bauteilwissen, Quizfragen und Diagnosepraxis frei.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={
                plan.highlighted
                  ? "relative rounded-3xl border-2 border-blue-500 bg-white p-6 shadow-md transition-colors dark:bg-slate-900"
                  : "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900"
              }
            >
              {plan.highlighted && (
                <div className="mb-4 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  Empfehlung
                </div>
              )}

              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
                {plan.name}
              </h2>

              <div className="mt-4 flex items-end gap-1">
                <span className="text-3xl font-bold text-slate-950 dark:text-white">
                  {plan.price}
                </span>

                {plan.interval && (
                  <span className="pb-1 text-sm text-slate-500 dark:text-slate-400">
                    {plan.interval}
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {plan.description}
              </p>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300"
                  >
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.type === "stripe" ? (
                <>
                  <StripeCheckoutButton
                    plan={plan.plan as "pro" | "service_reminder"}
                    className="block w-full rounded-2xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    {plan.cta}
                  </StripeCheckoutButton>

                  {plan.href && (
                    <Link
                      href={plan.href}
                      className="mt-3 block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-center text-sm font-semibold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                    >
                      Service-Seite ansehen
                    </Link>
                  )}
                </>
              ) : (
                <a
                  href={plan.href}
                  className={
                    plan.highlighted
                      ? "mt-6 block rounded-2xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
                      : "mt-6 block rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-center text-sm font-semibold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                  }
                >
                  {plan.cta}
                </a>
              )}
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-950 dark:text-white">
            Aktueller Hinweis
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            DiagnoseHUB befindet sich noch im Aufbau. Funktionen, Limits und
            Preise können sich bis zum offiziellen Start noch ändern.
          </p>
        </section>
        </div>
      </main>
    </div>
  );
}
