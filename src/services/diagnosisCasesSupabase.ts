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

export type SavedDiagnosisCase = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  engineContext: EngineContext | null;
  faultCodeContext: FaultCodeContext | null;
  qualityCheck: string;
};

export type DiagnosisCaseDatabaseRow = {
  id: string;
  user_id: string;
  title: string;
  messages: ChatMessage[];
  engine_context: EngineContext | null;
  fault_code_context: FaultCodeContext | null;
  quality_check: string;
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
