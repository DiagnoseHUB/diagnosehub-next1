"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  AuthChangeEvent,
  Session,
  User,
} from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import {
  PLAN_CONFIG,
  type UserPlan,
} from "@/config/plans";
import {
  clearLocalWorkshopProfileState,
  convertProfileToDemoAccount,
  deleteWorkshopProfileFromSupabase,
  loadWorkshopProfileFromSupabase,
  notifyWorkshopProfileChanged,
  readLocalDemoAccount,
  saveWorkshopProfileToSupabase,
  syncWorkshopProfileToLocalStorage,
  type DemoAccount,
  type WorkshopProfileDatabaseRow,
} from "@/services/workshopProfileSupabase";

const DEFAULT_ROLE = "Inhaber / Werkstatt";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unbekannter Fehler";
}

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register" | "reset">(
    "login"
  );
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [name, setName] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [role, setRole] = useState(DEFAULT_ROLE);
  const [plan, setPlan] = useState<UserPlan>("free");
  const [savedAccount, setSavedAccount] = useState<DemoAccount | null>(null);
  const [databaseProfile, setDatabaseProfile] =
    useState<WorkshopProfileDatabaseRow | null>(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const accountStatus = useMemo(() => {
    if (!user) {
      return "Nicht eingeloggt";
    }

    if (!databaseProfile && !savedAccount) {
      return "Eingeloggt, aber Werkstattprofil fehlt";
    }

    if (!savedAccount) {
      return "Werkstattprofil vorhanden";
    }

    return `${savedAccount.workshop} · ${PLAN_CONFIG[savedAccount.plan].label}`;
  }, [databaseProfile, savedAccount, user]);

  useEffect(() => {
    loadLocalAccount();

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setAuthError(error.message);
        return;
      }

      setUser(data.session?.user ?? null);

      if (data.session?.user?.email) {
        setAuthEmail(data.session.user.email);
      }

      if (data.session?.user) {
        await loadWorkshopProfile(data.session.user);
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, nextSession: Session | null) => {
        setUser(nextSession?.user ?? null);

        if (nextSession?.user?.email) {
          setAuthEmail(nextSession.user.email);
        }

        if (nextSession?.user) {
          await loadWorkshopProfile(nextSession.user);
        } else {
          setDatabaseProfile(null);
          setSavedAccount(null);
          setName("");
          setWorkshop("");
          setRole(DEFAULT_ROLE);
          setPlan("free");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  function loadLocalAccount() {
    const localAccount = readLocalDemoAccount();

    if (!localAccount) {
      return;
    }

    setSavedAccount(localAccount);
    setName(localAccount.name || "");
    setWorkshop(localAccount.workshop || "");
    setRole(localAccount.role || DEFAULT_ROLE);
    setPlan(localAccount.plan || "free");
  }

  function applyProfileToState(
    profile: WorkshopProfileDatabaseRow,
    currentUser: User
  ) {
    const localAccount = convertProfileToDemoAccount(profile);

    setSavedAccount(localAccount);
    setName(localAccount.name);
    setWorkshop(localAccount.workshop);
    setRole(localAccount.role);
    setPlan(localAccount.plan);
    setDatabaseProfile(profile);

    syncWorkshopProfileToLocalStorage(profile);
    notifyWorkshopProfileChanged();

    if (currentUser.email) {
      setAuthEmail(currentUser.email);
    }
  }

  async function loadWorkshopProfile(currentUser: User) {
    setProfileLoading(true);
    setError("");

    try {
      const profile = await loadWorkshopProfileFromSupabase(
        supabase,
        currentUser
      );

      if (!profile) {
        setDatabaseProfile(null);
        setSavedAccount(null);
        return;
      }

      applyProfileToState(profile, currentUser);
    } catch (error) {
      setError(
        `Werkstattprofil konnte nicht geladen werden: ${getErrorMessage(error)}`
      );
    } finally {
      setProfileLoading(false);
    }
  }

  function showSuccess(message: string) {
    setSuccess(message);

    window.setTimeout(() => {
      setSuccess("");
    }, 3000);
  }

  function resetMessages() {
    setAuthError("");
    setAuthMessage("");
    setError("");
    setSuccess("");
  }

  async function handleRegister() {
    resetMessages();

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
        setUser(data.user);
        setAuthPassword("");
        setAuthMessage("Registrierung erfolgreich. Du bist eingeloggt.");

        if (data.user) {
          await loadWorkshopProfile(data.user);
        }

        return;
      }

      setAuthMessage(
        "Registrierung erstellt. Prüfe deine E-Mails und bestätige den Account, falls Supabase eine Bestätigung verlangt."
      );
    } catch (error) {
      setAuthError(`Registrierung fehlgeschlagen: ${getErrorMessage(error)}`);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin() {
    resetMessages();

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

      setUser(data.user);
      setAuthPassword("");
      setAuthMessage("Login erfolgreich.");

      if (data.user) {
        await loadWorkshopProfile(data.user);
      }
    } catch (error) {
      setAuthError(`Login fehlgeschlagen: ${getErrorMessage(error)}`);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePasswordResetRequest() {
    resetMessages();

    const cleanEmail = authEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setAuthError("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }

    setAuthLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/passwort-zuruecksetzen`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      setAuthMessage(
        "Wenn zu dieser E-Mail ein Account existiert, wurde ein Link zum Zurücksetzen gesendet."
      );
    } catch (error) {
      setAuthError(
        `Passwort-Link konnte nicht gesendet werden: ${getErrorMessage(error)}`
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    resetMessages();
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setAuthError(error.message);
        return;
      }

      setUser(null);
      setDatabaseProfile(null);
      setSavedAccount(null);
      setName("");
      setWorkshop("");
      setRole(DEFAULT_ROLE);
      setPlan("free");
      setAuthPassword("");
      clearLocalWorkshopProfileState();
      notifyWorkshopProfileChanged();
      setAuthMessage("Du wurdest ausgeloggt.");
    } catch (error) {
      setAuthError(`Logout fehlgeschlagen: ${getErrorMessage(error)}`);
    } finally {
      setAuthLoading(false);
    }
  }

  async function saveAccount() {
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

    setProfileLoading(true);

    try {
      const profile = await saveWorkshopProfileToSupabase(supabase, user, {
        fullName: cleanName,
        workshopName: cleanWorkshop,
        email: authUserEmail,
        role: cleanRole || "Werkstatt",
      });

      applyProfileToState(profile, user);

      showSuccess(
        "Werkstattprofil wurde in Supabase gespeichert. Header, Dashboard und Diagnose nutzen diesen Plan."
      );
    } catch (error) {
      setError(
        `Werkstattprofil konnte nicht gespeichert werden: ${getErrorMessage(error)}`
      );
    } finally {
      setProfileLoading(false);
    }
  }

  async function deleteDatabaseProfile() {
    setError("");
    setSuccess("");

    if (!user) {
      setError("Bitte zuerst einloggen.");
      return;
    }

    const confirmed = window.confirm(
      "Werkstattprofil wirklich aus Supabase löschen? Der Login-Account bleibt bestehen."
    );

    if (!confirmed) {
      return;
    }

    setProfileLoading(true);

    try {
      await deleteWorkshopProfileFromSupabase(supabase, user);

      setDatabaseProfile(null);
      setSavedAccount(null);
      setName("");
      setWorkshop("");
      setRole(DEFAULT_ROLE);
      setPlan("free");

      clearLocalWorkshopProfileState();
      notifyWorkshopProfileChanged();

      showSuccess("Werkstattprofil wurde aus Supabase gelöscht.");
    } catch (error) {
      setError(
        `Werkstattprofil konnte nicht gelöscht werden: ${getErrorMessage(error)}`
      );
    } finally {
      setProfileLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-14">
        <section className="grid gap-10 lg:grid-cols-[0.9fr_1fr] lg:items-start">
          <div>
            <div className="inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-5 py-2 text-sm font-semibold text-green-300">
              Supabase Login + Datenbank
            </div>

            <h1 className="mt-6 text-5xl font-black tracking-tight md:text-6xl">
              DiagnoseHUB Account.
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-400">
              Diese Seite ist die zentrale Verwaltung für Login,
              Werkstattprofil und Plan. Der gespeicherte Plan wird von
              Dashboard, Diagnose und Prüfprotokoll verwendet.
            </p>

            <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                Account-Status
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

                  {databaseProfile ? (
                    <>
                      <p>
                        Werkstatt:{" "}
                        <span className="font-semibold text-white">
                          {databaseProfile.workshop_name}
                        </span>
                      </p>

                      <p>
                        Bearbeiter:{" "}
                        <span className="font-semibold text-white">
                          {databaseProfile.full_name}
                        </span>
                      </p>

                      <p>
                        Plan:{" "}
                        <span className="font-semibold text-white">
                          {PLAN_CONFIG[databaseProfile.plan].label}
                        </span>
                      </p>

                      <p>
                        Aktualisiert:{" "}
                        <span className="font-semibold text-white">
                          {formatDateTime(databaseProfile.updated_at)}
                        </span>
                      </p>
                    </>
                  ) : (
                    <p className="text-yellow-300">
                      Noch kein Werkstattprofil in Supabase gespeichert.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 leading-7 text-slate-400">
                  Noch nicht eingeloggt. Registriere dich oder melde dich mit
                  einem bestehenden Supabase-Account an.
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
                >
                  Zum Dashboard
                </Link>

                <Link
                  href="/#diagnose"
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  Zur Diagnose
                </Link>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-blue-500/20 bg-blue-500/10 p-6">
              <p className="font-bold text-blue-300">Aktueller Stand</p>

              <p className="mt-3 leading-7 text-slate-300">
                Werkstattprofil, Diagnosefälle, Nutzungszähler und
                Premium-Vormerkungen sind für eingeloggte Nutzer an Supabase
                angebunden. Lokale Daten bleiben nur als Fallback und für
                Migration erhalten.
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
                      type="button"
                      onClick={() => {
                        setAuthMode("login");
                        resetMessages();
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
                      type="button"
                      onClick={() => {
                        setAuthMode("register");
                        resetMessages();
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

                    {authMode !== "reset" && (
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
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={
                      authMode === "login"
                        ? handleLogin
                        : authMode === "register"
                          ? handleRegister
                          : handlePasswordResetRequest
                    }
                    disabled={authLoading}
                    className="mt-6 w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {authLoading
                      ? "Bitte warten..."
                      : authMode === "login"
                        ? "Einloggen"
                        : authMode === "register"
                          ? "Account erstellen"
                          : "Link senden"}
                  </button>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
                    {authMode !== "reset" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("reset");
                          setAuthPassword("");
                          resetMessages();
                        }}
                        className="text-blue-300 transition hover:text-blue-200"
                      >
                        Passwort vergessen?
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("login");
                          resetMessages();
                        }}
                        className="text-blue-300 transition hover:text-blue-200"
                      >
                        Zurück zum Login
                      </button>
                    )}
                  </div>
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
                    type="button"
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
                In Supabase speichern
              </h2>

              <p className="mt-3 leading-7 text-slate-400">
                Diese Daten werden in{" "}
                <span className="font-mono text-slate-300">
                  workshop_profiles
                </span>{" "}
                gespeichert. Der Plan wird danach serverseitig für Limits
                verwendet.
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
                    disabled={!user || profileLoading}
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
                    disabled={!user || profileLoading}
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
                    disabled={!user || profileLoading}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="mt-8">
                <p className="mb-4 font-bold text-white">Aktiver Tarif</p>

                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <span className="inline-flex rounded-full border border-blue-400/40 bg-blue-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-200">
                        {PLAN_CONFIG[plan].badge}
                      </span>

                      <h3 className="mt-3 text-xl font-bold text-white">
                        {PLAN_CONFIG[plan].label}
                      </h3>

                      <p className="mt-2 leading-7 text-slate-400">
                        {PLAN_CONFIG[plan].description}
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                      Aktiv
                    </span>
                  </div>

                  <ul className="mt-4 grid gap-2 md:grid-cols-2">
                    {PLAN_CONFIG[plan].features.map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-3 text-sm text-slate-300"
                      >
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    Tarife werden nach Stripe-Zahlung oder durch eine manuelle
                    Admin-Freischaltung gesetzt. Profilangaben ändern deinen
                    Tarif nicht.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveAccount}
                  disabled={!user || profileLoading}
                  className="rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {profileLoading
                    ? "Speichert..."
                    : "Werkstattprofil speichern"}
                </button>

                <button
                  type="button"
                  onClick={deleteDatabaseProfile}
                  disabled={!user || profileLoading || !databaseProfile}
                  className="rounded-2xl border border-red-500/30 px-6 py-4 font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Profil aus Supabase löschen
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
