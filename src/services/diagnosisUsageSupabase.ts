import type { SupabaseClient, User } from "@supabase/supabase-js";

export type DiagnosisUsage = {
  /**
   * Ab jetzt kein Tagesdatum mehr, sondern Monatsschlüssel.
   * Beispiel: 2026-07-01
   */
  date: string;
  count: number;
};

type DiagnosisUsageDatabaseRow = {
  id: string;
  user_id: string;
  usage_date: string;
  diagnosis_count: number;
  created_at: string;
  updated_at: string;
};

function getCurrentDateGermany() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Kompatibilitätsname bleibt erhalten.
 * Bedeutet ab jetzt: aktueller Monats-Key.
 *
 * Beispiel:
 * 2026-07-01
 */
export function getTodayKey() {
  const currentDateGermany = getCurrentDateGermany();
  const currentMonth = currentDateGermany.slice(0, 7);

  return `${currentMonth}-01`;
}

export function getCurrentMonthKey() {
  return getTodayKey();
}

export function getInitialDiagnosisUsage(): DiagnosisUsage {
  return {
    date: getTodayKey(),
    count: 0,
  };
}

export function normalizeDiagnosisUsage(usage: DiagnosisUsage): DiagnosisUsage {
  const currentMonthKey = getTodayKey();

  if (!usage || usage.date !== currentMonthKey) {
    return {
      date: currentMonthKey,
      count: 0,
    };
  }

  return {
    date: usage.date,
    count: Number.isFinite(Number(usage.count)) ? Number(usage.count) : 0,
  };
}

function convertDatabaseRowToDiagnosisUsage(
  row: DiagnosisUsageDatabaseRow
): DiagnosisUsage {
  return normalizeDiagnosisUsage({
    date: row.usage_date,
    count: row.diagnosis_count,
  });
}

export async function loadDiagnosisUsageFromSupabase(
  supabase: SupabaseClient,
  user: User
): Promise<DiagnosisUsage> {
  const currentMonthKey = getTodayKey();

  const { data, error } = await supabase
    .from("diagnosis_usage")
    .select("*")
    .eq("user_id", user.id)
    .eq("usage_date", currentMonthKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return {
      date: currentMonthKey,
      count: 0,
    };
  }

  return convertDatabaseRowToDiagnosisUsage(data as DiagnosisUsageDatabaseRow);
}

export async function saveDiagnosisUsageToSupabase(
  supabase: SupabaseClient,
  user: User,
  usage: DiagnosisUsage
): Promise<DiagnosisUsage> {
  const normalizedUsage = normalizeDiagnosisUsage(usage);

  const { data, error } = await supabase
    .from("diagnosis_usage")
    .upsert(
      {
        user_id: user.id,
        usage_date: normalizedUsage.date,
        diagnosis_count: normalizedUsage.count,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,usage_date",
      }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return convertDatabaseRowToDiagnosisUsage(data as DiagnosisUsageDatabaseRow);
}

export async function incrementDiagnosisUsageInSupabase(
  supabase: SupabaseClient,
  user: User
): Promise<DiagnosisUsage> {
  const currentUsage = await loadDiagnosisUsageFromSupabase(supabase, user);

  const nextUsage: DiagnosisUsage = {
    date: currentUsage.date,
    count: currentUsage.count + 1,
  };

  return saveDiagnosisUsageToSupabase(supabase, user, nextUsage);
}
