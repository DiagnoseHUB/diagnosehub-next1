import Image from "next/image";
import Link from "next/link";
import FeedbackForm from "@/components/FeedbackForm";

const productLinks = [
  {
    label: "Diagnose starten",
    href: "/#diagnose",
  },
  {
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    label: "Lernen",
    href: "/lernen",
  },
  {
    label: "Service-Erinnerung",
    href: "/service-erinnerung",
  },
  {
    label: "Prüfprotokoll",
    href: "/pruefprotokoll",
  },
];

const infoLinks = [
  {
    label: "Azubis",
    href: "/azubis",
  },
  {
    label: "Schulen",
    href: "/schulen",
  },
  {
    label: "Werkstätten",
    href: "/werkstaetten",
  },
  {
    label: "Ablauf",
    href: "/#workflow",
  },
  {
    label: "Funktionen",
    href: "/#features",
  },
  {
    label: "Hinweis",
    href: "/#hinweis",
  },
];

const legalLinks = [
  {
    label: "Impressum",
    href: "/impressum",
  },
  {
    label: "Datenschutz",
    href: "/datenschutz",
  },
];

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-700 transition-colors dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-12 grid gap-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/70 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-700 dark:text-blue-300">
              DiagnoseHUB
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              Strukturierte Diagnose statt Teilewerfen.
            </h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">
              Starte einen Fall, öffne dein Dashboard oder gib Feedback direkt
              an die Entwicklung.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/#diagnose"
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
            >
              Diagnose starten
            </Link>
            <Link
              href="/preise"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Preise ansehen
            </Link>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr_0.75fr_0.75fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <Image
                  src="/diagnosehub-logo.png"
                  alt="DiagnoseHUB Logo"
                  width={56}
                  height={56}
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <p className="text-xl font-black text-slate-950 dark:text-white">
                  DiagnoseHUB
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  KI-Diagnose für Werkstatt und privat
                </p>
              </div>
            </div>

            <p className="mt-6 max-w-md leading-7 text-slate-600 dark:text-slate-300">
              DiagnoseHUB unterstützt Werkstätten und private Nutzer bei
              strukturierter Fehlersuche, Prüfstrategie, Folgefragen und
              Dokumentation von Diagnosefällen.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
                Beta 0.9
              </span>

              <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                Version 0.9
              </span>
            </div>
          </div>

          <div>
            <p className="font-black text-slate-950 dark:text-white">Produkt</p>

            <div className="mt-5 grid gap-3">
              {productLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-semibold text-slate-600 transition hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="font-black text-slate-950 dark:text-white">Info</p>

            <div className="mt-5 grid gap-3">
              {infoLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-semibold text-slate-600 transition hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="font-black text-slate-950 dark:text-white">
              Rechtliches
            </p>

            <div className="mt-5 grid gap-3">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-semibold text-slate-600 transition hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-300"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="font-black text-slate-950 dark:text-white">Hinweis</p>

            <p className="mt-5 leading-7 text-slate-600 dark:text-slate-300">
              DiagnoseHUB ersetzt keine fachgerechte Prüfung am Fahrzeug. Die
              Plattform dient als Diagnosehilfe für Eingrenzung, Strukturierung
              und Dokumentation.
            </p>

            <p className="mt-5 leading-7 text-slate-500 dark:text-slate-400">
              Herstellerangaben, Reparaturleitfäden, gesetzliche Vorgaben und
              eigene Messwerte bleiben maßgeblich.
            </p>
          </div>
        </div>

        <FeedbackForm />

        <div className="mt-12 flex flex-col gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>© 2026 DiagnoseHUB. Alle Rechte vorbehalten.</p>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/impressum"
              className="font-semibold transition hover:text-blue-700 dark:hover:text-blue-300"
            >
              Impressum
            </Link>

            <Link
              href="/datenschutz"
              className="font-semibold transition hover:text-blue-700 dark:hover:text-blue-300"
            >
              Datenschutz
            </Link>

            <Link
              href="/preise"
              className="font-semibold transition hover:text-blue-700 dark:hover:text-blue-300"
            >
              Preise
            </Link>

            <span>Beta 0.9</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
