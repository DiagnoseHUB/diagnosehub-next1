"use client";

import Image from "next/image";
import { useState } from "react";

const navigationLinks = [
  { label: "Diagnose", href: "/#diagnose" },
  { label: "Ablauf", href: "/#workflow" },
  { label: "Funktionen", href: "/#features" },
  { label: "Hinweis", href: "/#hinweis" },
];

function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between py-4">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-slate-900 p-2 shadow-lg shadow-blue-950/30">
              <Image
                src="/diagnosehub-logo.png"
                alt="DiagnoseHUB Logo"
                width={48}
                height={48}
                priority
                className="h-full w-full object-contain"
              />
            </div>

            <div>
              <p className="text-lg font-bold leading-tight text-white">
                DiagnoseHUB
              </p>
              <p className="text-xs text-slate-400">
                KI-Diagnose für Werkstätten
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 lg:flex">
            {navigationLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition hover:text-white"
              >
                {link.label}
              </a>
            ))}

            <a
              href="/premium"
              className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-yellow-300 transition hover:bg-yellow-500 hover:text-slate-950"
            >
              Premium vormerken
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white">
              Login
            </button>

            <a
              href="/#diagnose"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500"
            >
              Diagnose starten
            </a>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((currentValue) => !currentValue)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:bg-slate-800 hover:text-white md:hidden"
            aria-label={mobileMenuOpen ? "Menü schließen" : "Menü öffnen"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <span className="text-2xl leading-none">×</span>
            ) : (
              <span className="flex flex-col gap-1.5">
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
              </span>
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-800 py-5 md:hidden">
            <nav className="grid gap-3">
              {navigationLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 font-semibold text-slate-300 transition hover:border-blue-500 hover:text-blue-300"
                >
                  {link.label}
                </a>
              ))}

              <a
                href="/premium"
                onClick={closeMobileMenu}
                className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 font-semibold text-yellow-300 transition hover:bg-yellow-500 hover:text-slate-950"
              >
                Premium vormerken
              </a>

              <button className="rounded-2xl border border-slate-700 px-5 py-4 text-left font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white">
                Login
              </button>

              <a
                href="/#diagnose"
                onClick={closeMobileMenu}
                className="rounded-2xl bg-blue-600 px-5 py-4 text-center font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500"
              >
                Diagnose starten
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;