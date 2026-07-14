import type { SupabaseClient, User } from "@supabase/supabase-js";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  audienceMode?: "workshop" | "hobby";
};

export type EngineContext = {
  engineType: string;
  source: string;
  label: string;
  code: string | null;
  notes?: string;
};

export type FaultCodeInfo = {
  code: string;
  title: string;
  system: string;
  description: string;
  typicalCauses: string[];
  suggestedChecks: string[];
};

export type FaultCodeContext = {
  foundCodes: FaultCodeInfo[];
  summary: string;
};

export type DiagnosisWorkspace = {
  symptoms?: Array<{
    id: string;
    text: string;
    createdAt: string;
  }>;
  measurements?: Array<{
    id: string;
    label: string;
    value: string;
    unit: string;
    note: string;
    createdAt: string;
  }>;
  mediaAssets?: Array<{
    id: string;
    name: string;
    mediaType: "image" | "video";
    mimeType: string;
    sizeBytes: number;
    analysisText?: string;
    createdAt: string;
  }>;
  mediaAnalyses?: Array<{
    id: string;
    summary: string;
    analysis: Record<string, unknown>;
    createdAt: string;
  }>;
  guidedSteps?: Array<{
    id: string;
    title: string;
    prompt: string;
    why: string;
    passNext: string;
    failNext: string;
    status: "open" | "passed" | "failed" | "skipped";
    resultNote?: string;
    createdAt: string;
  }>;
  liveData?: Array<{
    id: string;
    summary: string;
    rows: unknown[];
    anomalies: unknown[];
    nextChecks: string[];
    createdAt: string;
  }>;
  knowledgeStatus?: "none" | "draft" | "saved" | "archived";
};

export type SavedDiagnosisCase = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  engineContext: EngineContext | null;
  faultCodeContext: FaultCodeContext | null;
  qualityCheck: string;
  workspace?: DiagnosisWorkspace;
};

export type DiagnosisCaseDatabaseRow = {
  id: string;
  user_id: string;
  title: string;
  messages: ChatMessage[];
  engine_context: EngineContext | null;
  fault_code_context: FaultCodeContext | null;
  quality_check: string;
  workspace?: DiagnosisWorkspace | null;
  created_at: string;
  updated_at: string;
};

export function convertDatabaseRowToSavedCase(
  row: DiagnosisCaseDatabaseRow
): SavedDiagnosisCase {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages: row.messages || [],
    engineContext: row.engine_context || null,
    faultCodeContext: row.fault_code_context || null,
    qualityCheck: row.quality_check || "",
    workspace: row.workspace || {},
  };
}

export function convertSavedCaseToDatabasePayload(
  savedCase: SavedDiagnosisCase,
  user: User
) {
  return {
    id: savedCase.id,
    user_id: user.id,
    title: savedCase.title,
    messages: savedCase.messages,
    engine_context: savedCase.engineContext,
    fault_code_context: savedCase.faultCodeContext,
    quality_check: savedCase.qualityCheck,
    workspace: savedCase.workspace || {},
  };
}

export async function loadDiagnosisCasesFromSupabase(
  supabase: SupabaseClient,
  user: User
): Promise<SavedDiagnosisCase[]> {
  const { data, error } = await supabase
    .from("diagnosis_cases")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as DiagnosisCaseDatabaseRow[]).map(
    convertDatabaseRowToSavedCase
  );
}

export async function saveDiagnosisCaseToSupabase(
  supabase: SupabaseClient,
  user: User,
  savedCase: SavedDiagnosisCase
): Promise<SavedDiagnosisCase> {
  const payload = convertSavedCaseToDatabasePayload(savedCase, user);

  const { data, error } = await supabase
    .from("diagnosis_cases")
    .upsert(payload, {
      onConflict: "id",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return convertDatabaseRowToSavedCase(data as DiagnosisCaseDatabaseRow);
}

export async function deleteDiagnosisCaseFromSupabase(
  supabase: SupabaseClient,
  user: User,
  caseId: string
): Promise<void> {
  const { error } = await supabase
    .from("diagnosis_cases")
    .delete()
    .eq("id", caseId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function migrateLocalDiagnosisCasesToSupabase(
  supabase: SupabaseClient,
  user: User,
  localCases: SavedDiagnosisCase[]
): Promise<SavedDiagnosisCase[]> {
  if (localCases.length === 0) {
    return [];
  }

  const payload = localCases.map((savedCase) => {
    return convertSavedCaseToDatabasePayload(savedCase, user);
  });

  const { data, error } = await supabase
    .from("diagnosis_cases")
    .upsert(payload, {
      onConflict: "id",
    })
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as DiagnosisCaseDatabaseRow[]).map(
    convertDatabaseRowToSavedCase
  );
}
