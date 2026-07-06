"use client";

import { useState } from "react";
import { fetchJsonWithTimeout } from "@/utils/clientApi";

type FeedbackStatus = "idle" | "sending" | "sent" | "error";

function getCurrentPage() {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.pathname}${window.location.search}`;
}

function FeedbackForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [error, setError] = useState("");

  async function submitFeedback() {
    const cleanMessage = message.trim();

    setError("");

    if (cleanMessage.length < 5) {
      setStatus("error");
      setError("Bitte schreibe kurz, was dir aufgefallen ist.");
      return;
    }

    setStatus("sending");

    try {
      const { response, data: payload } = await fetchJsonWithTimeout<{
        error?: string;
      }>(
        "/api/feedback",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            message: cleanMessage,
            page: getCurrentPage(),
            company,
          }),
        },
        15000
      );

      if (!response.ok) {
        throw new Error(payload.error || "Feedback konnte nicht gesendet werden.");
      }

      setStatus("sent");
      setName("");
      setEmail("");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setError(
        error instanceof Error
          ? error.message
          : "Feedback konnte nicht gesendet werden."
      );
    }
  }

  return (
    <section className="mt-12 rounded-3xl border border-blue-500/20 bg-slate-900/80 p-6">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-blue-300">
            Feedback
          </p>

          <h2 className="mt-2 text-2xl font-black text-white">
            Sag mir, was besser werden soll.
          </h2>

          <p className="mt-3 leading-7 text-slate-300">
            Dein Feedback wird nicht öffentlich angezeigt. Es wird privat an
            DiagnoseHUB gesendet und nur intern zur Verbesserung genutzt.
          </p>
        </div>

        <div className="grid gap-3">
          <input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name optional"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />

            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="E-Mail optional"
              type="email"
              className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Was fehlt, was nervt, was soll als nächstes besser werden?"
            rows={4}
            className="resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => void submitFeedback()}
              disabled={status === "sending"}
              className="rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "sending" ? "Wird gesendet..." : "Feedback senden"}
            </button>

            {status === "sent" && (
              <p className="text-sm font-semibold text-green-300">
                Danke, ist angekommen.
              </p>
            )}

            {status === "error" && error && (
              <p className="text-sm font-semibold text-red-300">{error}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeedbackForm;
