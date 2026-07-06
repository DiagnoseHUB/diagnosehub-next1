"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CheckoutPlan } from "@/config/plans";
import { fetchJsonWithTimeout } from "@/utils/clientApi";

type StripeCheckoutButtonProps = {
  className?: string;
  children?: React.ReactNode;
  plan?: CheckoutPlan | "pro";
};

export default function StripeCheckoutButton({
  className = "",
  children = "Tarif aktivieren",
  plan = "pro",
}: StripeCheckoutButtonProps) {
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function startCheckout() {
    setLoading(true);
    setErrorMessage("");

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

      const { response, data } = await fetchJsonWithTimeout<{
        url?: string;
        error?: string;
      }>(
        "/api/stripe/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            plan,
          }),
        },
        20000
      );

      if (!response.ok) {
        throw new Error(data.error || "Stripe Checkout konnte nicht gestartet werden.");
      }

      if (!data.url) {
        throw new Error("Stripe hat keine Checkout-URL zurückgegeben.");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Stripe Checkout Fehler:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Stripe Checkout konnte nicht gestartet werden."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {loading ? "Checkout wird geöffnet..." : children}
      </button>

      {errorMessage && (
        <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
