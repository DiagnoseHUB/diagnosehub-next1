import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  SIGNAL_CATEGORIES,
  findSignalLibraryEntries,
  type SignalChannel,
  type SignalFaultPattern,
  type SignalLibraryCategory,
  type SignalLibraryEntry,
  type SignalReferenceValue,
} from "@/services/signalLibrary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignalLibraryDatabaseRow = {
  id: string;
  slug: string;
  title: string;
  category: SignalLibraryCategory;
  system_group: string;
  signal_type: string;
  summary: string;
  when_to_use: string[];
  measurement_setup: string[];
  expected_pattern: string;
  reference_values: SignalReferenceValue[];
  common_faults: SignalFaultPattern[];
  safety_notes: string[];
  next_checks: string[];
  channels: SignalChannel[];
  tags: string[];
  source_note: string;
  updated_at: string;
};

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMissingDatabaseObject(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const supabaseError = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  const message = [supabaseError.message, supabaseError.details]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();

  return (
    supabaseError.code === "42P01" ||
    supabaseError.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function mapDatabaseRow(row: SignalLibraryDatabaseRow): SignalLibraryEntry {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    systemGroup: row.system_group,
    signalType: row.signal_type,
    summary: row.summary,
    whenToUse: Array.isArray(row.when_to_use) ? row.when_to_use : [],
    measurementSetup: Array.isArray(row.measurement_setup)
      ? row.measurement_setup
      : [],
    expectedPattern: row.expected_pattern,
    referenceValues: Array.isArray(row.reference_values)
      ? row.reference_values
      : [],
    commonFaults: Array.isArray(row.common_faults) ? row.common_faults : [],
    safetyNotes: Array.isArray(row.safety_notes) ? row.safety_notes : [],
    nextChecks: Array.isArray(row.next_checks) ? row.next_checks : [],
    channels: Array.isArray(row.channels) ? row.channels : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    sourceNote: row.source_note,
    updatedAt: row.updated_at,
  };
}

function entryMatchesQuery(entry: SignalLibraryEntry, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  const terms = normalizedQuery.split(" ").filter((term) => term.length >= 2);

  if (terms.length === 0) {
    return true;
  }

  const haystack = normalizeSearchText(
    [
      entry.title,
      entry.category,
      entry.systemGroup,
      entry.signalType,
      entry.summary,
      entry.expectedPattern,
      ...entry.whenToUse,
      ...entry.measurementSetup,
      ...entry.nextChecks,
      ...entry.tags,
      ...entry.commonFaults.flatMap((fault) => [
        fault.title,
        fault.symptom,
        fault.signalClue,
        fault.nextCheck,
      ]),
    ].join(" "),
  );

  return terms.every((term) => haystack.includes(term));
}

async function loadSignalEntriesFromDatabase(query: string, category: string) {
  const supabase = createSupabaseAdminClient();
  let request = supabase
    .from("oscilloscope_signal_library")
    .select("*")
    .eq("status", "approved")
    .order("category", { ascending: true })
    .order("title", { ascending: true })
    .limit(200);

  if (category && category !== "Alle") {
    request = request.eq("category", category);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return ((data || []) as SignalLibraryDatabaseRow[])
    .map(mapDatabaseRow)
    .filter((entry) => entryMatchesQuery(entry, query));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "Alle";

  try {
    const entries = await loadSignalEntriesFromDatabase(query, category);

    if (entries.length > 0) {
      return NextResponse.json({
        categories: SIGNAL_CATEGORIES,
        entries,
        source: "database",
      });
    }
  } catch (error) {
    if (!isMissingDatabaseObject(error)) {
      console.error("Signalbibliothek konnte nicht aus Supabase geladen werden:", error);
    }
  }

  return NextResponse.json({
    categories: SIGNAL_CATEGORIES,
    entries: findSignalLibraryEntries({ query, category }),
    source: "seed",
    warning:
      "Signalbibliothek nutzt gerade die mitgelieferten Referenzen. Für die mitwachsende Datenbank bitte die Migration 20260713_oscilloscope_signal_library.sql ausführen.",
  });
}
