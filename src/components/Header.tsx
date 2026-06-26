"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type UserPlan = "free" | "werkstatt" | "pro";

type DemoAccount = {
  name: string;
  workshop: string;
  email: string;
  role: string;
  plan: UserPlan;
  updatedAt: string;
};

const DEMO_ACCOUNT_STORAGE_KEY = "diagnosehub-demo-account";
const USER_PLAN_STORAGE_KEY = "diagnosehub-user-plan";

const navigationLinks = [
  { label: "Diagnose", href: "/#diagnose" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Ablauf", href: "/#workflow" },
  { label: "Funktionen", href: "/#features" },
];

const planLabels: Record<UserPlan, string> = {
  free: "Free",
  werkstatt: "Werkstatt Demo",
  pro: "Pro Demo",
};

function isValidUserPlan(value: string | null): value is UserPlan {
  return value === "free" || value === "werkstatt" || value === "pro";
}

function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoAccount, setDemoAccount] = useState<DemoAccount | null>(null);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function loadAccountState() {
    try {
      const savedAccount = localStorage.getItem(DEMO_ACCOUNT_STORAGE_KEY);
      const savedPlan = localStorage.getItem(USER_PLAN_STORAGE_KEY);

      if (isValidUserPlan(savedPlan)) {
        setUserPlan(savedPlan);
      } else {
        setUserPlan("free");
      }

      if (savedAccount) {
        const parsedAccount = JSON.parse(savedAccount) as DemoAccount;

        setDemoAccount(parsedAccount);

        if (isValidUserPlan(parsedAccount.plan)) {
          setUserPlan(parsedAccount.plan);
        }

        return;
      }

      setDemoAccount(null);
    } catch (error) {
      console.error("Accountstatus konnte nicht geladen werden:", error);
      setDemoAccount(null);
      setUserPlan("free");
    }
  }

  useEffect(() => {
    loadAccountState();

    function handleStorageChange() {
      loadAccountState();
    }

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleStorageChange);
    };
  }, []);

  const accountLabel = demoAccount?.workshop || "Kein Account";
  const planLabel = planLabels[userPlan];

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

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-300 lg:flex">
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
            <a
              href="/login"
              className={
                demoAccount
                  ? "rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500 hover:text-white"
                  : "rounded-xl border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              }
            >
              {demoAccount ? (
                <span className="flex items-center gap-2">
                  <span className="max-w-40 truncate">{accountLabel}</span>
                  <span className="rounded-full bg-slate-950/70 px-2 py-0.5 text-xs">
                    {planLabel}
                  </span>
                </span>
              ) : (
                "Login"
              )}
            </a>

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
              {demoAccount && (
                <a
                  href="/login"
                  onClick={closeMobileMenu}
                  className="rounded-2xl border border-blue-500/40 bg-blue-500/10 px-5 py-4"
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">
                    Aktiver Account
                  </p>
                  <p className="mt-2 font-bold text-white">{accountLabel}</p>
                  <p className="mt-1 text-sm text-slate-400">{planLabel}</p>
                </a>
              )}

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

              <a
                href="/login"
                onClick={closeMobileMenu}
                className="rounded-2xl border border-slate-700 px-5 py-4 text-left font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {demoAccount ? "Account verwalten" : "Login"}
              </a>

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