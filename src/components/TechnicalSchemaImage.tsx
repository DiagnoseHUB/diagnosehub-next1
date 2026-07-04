"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TechnicalSchemaContext = "diagnosis" | "instruction" | "learning";

type TechnicalSchemaImageProps = {
  context: TechnicalSchemaContext;
  title: string;
  subject: string;
  details: string;
  autoGenerate?: boolean;
  className?: string;
};

type SchemaImageApiResponse = {
  imageUrl?: string;
  revisedPrompt?: string;
  model?: string;
  imageSize?: string;
  imageQuality?: string;
  error?: string;
};

const SCHEMA_IMAGE_CACHE_NAME = "diagnosehub-schema-images-v1";
const SCHEMA_IMAGE_PROMPT_VERSION = "diagnostic-board-v5";

const MARKER_LEGEND = [
  {
    marker: "P1",
    title: "Sichtprüfung",
    description: "Bauteil, Schlauch, Leitung, Stecker und Befestigung ansehen.",
  },
  {
    marker: "P2",
    title: "Stecker / Versorgung",
    description: "Kontakt, Verriegelung, Plus, Masse oder Unterbrechung prüfen.",
  },
  {
    marker: "P3",
    title: "Signal / Istwert",
    description: "Sensorwert, Stellgliedsignal oder Diagnosewert vergleichen.",
  },
  {
    marker: "P4",
    title: "Druck / Dichtheit",
    description: "Druck, Unterdruck, Leck, Durchfluss oder mechanische Funktion prüfen.",
  },
  {
    marker: "P5",
    title: "Abschlussprüfung",
    description: "Fehler löschen, Probefahrt, Plausibilität und Rückfall prüfen.",
  },
];

const MEASUREMENT_LEGEND = [
  { marker: "M1", title: "Multimeter" },
  { marker: "M2", title: "Diagnosetester" },
  { marker: "M3", title: "Manometer / Druckpumpe" },
  { marker: "M4", title: "Rauchtester / Lecksuche" },
];

function getContextLabel(context: TechnicalSchemaContext) {
  if (context === "instruction") return "Anleitungs-Schema";
  if (context === "learning") return "Lern-Schema";
  return "Diagnose-Schema";
}

function getActionLabel(context: TechnicalSchemaContext) {
  if (context === "instruction") return "Schema zur Anleitung erzeugen";
  if (context === "learning") return "Schema zum Lerninhalt erzeugen";
  return "Schema zur Diagnose erzeugen";
}

function SchemaMarkerLegend() {
  return (
    <div className="mt-4 rounded-2xl border border-blue-500/20 bg-white/70 p-4 dark:bg-slate-950/40">
      <p className="text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-400">
        Marker-Erklärung
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {MARKER_LEGEND.map((item) => (
          <div key={item.marker} className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white dark:bg-slate-100 dark:text-slate-950">
                {item.marker}
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                {item.title}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {MEASUREMENT_LEGEND.map((item) => (
          <span
            key={item.marker}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {item.marker}: {item.title}
          </span>
        ))}
      </div>
    </div>
  );
}

async function readJsonSafely(
  response: Response,
): Promise<SchemaImageApiResponse> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as SchemaImageApiResponse;
  } catch {
    return {
      error: text,
    };
  }
}

async function createCacheKey(value: string) {
  if (!crypto.subtle) {
    return `/diagnosehub-schema-image-cache/${encodeURIComponent(
      value.slice(0, 400),
    )}.json`;
  }

  const encodedValue = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encodedValue);

  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `/diagnosehub-schema-image-cache/${hash}.json`;
}

async function loadCachedSchemaImage(cacheKey: string) {
  if (!("caches" in window)) {
    return null;
  }

  const cache = await caches.open(SCHEMA_IMAGE_CACHE_NAME);
  const cachedResponse = await cache.match(cacheKey);

  if (!cachedResponse) {
    return null;
  }

  return readJsonSafely(cachedResponse);
}

async function saveCachedSchemaImage(
  cacheKey: string,
  data: SchemaImageApiResponse,
) {
  if (!("caches" in window) || !data.imageUrl) {
    return;
  }

  const cache = await caches.open(SCHEMA_IMAGE_CACHE_NAME);

  await cache.put(
    cacheKey,
    new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
      },
    }),
  );
}

