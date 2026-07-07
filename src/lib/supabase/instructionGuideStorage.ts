import type { InstructionGuide } from "@/types/instruction";
import { createSupabaseAdminClient } from "./supabaseAdmin";

type InstructionGuideDatabaseRow = {
  id: string;
  slug: string;
  source_query: string;
  source_type: string;
  title: string;
  subtitle: string;
  category: InstructionGuide["category"];
  difficulty: InstructionGuide["difficulty"];
  estimated_time: string;
  vehicle_applicability: string;
  tags: string[];
  symptoms: string[];
  tools: string[];
  safety_notes: string[];
  initial_checks: string[];
  steps: InstructionGuide["steps"];
  common_causes: string[];
  next_actions: string[];
  pro_hint: string | null;
  last_updated: string;
  created_at: string;
  updated_at: string;
};

type SimilarInstructionGuideMatch = {
  guide: InstructionGuide;
  score: number;
  matchedTerms: string[];
};

function mapDatabaseRowToInstructionGuide(
  row: InstructionGuideDatabaseRow
): InstructionGuide {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    difficulty: row.difficulty,
    estimatedTime: row.estimated_time,
    vehicleApplicability: row.vehicle_applicability,
    tags: Array.isArray(row.tags) ? row.tags : [],
    symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
    tools: Array.isArray(row.tools) ? row.tools : [],
    safetyNotes: Array.isArray(row.safety_notes) ? row.safety_notes : [],
    initialChecks: Array.isArray(row.initial_checks) ? row.initial_checks : [],
    steps: Array.isArray(row.steps) ? row.steps : [],
    commonCauses: Array.isArray(row.common_causes) ? row.common_causes : [],
    nextActions: Array.isArray(row.next_actions) ? row.next_actions : [],
    proHint: row.pro_hint || undefined,
    lastUpdated: row.last_updated,
  };
}

