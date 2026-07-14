"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CommunityRank = "azubi" | "geselle" | "meister";
type RequestedRank = "geselle" | "meister";
type RoleVerificationStatus = "pending" | "approved" | "rejected" | "cancelled";

type RoleVerificationProfile = {
  rank: CommunityRank;
  rankLabel: string;
  canRequestGeselle: boolean;
  canRequestMeister: boolean;
};

type RoleVerificationRequest = {
  id: string;
  requestedRank: RequestedRank;
  requestedRankLabel?: string;
  requiredDocument: "gesellenbrief" | "meisterbrief";
  documentName: string;
  documentMimeType: string;
  documentSizeBytes: number;
  applicantNote: string;
  status: RoleVerificationStatus;
  reviewNotes: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type AdminRoleVerificationRequest = RoleVerificationRequest & {
  userId: string;
  documentUrl: string;
  profile: {
    full_name?: string | null;
    workshop_name?: string | null;
    email?: string | null;
    role?: string | null;
    community_rank?: CommunityRank | null;
  } | null;
};

type RoleVerificationResponse = {
  profile?: RoleVerificationProfile;
  isAdmin?: boolean;
  requests?: RoleVerificationRequest[];
  setupNotice?: string;
  error?: string;
};

type AdminRoleVerificationResponse = {
  requests?: AdminRoleVerificationRequest[];
  request?: AdminRoleVerificationRequest;
  setupNotice?: string;
  message?: string;
  error?: string;
};

const rankLabels: Record<CommunityRank | RequestedRank, string> = {
  azubi: "Azubi",
  geselle: "Geselle",
  meister: "Meister",
};

const requestedRankDocumentLabels: Record<RequestedRank, string> = {
  geselle: "Gesellenbrief",
  meister: "Meisterbrief",
};

const statusLabels: Record<RoleVerificationStatus, string> = {
  pending: "Prüfung offen",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  cancelled: "Abgebrochen",
};

const statusClasses: Record<RoleVerificationStatus, string> = {
  pending:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  approved:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300",
  rejected:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  cancelled:
    "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const allowedFileTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const maxDocumentBytes = 8 * 1024 * 1024;

function formatDateTime(value?: string | null) {
  if (!value) {
    return "nicht vorhanden";
  }

  try {
    return new Date(value).toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) {
    return "";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 102.4) / 10} KB`;
  }

  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function requestLabel(request: RoleVerificationRequest) {
  return request.requestedRankLabel || rankLabels[request.requestedRank];
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

export default function RoleVerificationAccountPanel() {
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<RoleVerificationProfile | null>(null);
  const [requests, setRequests] = useState<RoleVerificationRequest[]>([]);
  const [adminRequests, setAdminRequests] = useState<
    AdminRoleVerificationRequest[]
  >([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState("");
  const [setupNotice, setSetupNotice] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFileSize, setSelectedFileSize] = useState(0);
  const [selectedFileDataUrl, setSelectedFileDataUrl] = useState("");
  const [form, setForm] = useState({
    requestedRank: "geselle" as RequestedRank,
    applicantNote: "",
  });
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const canSubmitRequest =
    selectedFileDataUrl.length > 0 &&
    (form.requestedRank === "geselle"
      ? profile?.canRequestGeselle
      : profile?.canRequestMeister);
  const capabilityRows =
    profile?.rank === "meister"
      ? [
            "Forum: Fragen stellen, antworten und richtige Antworten markieren",
            "Teilemarkt: Gebrauchtteile einstellen und als geprüfte Werkstatt auftreten",
            "Diagnose/Anleitungen: fachliche Inhalte mit erweiterter Sicherheitsfreigabe",
            "Nutzerprofil: Rolle, Kontotyp, Qualifikation und Teilemarktstatus werden automatisch synchronisiert",
        ]
      : profile?.rank === "geselle"
        ? [
            "Forum: Fragen stellen und fachlich antworten",
            "Teilemarkt: Gebrauchtteile einstellen und als geprüfter Anbieter auftreten",
            "Diagnose/Anleitungen: fachliche Inhalte mit erweiterter Sicherheitsfreigabe",
            "Nutzerprofil: Rolle, Kontotyp, Qualifikation und Teilemarktstatus werden automatisch synchronisiert",
          ]
        : [
            "Forum: Fragen stellen",
            "Teilemarkt: Teile anfragen",
            "Diagnose/Anleitungen: normale Accountfreigabe ohne geprüften Fachkundenachweis",
            "Nutzerprofil: Geselle oder Meister kann per Nachweis beantragt werden",
          ];

  const loadRoleVerificationData = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Bitte zuerst einloggen.");
      }

      const accountResponse = await fetch("/api/account/role-verification", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const accountPayload =
        (await accountResponse.json().catch(() => ({}))) as RoleVerificationResponse;

      if (!accountResponse.ok) {
        throw new Error(
          accountPayload.error || "Qualifikation konnte nicht geladen werden.",
        );
      }

      const nextProfile = accountPayload.profile ?? null;

      setProfile(nextProfile);
      setRequests(Array.isArray(accountPayload.requests) ? accountPayload.requests : []);
      setIsAdmin(accountPayload.isAdmin === true);
      setSetupNotice(accountPayload.setupNotice || "");

      if (nextProfile?.rank === "geselle") {
        setForm((current) => ({
          ...current,
          requestedRank: "meister",
        }));
      }

      if (accountPayload.isAdmin && !accountPayload.setupNotice) {
        const adminResponse = await fetch(
          "/api/admin/role-verifications?status=pending",
          {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        );
        const adminPayload =
          (await adminResponse.json().catch(() => ({}))) as AdminRoleVerificationResponse;

        if (!adminResponse.ok) {
          throw new Error(
            adminPayload.error || "Freigaben konnten nicht geladen werden.",
          );
        }

        setAdminRequests(
          Array.isArray(adminPayload.requests) ? adminPayload.requests : [],
        );
      } else {
        setAdminRequests([]);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Qualifikation konnte nicht geladen werden.",
      );
      setProfile(null);
      setRequests([]);
      setAdminRequests([]);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadRoleVerificationData();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadRoleVerificationData]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setMessage("");

    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFileName("");
      setSelectedFileSize(0);
      setSelectedFileDataUrl("");
      return;
    }

    if (!allowedFileTypes.has(file.type)) {
      setError("Bitte PDF, JPG, PNG oder WebP hochladen.");
      return;
    }

    if (file.size > maxDocumentBytes) {
      setError("Der Nachweis darf maximal 8 MB groß sein.");
      return;
    }

    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);
    setSelectedFileDataUrl(await fileToDataUrl(file));
  }

  async function submitRoleVerification() {
    setError("");
    setMessage("");

    if (!selectedFileDataUrl) {
      setError("Bitte zuerst den passenden Nachweis hochladen.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Bitte zuerst einloggen.");
      }

      const response = await fetch("/api/account/role-verification", {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestedRank: form.requestedRank,
          documentName: selectedFileName,
          documentDataUrl: selectedFileDataUrl,
          applicantNote: form.applicantNote,
        }),
      });
      const payload =
        (await response.json().catch(() => ({}))) as RoleVerificationResponse & {
          message?: string;
        };

      if (!response.ok) {
        throw new Error(
          payload.error || "Qualifikationsnachweis konnte nicht gespeichert werden.",
        );
      }

      setSelectedFileName("");
      setSelectedFileSize(0);
      setSelectedFileDataUrl("");
      setForm((current) => ({
        ...current,
        applicantNote: "",
      }));
      setMessage(payload.message || "Nachweis wurde hochgeladen.");
      await loadRoleVerificationData();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Qualifikationsnachweis konnte nicht gespeichert werden.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function reviewRoleVerification(
    requestId: string,
    decision: "approved" | "rejected",
  ) {
    setError("");
    setMessage("");
    setReviewingId(requestId);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Bitte zuerst einloggen.");
      }

      const response = await fetch("/api/admin/role-verifications", {
        method: "PATCH",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId,
          decision,
          reviewNotes: reviewNotes[requestId] || "",
        }),
      });
      const payload =
        (await response.json().catch(() => ({}))) as AdminRoleVerificationResponse;

      if (!response.ok) {
        throw new Error(
          payload.error || "Qualifikationsnachweis konnte nicht geprüft werden.",
        );
      }

      setMessage(payload.message || "Qualifikationsnachweis wurde geprüft.");
      setReviewNotes((current) => {
        const next = { ...current };
        delete next[requestId];
        return next;
      });
      await loadRoleVerificationData();
      window.dispatchEvent(new Event("diagnosehub-account-updated"));
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Qualifikationsnachweis konnte nicht geprüft werden.",
      );
    } finally {
      setReviewingId("");
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-blue-950/20">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">
            Nutzerprofil & Qualifikation
          </h2>
          <p className="mt-2 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">
            Diese Einstufung gilt für die komplette Website: Forum, Diagnose,
            Anleitungen, Teilemarkt und Sicherheitsfreigaben. Geselle und
            Meister werden erst nach Nachweis freigeschaltet.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadRoleVerificationData()}
          disabled={loading}
          className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          {loading ? "Lädt..." : "Qualifikation neu laden"}
        </button>
      </div>

      <div className="mt-6 space-y-5">
        {setupNotice && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 leading-7 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {setupNotice}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 leading-7 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 leading-7 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
            {message}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-sm text-slate-500">Aktuelle Website-Qualifikation</p>
            <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
              {loading && !profile ? "Lädt..." : profile?.rankLabel || "Azubi"}
            </p>
            <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
              {profile?.rank === "meister"
                ? "Dieser Account ist als Meister freigegeben und kann die erweiterten Website-Funktionen nutzen."
                : profile?.rank === "geselle"
                  ? "Dieser Account ist als Geselle freigegeben und kann fachliche Funktionen nutzen."
                  : "Dieser Account ist als Azubi eingestuft. Geselle oder Meister kannst du per Nachweis beantragen."}
            </p>

            <div className="mt-4 grid gap-2">
              {capabilityRows.map((capability) => (
                <p
                  key={capability}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  {capability}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
            <h3 className="text-xl font-black text-slate-950 dark:text-white">
              Qualifikation beantragen
            </h3>
            <p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">
              Lade den passenden Nachweis hoch. Danach kann ein Admin die
              Qualifikation im selben Accountbereich freigeben. Die Freigabe
              gilt anschließend automatisch für alle passenden Bereiche.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                Gewünschte Qualifikation
                <select
                  value={form.requestedRank}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      requestedRank: event.target.value as RequestedRank,
                    }))
                  }
                  disabled={profile?.rank === "meister"}
                  className="mt-2 w-full rounded-2xl border border-slate-400 bg-slate-100 px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                >
                  <option value="geselle" disabled={!profile?.canRequestGeselle}>
                    Geselle freischalten
                  </option>
                  <option value="meister" disabled={!profile?.canRequestMeister}>
                    Meister freischalten
                  </option>
                </select>
              </label>

              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                Nachweis
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => void handleFileChange(event)}
                  disabled={profile?.rank === "meister"}
                  className="mt-2 w-full rounded-2xl border border-slate-400 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-950 outline-none transition file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:font-bold file:text-white focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:file:bg-blue-600 dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                />
              </label>
            </div>

            {selectedFileName && (
              <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                Ausgewählt: {selectedFileName} {formatFileSize(selectedFileSize)}
              </p>
            )}

            <label className="mt-4 block text-sm font-bold text-slate-700 dark:text-slate-200">
              Hinweis zur Prüfung
              <textarea
                value={form.applicantNote}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    applicantNote: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Optional: Name auf dem Nachweis, Betrieb, kurzer Hinweis."
                className="mt-2 w-full rounded-2xl border border-slate-400 bg-slate-100 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
              />
            </label>

            <button
              type="button"
              onClick={() => void submitRoleVerification()}
              disabled={submitting || loading || !canSubmitRequest}
              className="mt-4 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Nachweis wird hochgeladen..."
                : `${requestedRankDocumentLabels[form.requestedRank]} hochladen`}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
          <h3 className="text-xl font-black text-slate-950 dark:text-white">
            Eigene Anträge
          </h3>

          {requests.length === 0 ? (
            <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
              Für diesen Account liegt noch kein Qualifikationsnachweis vor.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-black text-slate-950 dark:text-white">
                        {requestLabel(request)} · {request.documentName}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Eingereicht: {formatDateTime(request.createdAt)}
                      </p>
                      {request.reviewNotes && (
                        <p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">
                          Prüfung: {request.reviewNotes}
                        </p>
                      )}
                    </div>

                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClasses[request.status]}`}
                    >
                      {statusLabels[request.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-500/30 dark:bg-blue-500/10">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-950 dark:text-white">
                  Qualifikationsfreigaben für Admins
                </h3>
                <p className="mt-2 leading-7 text-slate-700 dark:text-slate-300">
                  Hier gibst du Geselle oder Meister nach Sichtprüfung des
                  hochgeladenen Nachweises frei. Die Freigabe wird auf Profil,
                  Forum, Diagnose, Anleitungen und Teilemarkt übertragen.
                </p>
              </div>
              <span className="rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700 dark:border-blue-500/40 dark:bg-slate-950/70 dark:text-blue-300">
                Admin
              </span>
            </div>

            {adminRequests.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-blue-200 bg-white p-4 leading-7 text-slate-700 dark:border-blue-500/20 dark:bg-slate-950/60 dark:text-slate-300">
                Aktuell warten keine Qualifikationsnachweise auf Freigabe.
              </p>
            ) : (
              <div className="mt-5 grid gap-4">
                {adminRequests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-blue-200 bg-white p-5 dark:border-blue-500/20 dark:bg-slate-950/70"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          {rankLabels[request.requestedRank]} freischalten
                        </p>
                        <h4 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                          {request.profile?.full_name ||
                            request.profile?.workshop_name ||
                            request.profile?.email ||
                            "Unbekannter Account"}
                        </h4>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                          {request.profile?.email && (
                            <span>{request.profile.email}</span>
                          )}
                          {request.profile?.role && (
                            <span>Profilrolle: {request.profile.role}</span>
                          )}
                          <span>
                            Aktuell:{" "}
                            {rankLabels[
                              request.profile?.community_rank || "azubi"
                            ]}
                          </span>
                          <span>
                            Eingereicht: {formatDateTime(request.createdAt)}
                          </span>
                        </div>

                        {request.applicantNote && (
                          <p className="mt-3 leading-7 text-slate-700 dark:text-slate-300">
                            Hinweis: {request.applicantNote}
                          </p>
                        )}

                        {request.documentUrl && (
                          <a
                            href={request.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Nachweis öffnen
                          </a>
                        )}
                      </div>

                      <div className="w-full max-w-md">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                          Prüfnotiz
                          <textarea
                            value={reviewNotes[request.id] || ""}
                            onChange={(event) =>
                              setReviewNotes((current) => ({
                                ...current,
                                [request.id]: event.target.value,
                              }))
                            }
                            rows={3}
                            placeholder="z. B. Nachweis geprüft und Name plausibel."
                            className="mt-2 w-full rounded-2xl border border-slate-400 bg-slate-100 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-500/20"
                          />
                        </label>

                        <div className="mt-3 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              void reviewRoleVerification(request.id, "approved")
                            }
                            disabled={reviewingId === request.id}
                            className="rounded-2xl bg-green-600 px-4 py-2 text-sm font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Freigeben
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void reviewRoleVerification(request.id, "rejected")
                            }
                            disabled={reviewingId === request.id}
                            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500"
                          >
                            Ablehnen
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