export default function TechnicalSchemaImage({
  context,
  title,
  subject,
  details,
  autoGenerate = false,
  className = "",
}: TechnicalSchemaImageProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [revisedPrompt, setRevisedPrompt] = useState("");
  const [cacheStatus, setCacheStatus] = useState<"new" | "cached" | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const generatedKeyRef = useRef("");

  const cleanedDetails = useMemo(() => {
    return details.replace(/\s+/g, " ").trim().slice(0, 3200);
  }, [details]);

  const generationKey = `${SCHEMA_IMAGE_PROMPT_VERSION}:${context}:${title}:${subject}:${cleanedDetails}`;
  const canGenerate = subject.trim().length >= 2 || cleanedDetails.length >= 8;

  const generateSchemaImage = useCallback(async () => {
    if (!canGenerate || loading) {
      return;
    }

    generatedKeyRef.current = generationKey;
    setLoading(true);
    setError("");

    try {
      const cacheKey = await createCacheKey(generationKey);
      const cachedImage = await loadCachedSchemaImage(cacheKey);

      if (cachedImage?.imageUrl) {
        setImageUrl(cachedImage.imageUrl);
        setRevisedPrompt(cachedImage.revisedPrompt || "");
        setCacheStatus("cached");
        return;
      }

      const response = await fetch("/api/schema-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context,
          title,
          subject,
          details: cleanedDetails,
        }),
      });

      const data = await readJsonSafely(response);

      if (!response.ok || !data.imageUrl) {
        throw new Error(
          data.error || "Schema-Grafik konnte nicht erstellt werden.",
        );
      }

      setImageUrl(data.imageUrl);
      setRevisedPrompt(data.revisedPrompt || "");
      setCacheStatus("new");
      await saveCachedSchemaImage(cacheKey, data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Schema-Grafik konnte nicht erstellt werden.",
      );
    } finally {
      setLoading(false);
    }
  }, [canGenerate, cleanedDetails, context, generationKey, loading, subject, title]);

  useEffect(() => {
    if (!autoGenerate || !canGenerate || generatedKeyRef.current === generationKey) {
      return;
    }

    void generateSchemaImage();
  }, [autoGenerate, canGenerate, generateSchemaImage, generationKey]);

  return (
    <section
      className={`rounded-3xl border border-blue-500/20 bg-blue-500/10 p-5 shadow-sm print:hidden ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
            {getContextLabel(context)}
          </p>

          <h3 className="mt-2 text-lg font-black text-slate-950 dark:text-slate-100">
            Technische Schema-Grafik
          </h3>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700 dark:text-slate-300">
            Visueller Werkstatt-Prüfplan mit Prüfreihenfolge, Messpunkten,
            Entscheidungspfaden und Fehlerstellen. Die Grafik nutzt stabile
            Marker statt fehleranfaelliger Bild-Texte; die Erklärung steht
            hier in der App. Wird lokal im Browser-Cache gespeichert, nicht in
            der Datenbank.
          </p>

          <SchemaMarkerLegend />
        </div>

        <button
          type="button"
          onClick={() => void generateSchemaImage()}
          disabled={!canGenerate || loading}
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Schema wird erzeugt..." : getActionLabel(context)}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-5 aspect-video w-full animate-pulse rounded-2xl border border-blue-500/20 bg-slate-200 dark:bg-slate-800" />
      )}

      {imageUrl && !loading && (
        <figure className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <Image
            src={imageUrl}
            alt={`Technische Schema-Grafik: ${subject || title}`}
            width={1024}
            height={576}
            unoptimized
            className="aspect-video w-full object-contain"
          />

          {(revisedPrompt || cacheStatus) && (
            <figcaption className="border-t border-slate-200 p-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              {cacheStatus === "cached"
                ? "Aus lokalem Cache geladen. Keine neue Bild-API-Anfrage."
                : "Neu erstellt und lokal für schnelleres Nachladen gespeichert."}
            </figcaption>
          )}
        </figure>
      )}
    </section>
  );
}
