"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type UserPlan = "werkstatt" | "pro";

type PremiumLead = {
  id: string;
  createdAt: string;
  plan: UserPlan;
  name: string;
  workshop: string;
  email: string;
  phone: string;
  note: string;
};

const PREMIUM_LEADS_STORAGE_KEY = "diagnosehub-premium-leads";

const planOptions: Record<
  UserPlan,
  {
    label: string;
    price: string;
    description: string;
    features: string[];
  }
> = {
  werkstatt: {
    label: "Werkstatt",
    price: "29 € / Monat",
    description:
      "Für kleine Werkstätten, die DiagnoseHUB regelmäßig für Diagnosefälle nutzen wollen.",
    features: [
      "Mehr KI-Diagnosen pro Tag",
      "Individuelle Prüfprotokolle nach Fehlercode",
      "Erweiterte Fallhistorie",
      "Fallberichte für Kundenakte",
      "Erweiterte Fehlercode-Datenbank",
    ],
  },
  pro: {
    label: "Werkstatt Pro",
    price: "79 € / Monat",
    description:
      "Für Betriebe mit höherem Diagnosevolumen, mehreren Nutzern und mehr Dokumentation.",
    features: [
      "Höheres Diagnosekontingent",
      "Mehrere Benutzer geplant",
      "PDF-Berichte geplant",
      "Cloud-Fallhistorie geplant",
      "Werkstatt-Dashboard geplant",
    ],
  },
};