export async function loadSavedInstructionGuides(limit = 100) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("instruction_guides")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Gespeicherte Anleitungen konnten nicht geladen werden: ${error.message}`
    );
  }

  return ((data || []) as InstructionGuideDatabaseRow[]).map(
    mapDatabaseRowToInstructionGuide
  );
}

export async function loadSavedInstructionGuideBySlug(slug: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("instruction_guides")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Gespeicherte Anleitung konnte nicht geladen werden: ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  return mapDatabaseRowToInstructionGuide(data as InstructionGuideDatabaseRow);
}

export async function saveInstructionGuideToDatabase(
  guide: InstructionGuide,
  sourceQuery: string,
  sourceType: "ai" | "diagnosis" | "manual" = "ai"
) {
  const supabase = createSupabaseAdminClient();

  const now = new Date().toISOString();

  const payload = {
    slug: guide.slug,
    source_query: sourceQuery,
    source_type: sourceType,

    title: guide.title,
    subtitle: guide.subtitle,
    category: guide.category,
    difficulty: guide.difficulty,
    estimated_time: guide.estimatedTime,
    vehicle_applicability: guide.vehicleApplicability,

    tags: guide.tags || [],
    symptoms: guide.symptoms || [],
    tools: guide.tools || [],
    safety_notes: guide.safetyNotes || [],
    initial_checks: guide.initialChecks || [],
    steps: guide.steps || [],
    common_causes: guide.commonCauses || [],
    next_actions: guide.nextActions || [],

    pro_hint: guide.proHint || null,
    last_updated: guide.lastUpdated || now.slice(0, 10),
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("instruction_guides")
    .upsert(payload, {
      onConflict: "slug",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `KI-Anleitung konnte nicht gespeichert werden: ${error.message}`
    );
  }

  return mapDatabaseRowToInstructionGuide(data as InstructionGuideDatabaseRow);
}

const stopWords = new Set([
  "anleitung",
  "wechseln",
  "wechsel",
  "tauschen",
  "ersetzen",
  "reparieren",
  "machen",
  "durchführen",
  "durchführen",
  "am",
  "an",
  "bei",
  "mit",
  "für",
  "für",
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "einer",
  "und",
  "oder",
  "ausbau",
  "ausbauen",
  "einbau",
  "einbauen",
  "demontage",
  "demontieren",
  "montage",
  "montieren",
  "von",
  "zum",
  "zur",
  "im",
  "in",
  "auf",
  "defekt",
  "problem",
  "fehler",
  "auto",
  "fahrzeug",
  "kfz",
  "schritt",
  "schritte",
]);

const synonymMap: Record<string, string> = {
  oel: "oel",

  motoroel: "oelwechsel",
  oelwechsel: "oelwechsel",
  oelservice: "oelwechsel",
  motorservice: "oelwechsel",
  serviceoel: "oelwechsel",

  oelfilter: "oelfilter",

  radwechsel: "reifenwechsel",
  raederwechsel: "reifenwechsel",
  reifenwechsel: "reifenwechsel",
  sommerreifen: "reifenwechsel",
  winterreifen: "reifenwechsel",
  rad: "reifen",
  raeder: "reifen",

  steuertrieb: "steuerkette",
  kettenwechsel: "steuerkette",
  steuerkettenwechsel: "steuerkette",
  kette: "steuerkette",
  steuerkette: "steuerkette",

  riemenwechsel: "zahnriemen",
  zahnriemenwechsel: "zahnriemen",
  zahnriemen: "zahnriemen",

  bremse: "bremse",
  bremsen: "bremse",
  bremsbelag: "bremse",
  bremsbelaege: "bremse",
  bremsscheibe: "bremse",
  bremsscheiben: "bremse",

  klima: "klimaanlage",
  klimaanlage: "klimaanlage",
  kaeltemittel: "klimaanlage",
  kompressor: "klimaanlage",

  turbo: "turbolader",
  turbolader: "turbolader",
  ladedruck: "turbolader",

  vii: "7",
  vi: "6",
  v: "5",

  volkswagen: "vw",
  cupra: "seat",

  abgasrueckfuehrung: "agr",
  egr: "agr",
  agr: "agr",
  agrventil: "agr",

  lmm: "luftmassenmesser",
  luftmassenmesser: "luftmassenmesser",
  luftmassenmesserwert: "luftmassenmesser",

  ladeluftschlauch: "ladeluftstrecke",
  ladeluftrohr: "ladeluftstrecke",
  ladeluftkuehler: "ladeluftstrecke",
  ansaugschlauch: "ansaugsystem",
  ansaugtrakt: "ansaugsystem",
  falschluft: "ansaugsystem",

  geblaese: "innenraumluefter",
  geblaesemotor: "innenraumluefter",
  innenraumgeblaese: "innenraumluefter",
  innenraumluefter: "innenraumluefter",
  lueftermotor: "innenraumluefter",

  einspritzduese: "injektor",
  einspritzduesen: "injektor",
  injektor: "injektor",
  injektoren: "injektor",

  gluehkerze: "gluehkerze",
  gluehkerzen: "gluehkerze",
  zuendkerze: "zuendkerze",
  zuendkerzen: "zuendkerze",
  zuendspule: "zuendspule",
  zuendspulen: "zuendspule",

  thermostat: "thermostat",
  wasserpumpe: "wasserpumpe",
  kuehlmittelpumpe: "wasserpumpe",

  querlenker: "querlenker",
  traggelenk: "traggelenk",
  radlager: "radlager",
  raddrehzahlsensor: "abs-sensor",
  absgeber: "abs-sensor",
  abssensor: "abs-sensor",
};

const workTypeTokens = new Set([
  "oelwechsel",
  "oelfilter",
  "reifenwechsel",
  "steuerkette",
  "zahnriemen",
  "bremse",
  "klimaanlage",
  "turbolader",
  "agr",
  "luftmassenmesser",
  "ladeluftstrecke",
  "ansaugsystem",
  "innenraumluefter",
  "injektor",
  "gluehkerze",
  "zuendkerze",
  "zuendspule",
  "thermostat",
  "wasserpumpe",
  "querlenker",
  "traggelenk",
  "radlager",
  "abs-sensor",
]);

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
  const normalized = normalizeSearchText(value);

  return normalized
    .split(" ")
    .map(normalizeSearchToken)
    .filter((token) => token.length >= 2)
    .filter((token) => !stopWords.has(token));
}

function buildGuideSearchText(guide: InstructionGuide) {
  return [
    guide.title,
    guide.subtitle,
    guide.category,
    guide.difficulty,
    guide.estimatedTime,
    guide.vehicleApplicability,
    ...(guide.tags || []),
    ...(guide.symptoms || []),
    ...(guide.tools || []),
    ...(guide.initialChecks || []),
    ...(guide.steps || []).flatMap((step) => [
      step.title,
      step.description,
      step.check || "",
      step.warning || "",
      step.imageHint || "",
      step.imageAlt || "",
    ]),
    ...(guide.commonCauses || []),
    ...(guide.nextActions || []),
    guide.proHint || "",
  ].join(" ");
}

function hasCompatibleWorkType(queryTokens: string[], guideTokens: string[]) {
  const queryWorkTypes = queryTokens.filter((token) =>
    workTypeTokens.has(token)
  );

  if (queryWorkTypes.length === 0) {
    return true;
  }

  const guideTokenSet = new Set(guideTokens);

  return queryWorkTypes.some((token) => guideTokenSet.has(token));
}

function scoreInstructionGuideMatch(
  query: string,
  guide: InstructionGuide
): SimilarInstructionGuideMatch {
  const queryTokens = Array.from(new Set(tokenizeSearchText(query)));
  const guideTokens = Array.from(
    new Set(tokenizeSearchText(buildGuideSearchText(guide)))
  );
  const titleTokens = Array.from(new Set(tokenizeSearchText(guide.title)));

  if (queryTokens.length === 0) {
    return {
      guide,
      score: 0,
      matchedTerms: [],
    };
  }

  if (!hasCompatibleWorkType(queryTokens, guideTokens)) {
    return {
      guide,
      score: 0,
      matchedTerms: [],
    };
  }

  const guideTokenSet = new Set(guideTokens);
  const titleTokenSet = new Set(titleTokens);

  const matchedTerms = queryTokens.filter((token) => guideTokenSet.has(token));
  const matchedTitleTerms = queryTokens.filter((token) =>
    titleTokenSet.has(token)
  );

  const queryNormalized = normalizeSearchText(query);
  const titleNormalized = normalizeSearchText(guide.title);
  const guideNormalized = normalizeSearchText(buildGuideSearchText(guide));

  const generalOverlapScore =
    (matchedTerms.length / queryTokens.length) * 62;

  const titleOverlapScore =
    (matchedTitleTerms.length / queryTokens.length) * 28;

  const phraseScore =
    titleNormalized.includes(queryNormalized) ||
    queryNormalized.includes(titleNormalized)
      ? 20
      : guideNormalized.includes(queryNormalized)
        ? 10
        : 0;

  const workTypeBonus = matchedTerms.some((token) => workTypeTokens.has(token))
    ? 8
    : 0;

  const score = Math.min(
    100,
    Math.round(
      generalOverlapScore + titleOverlapScore + phraseScore + workTypeBonus
    )
  );

  return {
    guide,
    score,
    matchedTerms,
  };
}

export async function findSimilarSavedInstructionGuides(
  query: string,
  options?: {
    limit?: number;
    minScore?: number;
  }
) {
  const limit = options?.limit ?? 300;
  const minScore = options?.minScore ?? 64;

  const cleanedQuery = query.trim();

  if (!cleanedQuery) {
    return [];
  }

  const guides = await loadSavedInstructionGuides(limit);

  const matches = guides
    .map((guide) => scoreInstructionGuideMatch(cleanedQuery, guide))
    .filter((match) => match.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return matches;
}
