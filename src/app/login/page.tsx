"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";

type UserPlan = "free" | "werkstatt" | "pro";

type DemoAccount = {
  name: string;
  workshop: string;
  email: string;
  role: string;
  plan: UserPlan;
  updatedAt: string;
  supabaseUserId?: string;
};

const DEMO_ACCOUNT_STORAGE_KEY = "diagnosehub-demo-account";
const USER_PLAN_STORAGE_KEY = "diagnosehub-user-plan";

const planOptions: Record<
  UserPlan,
  {
    label: string;
    badge: string;
    description: string;
    features: string[];
  }
> = {
  free: {
    label: "Free",
    badge: "Kostenlos",
    description: "Für Tests und einzelne Diagnosefälle.",
    features: [
      "3 KI-Diagnosen pro Tag",
      "3 lokal gespeicherte Fälle",
      "Standard-Prüfprotokoll",
      "Basis-Fallbericht als TXT",
    ],
  },
  werkstatt: {
    label: "Werkstatt Demo",
    badge: "Premium Demo",
    description: "Vorbereitung für den späteren Werkstatt-Zugang.",
    features: [
      "50 KI-Diagnosen pro Tag",
      "25 lokal gespeicherte Fälle",
      "Individuelle Prüfprotokolle",
      "Erweiterte Fehlercode-Logik",
    ],
  },
  pro: {
    label: "Werkstatt Pro Demo",
    badge: "Pro Demo",
    description: "Vorbereitung für größere Betriebe.",
    features: [
      "150 KI-Diagnosen pro Tag",
      "100 lokal gespeicherte Fälle",
      "Pro-Funktionen vorbereitet",
      "Mehrnutzer-Logik später möglich",
    ],
  },
};

