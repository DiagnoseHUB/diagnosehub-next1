"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import ThemeToggle from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";
import { PLAN_CONFIG, type UserPlan } from "@/config/plans";
import {
  clearLocalWorkshopProfileState,
  convertProfileToDemoAccount,
  loadWorkshopProfileFromSupabase,
  readLocalDemoAccount,
  readLocalPlan,
  syncWorkshopProfileToLocalStorage,
  type DemoAccount,
} from "@/services/workshopProfileSupabase";

type AccountSource = "none" | "localStorage" | "supabase";

const navigationLinks = [
  { label: "KI-Diagnose", href: "/#diagnose" },
  { label: "Lernen", href: "/lernen" },
  { label: "Service", href: "/service-erinnerung" },
  { label: "Preise", href: "/preise" },
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
    const localAccount = readLocalDemoAccount();
    const localPlan = readLocalPlan();

    setDemoAccount(localAccount);
    setUserPlan(localAccount?.plan || localPlan);

    if (localAccount) {
      setAccountSource("localStorage");
    } else {
      setAccountSource("none");
    }
  }

  function applySupabaseFallback(session: Session) {
    const localAccount = readLocalDemoAccount();
    const localPlan = readLocalPlan();

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
      role: "Privat",
      plan: localPlan,
      updatedAt: new Date().toISOString(),
      supabaseUserId: session.user.id,
    });
    setUserPlan(localPlan);
    setAccountSource("localStorage");
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

      const profile = await loadWorkshopProfileFromSupabase(
        supabase,
        session.user
      );

      if (!profile) {
        applySupabaseFallback(session);
        return;
      }

      const nextAccount = convertProfileToDemoAccount(profile);

      setDemoAccount(nextAccount);
      setUserPlan(nextAccount.plan);
      setAccountSource("supabase");
      syncWorkshopProfileToLocalStorage(profile);
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
      clearLocalWorkshopProfileState();
      applyLoggedOutState();
      closeMobileMenu();

      window.location.href = "/login";
    } catch (error) {
      console.error("Logout fehlgeschlagen:", error);
      clearLocalWorkshopProfileState();
      applyLoggedOutState();
      closeMobileMenu();

      window.location.href = "/login";
    } finally {
      setLogoutLoading(false);
    }
  }

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadAccountState();
    }, 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, nextSession: Session | null) => {
        await loadAccountState(nextSession);
      }
    );

    function handleAccountChange() {
      void loadAccountState();
    }

    window.addEventListener("storage", handleAccountChange);
    window.addEventListener("focus", handleAccountChange);
    window.addEventListener("diagnosehub-account-updated", handleAccountChange);

    return () => {
      window.clearTimeout(initialLoadId);
      subscription.unsubscribe();
      window.removeEventListener("storage", handleAccountChange);
      window.removeEventListener("focus", handleAccountChange);
      window.removeEventListener(
        "diagnosehub-account-updated",
        handleAccountChange
      );
    };
  }, [supabase]);

  const accountLabel = demoAccount?.workshop || "Kein Account";
  const planLabel = PLAN_CONFIG[userPlan].label;
  const sourceLabel = accountSourceLabels[accountSource];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 text-slate-950 backdrop-blur-xl transition-colors dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-200 bg-white p-2 shadow-lg shadow-blue-100 transition-colors dark:border-blue-500/20 dark:bg-slate-900 dark:shadow-blue-950/30">
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
              <p className="text-lg font-bold leading-tight text-slate-950 transition-colors dark:text-white">
                DiagnoseHUB
              </p>
              <p className="text-xs text-slate-600 transition-colors dark:text-slate-400">
                KI-Diagnose für private Nutzer
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-700 transition-colors dark:text-slate-300 lg:flex">
            {navigationLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition hover:text-blue-700 dark:hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />

            <a
              href="/login"
              className={
                demoAccount
                  ? "rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-600 hover:text-white dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500 dark:hover:text-white"
                  : "rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              }
            >
              {demoAccount ? (
                <span className="flex items-center gap-2">
                  <span className="max-w-40 truncate">
                    {accountLoading ? "Lädt..." : accountLabel}
                  </span>

                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                    {planLabel}
                  </span>

                  <span
                    className={
                      accountSource === "supabase"
                        ? "rounded-full border border-green-400 bg-green-50 px-2 py-0.5 text-xs text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
                        : "rounded-full border border-yellow-400 bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300"
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
                className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500 dark:hover:text-white"
              >
                {logoutLoading ? "Logout..." : "Logout"}
              </button>
            )}

            <a
              href="/preise"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-500 dark:shadow-blue-950/40"
            >
              Pro
            </a>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />

            <button
              type="button"
              onClick={() => setMobileMenuOpen((currentValue) => !currentValue)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
          <div className="border-t border-slate-200 py-5 transition-colors dark:border-slate-800 md:hidden">
            <nav className="grid gap-3">
              {demoAccount && (
                <a
                  href="/login"
                  onClick={closeMobileMenu}
                  className="rounded-2xl border border-blue-300 bg-blue-50 px-5 py-4 transition-colors dark:border-blue-500/40 dark:bg-blue-500/10"
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    Aktiver Account
                  </p>

                  <p className="mt-2 font-bold text-slate-950 dark:text-white">
                    {accountLoading ? "Lädt..." : accountLabel}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                      {planLabel}
                    </span>

                    <span
                      className={
                        accountSource === "supabase"
                          ? "rounded-full border border-green-400 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
                          : "rounded-full border border-yellow-400 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300"
                      }
                    >
                      {sourceLabel}
                    </span>
                  </div>

                  {demoAccount.email && (
                    <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-400">
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
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
                >
                  {link.label}
                </a>
              ))}

              <a
                href="/preise"
                onClick={closeMobileMenu}
                className="rounded-2xl bg-blue-600 px-5 py-4 text-center font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-500 dark:shadow-blue-950/40"
              >
                Pro aktivieren
              </a>

              <a
                href="/login"
                onClick={closeMobileMenu}
                className="rounded-2xl border border-slate-300 px-5 py-4 text-left font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                {demoAccount ? "Account verwalten" : "Login"}
              </a>

              {demoAccount && (
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-left font-semibold text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500 dark:hover:text-white"
                >
                  {logoutLoading ? "Logout..." : "Logout"}
                </button>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
