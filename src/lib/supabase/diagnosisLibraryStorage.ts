import { createSupabaseAdminClient } from "./supabaseAdmin";

export type DiagnosisLibraryEntry = {
  id: string;
  slug: string;
  sourceQuery: string;
  normalizedQuery: string;
  audienceMode: "workshop" | "hobby";
  title: string;
  category: "Motor" | "Elektrik" | "Klima" | "Fahrwerk" | "Bremse" | "Diagnose";
  systemGroup: string;
  faultCodes: string[];
  symptoms: string[];
  vehicleTerms: string[];
  tags: string[];
  answer: string;
  qualityNote: string;
  source: "seed" | "manual" | "ai_generated";
  status: "approved" | "needs_review" | "archived";
  hitCount: number;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type DiagnosisLibraryDatabaseRow = {
  id: string;
  slug: string;
  source_query: string;
  normalized_query: string;
  audience_mode: "workshop" | "hobby";
  title: string;
  category: DiagnosisLibraryEntry["category"];
  system_group: string;
  fault_codes: string[];
  symptoms: string[];
  vehicle_terms: string[];
  tags: string[];
  answer: string;
  quality_note: string;
  source: DiagnosisLibraryEntry["source"];
  status: DiagnosisLibraryEntry["status"];
  hit_count: number;
  last_used_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type SimilarDiagnosisLibraryMatch = {
  entry: DiagnosisLibraryEntry;
  score: number;
  matchedTerms: string[];
};

const stopWords = new Set([
  "diagnose",
  "fehler",
  "problem",
  "auto",
  "fahrzeug",
  "kfz",
  "motor",
  "bitte",
  "hilfe",
  "prüfen",
  "prüfe",
  "check",
  "machen",
  "was",
  "wie",
  "ist",
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "und",
  "oder",
  "mit",
  "ohne",
  "bei",
  "von",
  "im",
  "im",
  "am",
  "an",
  "zu",
  "zur",
  "zum",
]);

const synonymMap: Record<string, string> = {
  ladedruckfehler: "ladedruck",
  ladedruckregelung: "ladedruck",
  turbo: "turbolader",
  wastegate: "turbolader",
  vtg: "turbolader",

  agrventil: "agr",
  abgasrueckfuehrung: "agr",
  abgasruckfuhrung: "agr",

  luftmassenmesser: "lmm",
  luftmasse: "lmm",

  differenzdrucksensor: "dpf",
  partikelfilter: "dpf",
  dieselpartikelfilter: "dpf",

  fehlzuendung: "zündaussetzer",
  fehlzündung: "zündaussetzer",
  zuendaussetzer: "zündaussetzer",
  zundaussetzer: "zündaussetzer",
  misfire: "zündaussetzer",

  gemischadaption: "gemisch",
  fueltrim: "gemisch",
  trim: "gemisch",

  kaeltemittel: "kältemittel",
  klimaanlage: "klima",

  sensorik: "sensor",
  steckerproblem: "stecker",
  kabelproblem: "kabel",
};

function mapDatabaseRow(row: DiagnosisLibraryDatabaseRow): DiagnosisLibraryEntry {
  return {
    id: row.id,
    slug: row.slug,
    sourceQuery: row.source_query,
    normalizedQuery: row.normalized_query,
    audienceMode: row.audience_mode,
    title: row.title,
    category: row.category,
    systemGroup: row.system_group,
    faultCodes: Array.isArray(row.fault_codes) ? row.fault_codes : [],
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
    vehicleTerms: Array.isArray(row.vehicle_terms) ? row.vehicle_terms : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    answer: row.answer,
    qualityNote: row.quality_note,
    source: row.source,
    status: row.status,
    hitCount: row.hit_count || 0,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeDiagnosisLibraryText(value: string) {
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

function normalizeSearchToken(token: string) {
  const directToken = synonymMap[token] || token;

  if (directToken !== token || token.length <= 5) {
    return directToken;
  }

  const singularToken = token.replace(
    /(ungen|innen|chen|ern|en|er|es|e|n|s)$/g,
    ""
  );

  return synonymMap[singularToken] || singularToken || directToken;
}

function tokenizeSearchText(value: string) {
  return normalizeDiagnosisLibraryText(value)
    .split(" ")
    .map(normalizeSearchToken)
    .filter((token) => token.length >= 2)
    .filter((token) => !stopWords.has(token));
}

function buildEntrySearchText(entry: DiagnosisLibraryEntry) {
  return [
    entry.sourceQuery,
    entry.normalizedQuery,
    entry.title,
    entry.category,
    entry.systemGroup,
    ...(entry.faultCodes || []),
    ...(entry.symptoms || []),
    ...(entry.vehicleTerms || []),
    ...(entry.tags || []),
    entry.qualityNote,
  ].join(" ");
}

function extractFaultCodes(value: string) {
  return Array.from(new Set(value.toUpperCase().match(/\bP[0-9]{4}\b/g) || []));
}

function scoreDiagnosisLibraryMatch(
  query: string,
  entry: DiagnosisLibraryEntry
): SimilarDiagnosisLibraryMatch {
  const queryTokens = Array.from(new Set(tokenizeSearchText(query)));
  const entryTokens = Array.from(
    new Set(tokenizeSearchText(buildEntrySearchText(entry)))
  );
  const titleTokens = Array.from(new Set(tokenizeSearchText(entry.title)));
  const queryFaultCodes = extractFaultCodes(query);
  const entryFaultCodes = new Set(entry.faultCodes.map((code) => code.toUpperCase()));

  if (queryTokens.length === 0 && queryFaultCodes.length === 0) {
    return {
      entry,
      score: 0,
      matchedTerms: [],
    };
  }

  const entryTokenSet = new Set(entryTokens);
  const titleTokenSet = new Set(titleTokens);
  const matchedTerms = queryTokens.filter((token) => entryTokenSet.has(token));
  const matchedTitleTerms = queryTokens.filter((token) => titleTokenSet.has(token));
  const matchedFaultCodes = queryFaultCodes.filter((code) => entryFaultCodes.has(code));
  const queryNormalized = normalizeDiagnosisLibraryText(query);
  const entryNormalized = normalizeDiagnosisLibraryText(buildEntrySearchText(entry));

  const tokenScore =
    queryTokens.length > 0 ? (matchedTerms.length / queryTokens.length) * 45 : 0;
  const titleScore =
    queryTokens.length > 0
      ? (matchedTitleTerms.length / queryTokens.length) * 18
      : 0;
  const faultCodeScore =
    matchedFaultCodes.length > 0
      ? queryFaultCodes.length === matchedFaultCodes.length
        ? 42
        : 28
      : 0;
  const phraseScore = entryNormalized.includes(queryNormalized) ? 12 : 0;
  const modeScore = entry.audienceMode ? 6 : 0;

  return {
    entry,
    score: Math.min(
      100,
      Math.round(tokenScore + titleScore + faultCodeScore + phraseScore + modeScore)
    ),
    matchedTerms: Array.from(new Set([...matchedFaultCodes, ...matchedTerms])),
  };
}

export async function loadDiagnosisLibraryEntries(
  audienceMode: "workshop" | "hobby",
  limit = 1500
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("diagnosis_library")
    .select("*")
    .eq("audience_mode", audienceMode)
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Gespeicherte Diagnosen konnten nicht geladen werden: ${error.message}`
    );
  }

  return ((data || []) as DiagnosisLibraryDatabaseRow[]).map(mapDatabaseRow);
}

async function markDiagnosisLibraryEntryUsed(entry: DiagnosisLibraryEntry) {
  const supabase = createSupabaseAdminClient();

  await supabase
    .from("diagnosis_library")
    .update({
      hit_count: entry.hitCount + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", entry.id);
}

export async function findSimilarDiagnosisLibraryEntry(
  query: string,
  audienceMode: "workshop" | "hobby",
  options?: {
    limit?: number;
    minScore?: number;
  }
) {
  const cleanedQuery = query.trim();

  if (!cleanedQuery) {
    return null;
  }

  const entries = await loadDiagnosisLibraryEntries(
    audienceMode,
    options?.limit ?? 1500
  );
  const minScore = options?.minScore ?? 72;

  const bestMatch = entries
    .map((entry) => scoreDiagnosisLibraryMatch(cleanedQuery, entry))
    .filter((match) => match.score >= minScore)
    .sort((a, b) => b.score - a.score)[0];

  if (!bestMatch) {
    return null;
  }

  void markDiagnosisLibraryEntryUsed(bestMatch.entry);

  return bestMatch;
}
