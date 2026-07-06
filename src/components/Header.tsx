"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import DeviceAccessGuard from "@/components/DeviceAccessGuard";
import ThemeToggle from "@/components/ThemeToggle";
import { PLAN_CONFIG, type UserPlan } from "@/config/plans";
import { createClient } from "@/lib/supabase/client";
import {
  clearLocalWorkshopProfileState,
  convertProfileToDemoAccount,
  loadWorkshopProfileFromSupabase,
  readLocalDemoAccount,
  readLocalPlan,
  syncWorkshopProfileToLocalStorage,
  type DemoAccount,
} from "@/services/workshopProfileSupabase";

const navigationLinks = [
  { label: "Diagnose", href: "/#diagnose" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Lernen", href: "/lernen" },
  { label: "Service", href: "/service-erinnerung" },
  { label: "Preise", href: "/preise" },
];

const audienceLinks = [
  { label: "Azubis", href: "/azubis" },
  { label: "Schulen", href: "/schulen" },
  { label: "Werkstätten", href: "/werkstaetten" },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unbekannter Fehler";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeoutId: number | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} dauerte zu lange.`));
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }),
    timeoutPromise,
  ]);
}

function Header() {
  const supabase = useMemo(() => createClient(), []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoAccount, setDemoAccount] = useState<DemoAccount | null>(null);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [accountLoading, setAccountLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function applyLoggedOutState() {
    setDemoAccount(null);
    setUserPlan("free");
  }

  function applyLocalFallback() {
    const localAccount = readLocalDemoAccount();
    const localPlan = readLocalPlan();

    setDemoAccount(localAccount);
    setUserPlan(localAccount?.plan || localPlan);
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
      return;
    }

    setDemoAccount({
      name: "Profil ergänzen",
      workshop: "Nicht angegeben",
      email: session.user.email || "nicht hinterlegt",
      role: "Privatnutzer",
      plan: localPlan,
      updatedAt: new Date().toISOString(),
      supabaseUserId: session.user.id,
    });
    setUserPlan(localPlan);
  }

  async function loadAccountState(existingSession?: Session | null) {
    setAccountLoading(true);

    try {
      applyLocalFallback();

      const sessionResult = existingSession
        ? null
        : await withTimeout(
            supabase.auth.getSession(),
            3500,
            "Supabase-Session"
          );

      const session = existingSession ?? sessionResult?.data.session ?? null;

      if (!session?.user) {
        applyLoggedOutState();
        return;
      }

      const profile = await withTimeout(
        loadWorkshopProfileFromSupabase(supabase, session.user),
        4500,
        "Supabase-Profil"
      );

      if (!profile) {
        applySupabaseFallback(session);
        return;
      }

      const nextAccount = convertProfileToDemoAccount(profile);

      setDemoAccount(nextAccount);
      setUserPlan(nextAccount.plan);
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
    window.addEventListener("diagnosehub-account-updated", handleAccountChange);

    return () => {
      window.clearTimeout(initialLoadId);
      subscription.unsubscribe();
      window.removeEventListener("storage", handleAccountChange);
      window.removeEventListener(
        "diagnosehub-account-updated",
        handleAccountChange
      );
    };
  }, [supabase]);

  const accountLabel =
    demoAccount?.workshop && demoAccount.workshop !== "Nicht angegeben"
      ? demoAccount.workshop
      : demoAccount?.name || "Account";
  const planLabel = PLAN_CONFIG[userPlan].label;

  return (
    <>
      <DeviceAccessGuard />
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 text-slate-950 backdrop-blur-xl transition-colors dark:border-slate-800/90 dark:bg-slate-950/95 dark:text-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex min-h-20 items-center justify-between gap-4">
            <Link href="/" className="group flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:group-hover:border-blue-500/70">
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
                <p className="text-lg font-black leading-tight tracking-tight text-slate-950 transition-colors dark:text-white">
                  DiagnoseHUB
                </p>
                <p className="text-xs font-semibold text-slate-600 transition-colors dark:text-slate-400">
                  Diagnose, Lernen und Service
                </p>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 text-sm font-bold text-slate-700 transition-colors dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 xl:flex">
              {navigationLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-3 py-2 transition hover:bg-white hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-2 md:flex">
              <ThemeToggle />

              <Link
                href="/login"
                className={
                  demoAccount
                    ? "rounded-2xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-sm font-bold text-blue-800 transition hover:border-blue-500 hover:bg-blue-600 hover:text-white dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500 dark:hover:text-white"
                    : "rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
                  </span>
                ) : accountLoading ? (
                  "Lädt..."
                ) : (
                  "Login / Registrieren"
                )}
              </Link>

              {demoAccount && (
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500 dark:hover:text-white"
                >
                  {logoutLoading ? "Logout..." : "Logout"}
                </button>
              )}

              <Link
                href="/#diagnose"
                className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                Diagnose starten
              </Link>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />

              <button
                type="button"
                onClick={() =>
                  setMobileMenuOpen((currentValue) => !currentValue)
                }
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label={
                  mobileMenuOpen ? "Menü schließen" : "Menü öffnen"
                }
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
                  <Link
                    href="/login"
                    onClick={closeMobileMenu}
                    className="rounded-2xl border border-blue-300 bg-blue-50 px-5 py-4 transition-colors dark:border-blue-500/40 dark:bg-blue-500/10"
                  >
                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                      Account
                    </p>

                    <p className="mt-2 font-bold text-slate-950 dark:text-white">
                      {accountLoading ? "Lädt..." : accountLabel}
                    </p>

                    <span className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                      {planLabel}
                    </span>

                    {demoAccount.email && (
                      <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-400">
                        {demoAccount.email}
                      </p>
                    )}
                  </Link>
                )}

                {navigationLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMobileMenu}
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
                  >
                    {link.label}
                  </Link>
                ))}

                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <p className="px-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Für wen?
                  </p>
                  {audienceLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobileMenu}
                      className="rounded-xl bg-white px-4 py-3 font-semibold text-slate-700 transition hover:text-blue-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-blue-300"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>

                <Link
                  href="/#diagnose"
                  onClick={closeMobileMenu}
                  className="rounded-2xl bg-blue-600 px-5 py-4 text-center font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-500 dark:shadow-blue-950/40"
                >
                  Diagnose starten
                </Link>

                <Link
                  href="/login"
                  onClick={closeMobileMenu}
                  className="rounded-2xl border border-slate-300 px-5 py-4 text-left font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {demoAccount ? "Account verwalten" : "Login / Registrieren"}
                </Link>

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
    </>
  );
}

export default Header;
