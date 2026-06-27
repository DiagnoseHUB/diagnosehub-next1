"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import ThemeToggle from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";
import {
  PLAN_CONFIG,
  isValidUserPlan,
  type UserPlan,
} from "@/config/plans";


type AccountSource = "none" | "localStorage" | "supabase";

type DemoAccount = {
  name: string;
  workshop: string;
  email: string;
  role: string;
  plan: UserPlan;
  updatedAt: string;
  supabaseUserId?: string;
};

type WorkshopProfileDatabaseRow = {
  id: string;
  full_name: string;
  workshop_name: string;
  email: string;
  role: string;
  plan: UserPlan;
  created_at: string;
  updated_at: string;
};

const DEMO_ACCOUNT_STORAGE_KEY = "diagnosehub-demo-account";
const USER_PLAN_STORAGE_KEY = "diagnosehub-user-plan";

const navigationLinks = [
  { label: "Diagnose", href: "/#diagnose" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Ablauf", href: "/#workflow" },
  { label: "Funktionen", href: "/#features" },
];

const accountSourceLabels: Record<AccountSource, string> = {
  none: "Kein Account",
  localStorage: "Lokal",
  supabase: "Supabase",
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unbekannter Fehler";
}

function readLocalAccount(): DemoAccount | null {
  try {
    const savedAccount = localStorage.getItem(DEMO_ACCOUNT_STORAGE_KEY);

    if (!savedAccount) {
      return null;
    }

    return JSON.parse(savedAccount) as DemoAccount;
  } catch (error) {
    console.error("Lokaler Account konnte nicht gelesen werden:", error);
    return null;
  }
}

function readLocalPlan(): UserPlan {
  try {
    const savedPlan = localStorage.getItem(USER_PLAN_STORAGE_KEY);

    if (isValidUserPlan(savedPlan)) {
      return savedPlan;
    }

    const savedAccount = readLocalAccount();

    if (savedAccount && isValidUserPlan(savedAccount.plan)) {
      return savedAccount.plan;
    }
  } catch (error) {
    console.error("Lokaler Plan konnte nicht gelesen werden:", error);
  }

  return "free";
}

function syncProfileToLocalStorage(profile: WorkshopProfileDatabaseRow) {
  const localAccount: DemoAccount = {
    name: profile.full_name,
    workshop: profile.workshop_name,
    email: profile.email,
    role: profile.role,
    plan: profile.plan,
    updatedAt: profile.updated_at,
    supabaseUserId: profile.id,
  };

  localStorage.setItem(DEMO_ACCOUNT_STORAGE_KEY, JSON.stringify(localAccount));
  localStorage.setItem(USER_PLAN_STORAGE_KEY, profile.plan);
}

function clearLocalAccountState() {
  localStorage.removeItem(DEMO_ACCOUNT_STORAGE_KEY);
  localStorage.setItem(USER_PLAN_STORAGE_KEY, "free");
}

function convertProfileToDemoAccount(
  profile: WorkshopProfileDatabaseRow
): DemoAccount {
  return {
    name: profile.full_name,
    workshop: profile.workshop_name,
    email: profile.email,
    role: profile.role,
    plan: profile.plan,
    updatedAt: profile.updated_at,
    supabaseUserId: profile.id,
  };
}

function Header() {
  const supabase = useMemo(() => createClient(), []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoAccount, setDemoAccount] = useState<DemoAccount | null>(null);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [accountSource, setAccountSource] = useState<AccountSource>("none");
  const [accountLoading, setAccountLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function applyLoggedOutState() {
    setDemoAccount(null);
    setUserPlan("free");
    setAccountSource("none");
  }

  function applyLocalFallback() {
    const localAccount = readLocalAccount();
    const localPlan = readLocalPlan();

    setDemoAccount(localAccount);
    setUserPlan(localAccount?.plan || localPlan);

    if (localAccount) {
      setAccountSource("localStorage");
    } else {
      setAccountSource("none");
    }
  }

  async function loadAccountState(existingSession?: Session | null) {
    setAccountLoading(true);

    try {
      applyLocalFallback();

      const session =
        existingSession ??
        (await supabase.auth.getSession()).data.session ??
        null;

      if (!session?.user) {
        setAccountLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("workshop_profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error(
          "Header-Profil konnte nicht aus Supabase geladen werden:",
          error.message
        );

        const localPlan = readLocalPlan();
        const localAccount = readLocalAccount();

        if (localAccount) {
          setDemoAccount({
            ...localAccount,
            email: session.user.email || localAccount.email,
            supabaseUserId: session.user.id,
          });
          setUserPlan(localAccount.plan || localPlan);
          setAccountSource("localStorage");
        } else {
          setDemoAccount({
            name: "Supabase Nutzer",
            workshop: "Profil unvollständig",
            email: session.user.email || "nicht hinterlegt",
            role: "Werkstatt",
            plan: localPlan,
            updatedAt: new Date().toISOString(),
            supabaseUserId: session.user.id,
          });
          setUserPlan(localPlan);
          setAccountSource("localStorage");
        }

        return;
      }

      if (!data) {
        const localPlan = readLocalPlan();
        const localAccount = readLocalAccount();

        if (localAccount) {
          setDemoAccount({
            ...localAccount,
            email: session.user.email || localAccount.email,
            supabaseUserId: session.user.id,
          });
          setUserPlan(localAccount.plan || localPlan);
          setAccountSource("localStorage");
          return;
        }

        setDemoAccount({
          name: "Supabase Nutzer",
          workshop: "Profil noch nicht gespeichert",
          email: session.user.email || "nicht hinterlegt",
          role: "Werkstatt",
          plan: localPlan,
          updatedAt: new Date().toISOString(),
          supabaseUserId: session.user.id,
        });
        setUserPlan(localPlan);
        setAccountSource("localStorage");
        return;
      }

      const profile = data as WorkshopProfileDatabaseRow;
      const nextAccount = convertProfileToDemoAccount(profile);

      setDemoAccount(nextAccount);
      setUserPlan(profile.plan);
      setAccountSource("supabase");
      syncProfileToLocalStorage(profile);
    } catch (error) {
      console.error("Header-Accountstatus konnte nicht geladen werden:", error);
      console.error(getErrorMessage(error));
      applyLocalFallback();
    } finally {
      setAccountLoading(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);

    try {
      await supabase.auth.signOut();
      clearLocalAccountState();
      applyLoggedOutState();
      closeMobileMenu();

      window.location.href = "/login";
    } catch (error) {
      console.error("Logout fehlgeschlagen:", error);
      clearLocalAccountState();
      applyLoggedOutState();
      closeMobileMenu();

      window.location.href = "/login";
    } finally {
      setLogoutLoading(false);
    }
  }

  useEffect(() => {
    void loadAccountState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, nextSession: Session | null) => {
        await loadAccountState(nextSession);
      }
    );

    function handleStorageChange() {
      void loadAccountState();
    }

    function handleFocus() {
      void loadAccountState();
    }

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [supabase]);

  const accountLabel = demoAccount?.workshop || "Kein Account";
  const planLabel = PLAN_CONFIG[userPlan].label;
  const sourceLabel = accountSourceLabels[accountSource];

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
            <ThemeToggle />

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
                  <span className="max-w-40 truncate">
                    {accountLoading ? "Lädt..." : accountLabel}
                  </span>

                  <span className="rounded-full bg-slate-950/70 px-2 py-0.5 text-xs">
                    {planLabel}
                  </span>

                  <span
                    className={
                      accountSource === "supabase"
                        ? "rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-300"
                        : "rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-300"
                    }
                  >
                    {sourceLabel}
                  </span>
                </span>
              ) : accountLoading ? (
                "Lädt..."
              ) : (
                "Login"
              )}
            </a>

            {demoAccount && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutLoading}
                className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {logoutLoading ? "Logout..." : "Logout"}
              </button>
            )}

            <a
              href="/#diagnose"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500"
            >
              Diagnose starten
            </a>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />

            <button
              type="button"
              onClick={() => setMobileMenuOpen((currentValue) => !currentValue)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:bg-slate-800 hover:text-white"
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

                  <p className="mt-2 font-bold text-white">
                    {accountLoading ? "Lädt..." : accountLabel}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300">
                      {planLabel}
                    </span>

                    <span
                      className={
                        accountSource === "supabase"
                          ? "rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300"
                          : "rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-300"
                      }
                    >
                      {sourceLabel}
                    </span>
                  </div>

                  {demoAccount.email && (
                    <p className="mt-2 break-words text-sm text-slate-400">
                      {demoAccount.email}
                    </p>
                  )}
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

              {demoAccount && (
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-left font-semibold text-red-300 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {logoutLoading ? "Logout..." : "Logout"}
                </button>
              )}

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