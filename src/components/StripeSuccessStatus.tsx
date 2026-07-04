"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type StatusState = "loading" | "success" | "error" | "missing-session";

type CheckoutStatusResponse = {
  ok?: boolean;
  plan?: string;
  subscriptionStatus?: string;
  error?: string;
};

export default function StripeSuccessStatus() {
  const supabase = createClient();

  const [status, setStatus] = useState<StatusState>("loading");
  const [message, setMessage] = useState("Stripe-Zahlung wird geprüft ...");

  useEffect(() => {
    async function verifyCheckout() {
      const searchParams = new URLSearchParams(window.location.search);
      const sessionId = searchParams.get("session_id");

      if (!sessionId) {
        setStatus("missing-session");
        setMessage(
          "Die Zahlung war erfolgreich, aber es wurde keine Stripe-Session-ID uebergeben."
        );
        return;
      }

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        if (!session?.access_token) {
          window.location.href = "/login";
          return;
        }

        const response = await fetch("/api/stripe/checkout-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            sessionId,
          }),
        });

        const data = (await response.json()) as CheckoutStatusResponse;

        if (!response.ok) {
          throw new Error(
            data.error || "Pro-Zugang konnte nicht automatisch aktiviert werden."
          );
        }

        window.dispatchEvent(new Event("diagnosehub-account-updated"));

        setStatus("success");
        setMessage(
          data.plan === "service_reminder"
            ? "Deine Service-Erinnerung wurde erfolgreich aktiviert. Du kannst deine Fahrzeuge jetzt zentral verwalten."
            : "Dein Pro-Zugang wurde erfolgreich aktiviert. Du kannst DiagnoseHUB jetzt mit Pro-Funktionen nutzen."
        );
      } catch (error) {
        console.error("Stripe Erfolgseite Fehler:", error);

        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Pro-Zugang konnte nicht automatisch aktiviert werden."
        );
      }
    }

    void verifyCheckout();
  }, [supabase]);

  const isSuccess = status === "success";
  const isLoading = status === "loading";
  const isError = status === "error";
  const isMissingSession = status === "missing-session";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div
            className={
              isSuccess
                ? "inline-flex rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-300"
                : isLoading
                  ? "inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                  : "inline-flex rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-300"
            }
          >
            {isSuccess
              ? "Aktiviert"
              : isLoading
                ? "Prüfung läuft"
                : "Prüfung erforderlich"}
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Zahlung erfolgreich
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            {message}
          </p>

          {isLoading && (
            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
              Einen Moment, dein Stripe-Checkout wird mit deinem DiagnoseHUB-Account
              abgeglichen.
            </div>
          )}

          {isError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              Die Zahlung kann trotzdem erfolgreich gewesen sein. Prüfe in Stripe
              den Zahlungsstatus und ob der Webhook korrekt eingerichtet ist.
            </div>
          )}

          {isMissingSession && (
            <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300">
              Das passiert meistens, wenn noch ein alter Checkout-Link ohne
              session_id verwendet wurde. Starte Pro erneut ueber die Preise-Seite.
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/#diagnose"
              className="rounded-2xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Zur KI-Diagnose
            </Link>

            <Link
              href="/preise"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-center text-sm font-semibold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
            >
              Zur Preise-Seite
            </Link>

            <Link
              href="/login"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
            >
              Account ansehen
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
