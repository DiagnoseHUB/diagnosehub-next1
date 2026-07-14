"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import DeviceAccessGuard from "@/components/DeviceAccessGuard";
import ThemeToggle from "@/components/ThemeToggle";
import { PLAN_CONFIG, normalizeUserPlan, type UserPlan } from "@/config/plans";
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

type HeaderLink = {
  label: string;
  href: string;
};

const primaryNavigationLinks: HeaderLink[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Lernen", href: "/lernen" },
  { label: "Teilemarkt", href: "/teilemarkt" },
  { label: "Forum", href: "/forum" },
  { label: "Preise", href: "/preise" },
];

const toolNavigationLinks: HeaderLink[] = [
  { label: "Drehmomente", href: "/drehmomente" },
  { label: "Signale", href: "/signale" },
  { label: "Service", href: "/service-erinnerung" },
];

const mobileNavigationGroups = [
  { title: "Hauptbereiche", links: primaryNavigationLinks },
  { title: "Werkzeuge", links: toolNavigationLinks },
];

const audienceLinks = [
  { label: "Azubis", href: "/azubis" },
  { label: "Schulen", href: "/schulen" },
  { label: "Werkstätten", href: "/werkstaetten" },
];

function DesktopNavDropdown({
  label,
  links,
}: {
  label: string;
  links: HeaderLink[];
}) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-xl px-3 py-2 transition hover:bg-white hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-white [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <span
          aria-hidden="true"
          className="text-xs leading-none transition group-open:rotate-180"
        >
          ▾
        </span>
      </summary>

      <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:shadow-slate-950/50">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={(event) => {
              const menu = event.currentTarget.closest("details");
              if (menu) {
                menu.removeAttribute("open");
              }
            }}
            className="block rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

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

  const [demoAccount, setDemoAccount] = useState<DemoAccount | null>(null);
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [accountLoading, setAccountLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  function closeMobileMenu() {
    const mobileMenu = document.querySelector<HTMLDetailsElement>(
      "[data-mobile-menu]"
    );

    if (mobileMenu) {
      mobileMenu.open = false;
    }
  }

  function applyLoggedOutState() {
    setDemoAccount(null);
    setUserPlan("free");
  }

  function applyLocalFallback() {
    const localAccount = readLocalDemoAccount();
    const localPlan = readLocalPlan();

    setDemoAccount(localAccount);
    setUserPlan(normalizeUserPlan(localAccount?.plan || localPlan));
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
      setUserPlan(normalizeUserPlan(localAccount.plan || localPlan));
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
    setUserPlan(normalizeUserPlan(localPlan));
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
            "Anmeldung"
          );

      const session = existingSession ?? sessionResult?.data.session ?? null;

      if (!session?.user) {
        applyLoggedOutState();
        return;
      }

      const profile = await withTimeout(
        loadWorkshopProfileFromSupabase(supabase, session.user),
        4500,
        "Profil"
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
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        window.setTimeout(() => {
          void loadAccountState(nextSession);
        }, 0);
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
  const planLabel = PLAN_CONFIG[normalizeUserPlan(userPlan)].label;

  return (
    <>
      <DeviceAccessGuard />
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 text-slate-950 backdrop-blur-xl transition-colors dark:border-slate-800/90 dark:bg-slate-950/95 dark:text-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex min-h-16 items-center justify-between gap-3">
            <Link
              href="/"
              aria-label="DiagnoseHUB Startseite"
              className="group flex min-w-0 items-center"
            >
              <div className="leading-none">
                <p className="text-[1.35rem] font-black uppercase text-slate-950 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300 sm:text-[1.6rem]">
                  Diagnose
                  <span className="text-blue-600 transition-colors dark:text-blue-400">
                    HUB
                  </span>
                </p>
                <p className="mt-1 hidden text-[0.63rem] font-black uppercase text-slate-500 transition-colors dark:text-slate-400 lg:block">
                  KI-gestützte Fahrzeugdiagnose
                </p>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 text-sm font-bold text-slate-700 transition-colors dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 xl:flex">
              {primaryNavigationLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-3 py-2 transition hover:bg-white hover:text-blue-700 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
              <DesktopNavDropdown label="Werkzeuge" links={toolNavigationLinks} />
            </nav>

            <div className="hidden items-center gap-2 md:flex">
              <ThemeToggle />

              <Link
                href="/login"
                className={
                  demoAccount
                    ? "rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 transition hover:border-blue-500 hover:bg-blue-600 hover:text-white dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500 dark:hover:text-white"
                    : "rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500 dark:hover:text-white"
                >
                  {logoutLoading ? "..." : "Abmelden"}
                </button>
              )}

              <Link
                href="/#diagnose"
                className="rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                Diagnose
              </Link>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />

              <details data-mobile-menu className="group">
                <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white [&::-webkit-details-marker]:hidden">
                  <span className="sr-only">Menü</span>
                  <span className="flex flex-col gap-1.5 group-open:hidden">
                    <span className="block h-0.5 w-5 rounded-full bg-current" />
                    <span className="block h-0.5 w-5 rounded-full bg-current" />
                    <span className="block h-0.5 w-5 rounded-full bg-current" />
                  </span>
                  <span className="hidden text-2xl leading-none group-open:block">
                    ×
                  </span>
                </summary>

                <div className="absolute left-0 right-0 top-full border-t border-slate-200 bg-white/95 shadow-xl shadow-slate-200/70 transition-colors dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-slate-950/50">
                  <nav className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:px-6">
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

                    <Link
                      href="/#diagnose"
                      onClick={closeMobileMenu}
                      className="rounded-2xl bg-blue-600 px-5 py-3.5 text-center font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-500 dark:shadow-blue-950/40"
                    >
                      Diagnose starten
                    </Link>

                    {mobileNavigationGroups.map((group) => (
                      <div
                        key={group.title}
                        className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950"
                      >
                        <p className="px-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {group.title}
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          {group.links.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              onClick={closeMobileMenu}
                              className="rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:text-blue-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-blue-300"
                            >
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}

                    {!demoAccount && (
                      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-950">
                        <p className="px-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Für wen?
                        </p>
                        {audienceLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={closeMobileMenu}
                            className="rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:text-blue-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-blue-300"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    )}

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
                        className="rounded-2xl border border-red-300 bg-red-50 px-5 py-3.5 text-left font-semibold text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500 dark:hover:text-white"
                      >
                        {logoutLoading ? "..." : "Abmelden"}
                      </button>
                    )}
                  </nav>
                </div>
              </details>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export default Header;
