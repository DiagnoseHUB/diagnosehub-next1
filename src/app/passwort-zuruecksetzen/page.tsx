"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/client";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unbekannter Fehler";
}

export default function PasswortZuruecksetzenPage() {
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          window.history.replaceState(null, "", "/passwort-zuruecksetzen");
        }

        const { data } = await supabase.auth.getSession();

        if (mounted) {
          setReady(Boolean(data.session));
        }
      } catch (error) {
        if (mounted) {
          setError(
            `Der Passwort-Link ist ungültig oder abgelaufen: ${getErrorMessage(
              error
            )}`
          );
        }
      }
    }

    void prepareRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function updatePassword() {
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Das neue Passwort muss mindestens 6 Zeichen haben.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setPassword("");
      setConfirmPassword("");
      setMessage("Passwort wurde gespeichert. Du kannst dich jetzt einloggen.");
    } catch (error) {
      setError(`Passwort konnte nicht gespeichert werden: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-xl px-6 py-14">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-blue-950/30">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
            Account
          </p>

          <h1 className="mt-3 text-3xl font-bold">Passwort zurücksetzen</h1>

          <p className="mt-3 leading-7 text-slate-400">
            Vergib ein neues Passwort für deinen DiagnoseHUB Account.
          </p>

          {!ready && !error && (
            <div className="mt-6 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5 text-blue-200">
              Passwort-Link wird geprüft...
            </div>
          )}

          {ready && (
            <div className="mt-6 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Neues Passwort
                </label>

                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mindestens 6 Zeichen"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Passwort wiederholen
                </label>

                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Noch einmal eingeben"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>

              <button
                type="button"
                onClick={updatePassword}
                disabled={loading}
                className="rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Speichert..." : "Passwort speichern"}
              </button>
            </div>
          )}

          {message && (
            <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4 text-green-300">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-300">
              {error}
            </div>
          )}

          <Link
            href="/login"
            className="mt-6 inline-flex rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Zur Login-Seite
          </Link>
        </section>
      </main>
    </div>
  );
}