function isValidUserPlan(value: string | null): value is UserPlan {
  return value === "free" || value === "werkstatt" || value === "pro";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [name, setName] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [role, setRole] = useState("Inhaber / Werkstatt");
  const [plan, setPlan] = useState<UserPlan>("free");
  const [savedAccount, setSavedAccount] = useState<DemoAccount | null>(null);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const currentPlan = planOptions[plan];

  const accountStatus = useMemo(() => {
    if (!user) {
      return "Nicht eingeloggt";
    }

    if (!savedAccount) {
      return "Eingeloggt, aber Werkstattdaten fehlen";
    }

    return `${savedAccount.workshop} · ${planOptions[savedAccount.plan].label}`;
  }, [savedAccount, user]);

  useEffect(() => {
    loadLocalAccount();

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setAuthError(error.message);
        return;
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);

      if (data.session?.user?.email) {
        setAuthEmail(data.session.user.email);
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user?.email) {
        setAuthEmail(nextSession.user.email);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  function loadLocalAccount() {
    try {
      const savedPlan = localStorage.getItem(USER_PLAN_STORAGE_KEY);
      const savedAccountData = localStorage.getItem(DEMO_ACCOUNT_STORAGE_KEY);

      if (isValidUserPlan(savedPlan)) {
        setPlan(savedPlan);
      }

      if (savedAccountData) {
        const parsedAccount = JSON.parse(savedAccountData) as DemoAccount;

        setSavedAccount(parsedAccount);
        setName(parsedAccount.name || "");
        setWorkshop(parsedAccount.workshop || "");
        setRole(parsedAccount.role || "Inhaber / Werkstatt");

        if (isValidUserPlan(parsedAccount.plan)) {
          setPlan(parsedAccount.plan);
          localStorage.setItem(USER_PLAN_STORAGE_KEY, parsedAccount.plan);
        }
      }
    } catch (error) {
      console.error("Lokaler Account konnte nicht geladen werden:", error);
    }
  }

  function showSuccess(message: string) {
    setSuccess(message);

    window.setTimeout(() => {
      setSuccess("");
    }, 3000);
  }

  function resetAuthMessages() {
    setAuthError("");
    setAuthMessage("");
    setError("");
    setSuccess("");
  }

  async function handleRegister() {
    resetAuthMessages();

    const cleanEmail = authEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setAuthError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }

    if (authPassword.length < 6) {
      setAuthError("Das Passwort muss mindestens 6 Zeichen haben.");
      return;
    }

    setAuthLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: authPassword,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        setAuthMessage("Registrierung erfolgreich. Du bist eingeloggt.");
        return;
      }

      setAuthMessage(
        "Registrierung erstellt. Prüfe deine E-Mails und bestätige den Account, falls Supabase eine Bestätigung verlangt."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin() {
    resetAuthMessages();

    const cleanEmail = authEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setAuthError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }

    if (!authPassword) {
      setAuthError("Bitte gib dein Passwort ein.");
      return;
    }

    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: authPassword,
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      setSession(data.session);
      setUser(data.user);
      setAuthMessage("Login erfolgreich.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    resetAuthMessages();
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setAuthError(error.message);
        return;
      }

      setSession(null);
      setUser(null);
      setAuthPassword("");
      setAuthMessage("Du wurdest ausgeloggt.");
    } finally {
      setAuthLoading(false);
    }
  }

  function saveAccount() {
    setError("");
    setSuccess("");

    if (!user) {
      setError("Bitte zuerst mit Supabase einloggen.");
      return;
    }

    const cleanName = name.trim();
    const cleanWorkshop = workshop.trim();
    const cleanRole = role.trim();
    const authUserEmail = user.email || authEmail.trim().toLowerCase();

    if (!cleanName) {
      setError("Bitte gib einen Namen ein.");
      return;
    }

    if (!cleanWorkshop) {
      setError("Bitte gib den Werkstattnamen ein.");
      return;
    }

    if (!authUserEmail || !authUserEmail.includes("@")) {
      setError("Keine gültige Supabase-E-Mail gefunden.");
      return;
    }

    const nextAccount: DemoAccount = {
      name: cleanName,
      workshop: cleanWorkshop,
      email: authUserEmail,
      role: cleanRole || "Werkstatt",
      plan,
      updatedAt: new Date().toISOString(),
      supabaseUserId: user.id,
    };

    setSavedAccount(nextAccount);
    localStorage.setItem(DEMO_ACCOUNT_STORAGE_KEY, JSON.stringify(nextAccount));
    localStorage.setItem(USER_PLAN_STORAGE_KEY, plan);

    showSuccess(
      "Werkstattdaten wurden lokal gespeichert und mit dem Supabase-Login verknüpft."
    );
  }

  function clearLocalAccount() {
    setName("");
    setWorkshop("");
    setRole("Inhaber / Werkstatt");
    setPlan("free");
    setSavedAccount(null);
    setError("");
    setSuccess("");

    localStorage.removeItem(DEMO_ACCOUNT_STORAGE_KEY);
    localStorage.setItem(USER_PLAN_STORAGE_KEY, "free");

    showSuccess("Lokale Werkstattdaten wurden gelöscht.");
  }

  function changePlan(nextPlan: UserPlan) {
    setPlan(nextPlan);
    localStorage.setItem(USER_PLAN_STORAGE_KEY, nextPlan);

    if (savedAccount) {
      const updatedAccount: DemoAccount = {
        ...savedAccount,
        plan: nextPlan,
        updatedAt: new Date().toISOString(),
      };

      setSavedAccount(updatedAccount);
      localStorage.setItem(
        DEMO_ACCOUNT_STORAGE_KEY,
        JSON.stringify(updatedAccount)
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-14">
        <section className="grid gap-10 lg:grid-cols-[0.9fr_1fr] lg:items-start">
          <div>
            <div className="inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-5 py-2 text-sm font-semibold text-green-300">
              Echter Supabase Login
            </div>

            <h1 className="mt-6 text-5xl font-black tracking-tight md:text-6xl">
              DiagnoseHUB Account.
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-400">
              Diese Seite nutzt jetzt Supabase Auth für echten Login und echte
              Sessions. Werkstattdaten und Plan bleiben in diesem Schritt noch
              lokal gespeichert. Als Nächstes verschieben wir diese Daten in die
              Supabase-Datenbank.
            </p>

            <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                Login-Status
              </p>

              <h2 className="mt-3 text-2xl font-bold">{accountStatus}</h2>

              {user ? (
                <div className="mt-5 space-y-3 text-slate-400">
                  <p>
                    Supabase E-Mail:{" "}
                    <span className="font-semibold text-white">
                      {user.email}
                    </span>
                  </p>

                  <p>
                    User-ID:{" "}
                    <span className="break-all font-mono text-sm text-slate-300">
                      {user.id}
                    </span>
                  </p>

                  {savedAccount && (
                    <>
                      <p>
                        Werkstatt:{" "}
                        <span className="font-semibold text-white">
                          {savedAccount.workshop}
                        </span>
                      </p>
                      <p>
                        Bearbeiter:{" "}
                        <span className="font-semibold text-white">
                          {savedAccount.name}
                        </span>
                      </p>
                      <p>
                        Plan:{" "}
                        <span className="font-semibold text-white">
                          {planOptions[savedAccount.plan].label}
                        </span>
                      </p>
                      <p>
                        Aktualisiert:{" "}
                        <span className="font-semibold text-white">
                          {formatDateTime(savedAccount.updatedAt)}
                        </span>
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-4 leading-7 text-slate-400">
                  Noch nicht eingeloggt. Registriere dich oder melde dich mit
                  einem bestehenden Supabase-Account an.
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="/dashboard"
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
                >
                  Zum Dashboard
                </a>

                <a
                  href="/#diagnose"
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  Zur Diagnose
                </a>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-6">
              <p className="font-bold text-yellow-300">Wichtig</p>

              <p className="mt-3 leading-7 text-slate-300">
                Wenn Supabase E-Mail-Bestätigung aktiviert hat, musst du nach
                der Registrierung erst den Link in der E-Mail bestätigen. Danach
                kannst du dich normal einloggen.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-blue-950/30">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                Supabase Auth
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                {user ? "Eingeloggt" : "Login / Registrierung"}
              </h2>

              {!user && (
                <>
                  <div className="mt-6 flex rounded-2xl border border-slate-800 bg-slate-950 p-1">
                    <button
                      onClick={() => {
                        setAuthMode("login");
                        resetAuthMessages();
                      }}
                      className={
                        authMode === "login"
                          ? "flex-1 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"
                          : "flex-1 rounded-xl px-4 py-3 font-bold text-slate-400 transition hover:text-white"
                      }
                    >
                      Einloggen
                    </button>

                    <button
                      onClick={() => {
                        setAuthMode("register");
                        resetAuthMessages();
                      }}
                      className={
                        authMode === "register"
                          ? "flex-1 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"
                          : "flex-1 rounded-xl px-4 py-3 font-bold text-slate-400 transition hover:text-white"
                      }
                    >
                      Registrieren
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">
                        E-Mail
                      </label>
                      <input
                        value={authEmail}
                        onChange={(event) => setAuthEmail(event.target.value)}
                        placeholder="mail@werkstatt.de"
                        autoComplete="email"
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-300">
                        Passwort
                      </label>
                      <input
                        value={authPassword}
                        onChange={(event) =>
                          setAuthPassword(event.target.value)
                        }
                        type="password"
                        placeholder="Mindestens 6 Zeichen"
                        autoComplete={
                          authMode === "login"
                            ? "current-password"
                            : "new-password"
                        }
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={authMode === "login" ? handleLogin : handleRegister}
                    disabled={authLoading}
                    className="mt-6 w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {authLoading
                      ? "Bitte warten..."
                      : authMode === "login"
                        ? "Einloggen"
                        : "Account erstellen"}
                  </button>
                </>
              )}

              {user && (
                <div className="mt-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
                  <p className="font-bold text-green-300">
                    Supabase-Session aktiv
                  </p>

                  <p className="mt-2 leading-7 text-slate-300">
                    Du bist mit {user.email} eingeloggt.
                  </p>

                  <button
                    onClick={handleLogout}
                    disabled={authLoading}
                    className="mt-5 rounded-xl border border-red-500/30 px-5 py-3 font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Ausloggen
                  </button>
                </div>
              )}

              {authMessage && (
                <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4 text-green-300">
                  {authMessage}
                </div>
              )}

              {authError && (
                <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-300">
                  {authError}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-blue-950/30">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                Werkstattprofil
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Werkstattdaten speichern
              </h2>

              <p className="mt-3 leading-7 text-slate-400">
                Noch lokal gespeichert. Die Daten sind aber jetzt bereits mit der
                Supabase-User-ID verknüpft.
              </p>

              <div className="mt-8 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">
                    Name
                  </label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Max Mustermann"
                    disabled={!user}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">
                    Werkstatt
                  </label>
                  <input
                    value={workshop}
                    onChange={(event) => setWorkshop(event.target.value)}
                    placeholder="KFZ Musterbetrieb"
                    disabled={!user}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">
                    Login-E-Mail
                  </label>
                  <input
                    value={user?.email || authEmail}
                    disabled
                    className="w-full cursor-not-allowed rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-slate-400 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-300">
                    Rolle
                  </label>
                  <input
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    placeholder="Inhaber / Meister / Mechaniker"
                    disabled={!user}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="mt-8">
                <p className="mb-4 font-bold text-white">Plan auswählen</p>

                <div className="grid gap-4">
                  {(["free", "werkstatt", "pro"] as UserPlan[]).map(
                    (planKey) => (
                      <button
                        key={planKey}
                        onClick={() => changePlan(planKey)}
                        disabled={!user}
                        className={
                          plan === planKey
                            ? "rounded-2xl border border-blue-500 bg-blue-500/10 p-5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                            : "rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-left transition hover:border-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                        }
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <span
                              className={
                                plan === planKey
                                  ? "inline-flex rounded-full border border-blue-400/40 bg-blue-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-200"
                                  : "inline-flex rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-400"
                              }
                            >
                              {planOptions[planKey].badge}
                            </span>

                            <h3 className="mt-3 text-xl font-bold text-white">
                              {planOptions[planKey].label}
                            </h3>

                            <p className="mt-2 leading-7 text-slate-400">
                              {planOptions[planKey].description}
                            </p>
                          </div>

                          {plan === planKey && (
                            <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                              Aktiv
                            </span>
                          )}
                        </div>

                        <ul className="mt-4 grid gap-2 md:grid-cols-2">
                          {planOptions[planKey].features.map((feature) => (
                            <li
                              key={feature}
                              className="flex gap-3 text-sm text-slate-300"
                            >
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={saveAccount}
                  disabled={!user}
                  className="rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Werkstattprofil speichern
                </button>

                <button
                  onClick={clearLocalAccount}
                  className="rounded-2xl border border-red-500/30 px-6 py-4 font-bold text-red-300 transition hover:bg-red-500/10"
                >
                  Lokale Daten löschen
                </button>
              </div>

              {success && (
                <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4 text-green-300">
                  {success}
                </div>
              )}

              {error && (
                <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-300">
                  {error}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}