function getInitialPlan(): UserPlan {
  if (typeof window === "undefined") {
    return "werkstatt";
  }

  const params = new URLSearchParams(window.location.search);
  const plan = params.get("plan");

  if (plan === "pro") {
    return "pro";
  }

  return "werkstatt";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function PremiumPage() {
  const [selectedPlan, setSelectedPlan] = useState<UserPlan>("werkstatt");
  const [name, setName] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [leads, setLeads] = useState<PremiumLead[]>([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const currentPlan = planOptions[selectedPlan];

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [leads]);

  useEffect(() => {
    setSelectedPlan(getInitialPlan());

    try {
      const savedLeads = localStorage.getItem(PREMIUM_LEADS_STORAGE_KEY);

      if (savedLeads) {
        const parsedLeads = JSON.parse(savedLeads);

        if (Array.isArray(parsedLeads)) {
          setLeads(parsedLeads);
        }
      }
    } catch (error) {
      console.error("Premium-Vormerkungen konnten nicht geladen werden:", error);
    }
  }, []);

  function saveLead() {
    setError("");
    setSuccess(false);

    const cleanName = name.trim();
    const cleanWorkshop = workshop.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanNote = note.trim();

    if (!cleanName) {
      setError("Bitte gib einen Namen ein.");
      return;
    }

    if (!cleanWorkshop) {
      setError("Bitte gib den Werkstattnamen ein.");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }

    const newLead: PremiumLead = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      plan: selectedPlan,
      name: cleanName,
      workshop: cleanWorkshop,
      email: cleanEmail,
      phone: cleanPhone,
      note: cleanNote,
    };

    const updatedLeads = [newLead, ...leads].slice(0, 50);

    setLeads(updatedLeads);
    localStorage.setItem(PREMIUM_LEADS_STORAGE_KEY, JSON.stringify(updatedLeads));

    setName("");
    setWorkshop("");
    setEmail("");
    setPhone("");
    setNote("");
    setSuccess(true);

    window.setTimeout(() => {
      setSuccess(false);
    }, 3000);
  }

  function deleteLead(leadId: string) {
    const updatedLeads = leads.filter((lead) => lead.id !== leadId);

    setLeads(updatedLeads);
    localStorage.setItem(PREMIUM_LEADS_STORAGE_KEY, JSON.stringify(updatedLeads));
  }

  function exportLeads() {
    if (leads.length === 0) {
      setError("Es gibt noch keine Vormerkungen zum Exportieren.");
      return;
    }

    const csvRows = [
      [
        "Datum",
        "Plan",
        "Name",
        "Werkstatt",
        "E-Mail",
        "Telefon",
        "Notiz",
      ],
      ...sortedLeads.map((lead) => [
        formatDateTime(lead.createdAt),
        planOptions[lead.plan].label,
        lead.name,
        lead.workshop,
        lead.email,
        lead.phone,
        lead.note,
      ]),
    ];

    const csvContent = csvRows
      .map((row) => {
        return row
          .map((cell) => `"${cell.replaceAll('"', '""')}"`)
          .join(";");
      })
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `diagnosehub-premium-vormerkungen-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setError("");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-14">
        <section className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <div className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-5 py-2 text-sm font-semibold text-blue-300">
              DiagnoseHUB Premium
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight md:text-6xl">
              Werkstatt-Zugang vormerken.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-400">
              Diese Seite ist die Vorbereitung für das spätere Bezahlsystem.
              Aktuell wird noch nichts abgerechnet. Die Vormerkung wird nur
              lokal im Browser gespeichert.
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {(["werkstatt", "pro"] as UserPlan[]).map((plan) => (
                <button
                  key={plan}
                  onClick={() => setSelectedPlan(plan)}
                  className={
                    selectedPlan === plan
                      ? "rounded-3xl border border-blue-500 bg-blue-500/10 p-6 text-left shadow-2xl shadow-blue-950/40"
                      : "rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-left transition hover:border-blue-500/50"
                  }
                >
                  <p className="text-sm font-bold uppercase tracking-wide text-blue-300">
                    {planOptions[plan].label}
                  </p>

                  <p className="mt-3 text-4xl font-black">
                    {planOptions[plan].price}
                  </p>

                  <p className="mt-4 leading-7 text-slate-400">
                    {planOptions[plan].description}
                  </p>

                  <ul className="mt-6 space-y-3">
                    {planOptions[plan].features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-sm text-slate-300">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-6">
              <p className="font-bold text-yellow-300">
                Noch kein echtes Abo aktiv
              </p>

              <p className="mt-3 leading-7 text-slate-300">
                Für den echten Verkauf brauchen wir später Login, Datenbank,
                Stripe Checkout, Stripe Webhooks und eine serverseitige
                Premium-Prüfung. Diese Seite bereitet nur die Oberfläche und
                den Ablauf vor.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-blue-950/30">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
              Vormerkung
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              {currentPlan.label} vormerken
            </h2>

            <p className="mt-3 leading-7 text-slate-400">
              Ausgewählter Plan:{" "}
              <span className="font-bold text-white">{currentPlan.price}</span>
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
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
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
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  E-Mail
                </label>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="mail@werkstatt.de"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Telefon optional
                </label>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+49 ..."
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Notiz optional
                </label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  placeholder="z. B. Interesse an mehreren Nutzern, PDF-Berichten, bestimmter Fahrzeugmarke..."
                  className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>

              <button
                onClick={saveLead}
                className="rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500"
              >
                Vormerkung speichern
              </button>
            </div>

            {success && (
              <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-4 text-green-300">
                Vormerkung wurde lokal gespeichert.
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-300">
                {error}
              </div>
            )}
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
                Lokale Vormerkungen
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                Interessenten im Prototyp
              </h2>

              <p className="mt-2 text-slate-500">
                Nur auf diesem Gerät gespeichert. Später ersetzen wir das durch
                eine echte Datenbank.
              </p>
            </div>

            <button
              onClick={exportLeads}
              className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              CSV exportieren
            </button>
          </div>

          {sortedLeads.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-slate-500">
              Noch keine Vormerkungen gespeichert.
            </div>
          ) : (
            <div className="space-y-4">
              {sortedLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-3">
                        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-300">
                          {planOptions[lead.plan].label}
                        </span>

                        <span className="text-sm text-slate-500">
                          {formatDateTime(lead.createdAt)}
                        </span>
                      </div>

                      <h3 className="mt-4 text-xl font-bold text-white">
                        {lead.workshop}
                      </h3>

                      <p className="mt-2 text-slate-300">{lead.name}</p>

                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
                        <span>{lead.email}</span>
                        {lead.phone && <span>{lead.phone}</span>}
                      </div>

                      {lead.note && (
                        <p className="mt-4 leading-7 text-slate-400">
                          {lead.note}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => deleteLead(lead.id)}
                      className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}