import Image from "next/image";

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
    label: "Prüfprotokoll",
    href: "/prüfprotokoll",
  },
  {
    label: "Premium vormerken",
    href: "/premium",
  },
  {
    label: "Login",
    href: "/login",
  },
];

const infoLinks = [
  {
    label: "Ablauf",
    href: "/#workflow",
  },
  {
    label: "Funktionen",
    href: "/#features",
  },
  {
    label: "Werkstatt-Hinweis",
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

const futureLinks = [
  "Lernplattform",
  "Meisterschule-Modus",
  "PDF-Berichte",
  "Benutzerkonten",
  "Erweiterte Fallhistorie",
  "Premium-Zugang",
];

function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.9fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-slate-900 p-2 shadow-lg shadow-blue-950/30">
                <Image
                  src="/diagnosehub-logo.png"
                  alt="DiagnoseHUB Logo"
                  width={56}
                  height={56}
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <p className="text-xl font-bold text-white">DiagnoseHUB</p>
                <p className="text-sm text-slate-400">
                  KI-Diagnose für Werkstätten
                </p>
              </div>
            </div>

            <p className="mt-6 max-w-md leading-7 text-slate-400">
              DiagnoseHUB unterstützt Kfz-Werkstätten bei strukturierter
              Fehlersuche, Prüfstrategie, Folgefragen und Dokumentation von
              Diagnosefällen.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-300">
                Beta aktiv
              </span>

              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300">
                Version 0.1
              </span>
            </div>
          </div>

          <div>
            <p className="font-bold text-white">Produkt</p>

            <div className="mt-5 grid gap-3">
              {productLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate-400 transition hover:text-blue-300"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="font-bold text-white">Info</p>

            <div className="mt-5 grid gap-3">
              {infoLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate-400 transition hover:text-blue-300"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="font-bold text-white">Rechtliches</p>

            <div className="mt-5 grid gap-3">
              {legalLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-slate-400 transition hover:text-blue-300"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <p className="mt-6 font-bold text-white">Geplant</p>

            <div className="mt-5 grid gap-3">
              {futureLinks.map((link) => (
                <p key={link} className="text-sm text-slate-400">
                  {link}
                </p>
              ))}
            </div>
          </div>

          <div>
            <p className="font-bold text-white">Hinweis</p>

            <p className="mt-5 leading-7 text-slate-400">
              DiagnoseHUB ersetzt keine fachgerechte Prüfung am Fahrzeug. Die
              Plattform dient als Diagnosehilfe für Eingrenzung, Strukturierung
              und Dokumentation.
            </p>

            <p className="mt-5 leading-7 text-slate-500">
              Herstellerangaben, Reparaturleitfäden, gesetzliche Vorgaben und
              eigene Messwerte bleiben maßgeblich.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-slate-800 pt-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© 2026 DiagnoseHUB. Alle Rechte vorbehalten.</p>

          <div className="flex flex-wrap gap-4">
            <a href="/impressum" className="transition hover:text-blue-300">
              Impressum
            </a>

            <a href="/datenschutz" className="transition hover:text-blue-300">
              Datenschutz
            </a>

            <a href="/premium" className="transition hover:text-blue-300">
              Premium
            </a>

            <span>Beta 0.1</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
