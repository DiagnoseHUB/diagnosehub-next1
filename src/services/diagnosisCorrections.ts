import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";

export type ApprovedDiagnosisCorrection = {
  id: string;
  title: string;
  sourceType: "diagnosis" | "instruction" | "learning" | "general";
  issueType:
    | "technical_error"
    | "safety_risk"
    | "missing_spec"
    | "unclear_wording"
    | "manufacturer_data_needed"
    | "wrong_priority";
  severity: "normal" | "important" | "safety_critical";
  caseContext: string;
  quotedText: string;
  approvedRule: string;
  matchKeywords: string[];
  reviewNotes: string;
};

type CorrectionDatabaseRow = {
  id: string;
  title: string;
  source_type: ApprovedDiagnosisCorrection["sourceType"];
  issue_type: ApprovedDiagnosisCorrection["issueType"];
  severity: ApprovedDiagnosisCorrection["severity"];
  case_context: string;
  quoted_text: string;
  approved_rule: string;
  match_keywords: string[] | null;
  review_notes: string;
};

const correctionStopWords = new Set([
  "der",
  "die",
  "das",
  "und",
  "oder",
  "mit",
  "ohne",
  "bei",
  "von",
  "zum",
  "zur",
  "im",
  "am",
  "an",
  "ein",
  "eine",
  "ist",
  "soll",
  "bitte",
]);

function mapCorrectionRow(row: CorrectionDatabaseRow): ApprovedDiagnosisCorrection {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    issueType: row.issue_type,
    severity: row.severity,
    caseContext: row.case_context,
    quotedText: row.quoted_text,
    approvedRule: row.approved_rule,
    matchKeywords: Array.isArray(row.match_keywords) ? row.match_keywords : [],
    reviewNotes: row.review_notes,
  };
}

export function normalizeCorrectionText(value: string) {
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

export function extractCorrectionKeywords(value: string, maxItems = 16) {
  const tokens = normalizeCorrectionText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !correctionStopWords.has(token));

  return Array.from(new Set(tokens)).slice(0, maxItems);
}

function scoreCorrectionMatch(input: string, correction: ApprovedDiagnosisCorrection) {
  const normalizedInput = normalizeCorrectionText(input);
  const keywords = correction.matchKeywords
    .map(normalizeCorrectionText)
    .filter(Boolean);

  if (keywords.length === 0) {
    return 0;
  }

  const matchedKeywords = keywords.filter((keyword) =>
    normalizedInput.includes(keyword)
  );

  const baseScore = (matchedKeywords.length / keywords.length) * 100;
  const severityBoost =
    correction.severity === "safety_critical"
      ? 16
      : correction.severity === "important"
        ? 8
        : 0;

  return Math.round(baseScore + severityBoost + matchedKeywords.length * 6);
}

function isMissingCorrectionTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  return (
    message.includes("diagnosis_correction_suggestions") ||
    message.includes("schema cache") ||
    message.includes("42P01")
  );
}

export async function loadApprovedDiagnosisCorrections(input: string) {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("diagnosis_correction_suggestions")
      .select(
        "id, title, source_type, issue_type, severity, case_context, quoted_text, approved_rule, match_keywords, review_notes"
      )
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(120);

    if (error) {
      throw error;
    }

    return ((data || []) as CorrectionDatabaseRow[])
      .map(mapCorrectionRow)
      .map((correction) => ({
        correction,
        score: scoreCorrectionMatch(input, correction),
      }))
      .filter((match) => match.score >= 24)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8)
      .map((match) => match.correction);
  } catch (error) {
    if (!isMissingCorrectionTableError(error)) {
      console.error("Fachkorrekturen konnten nicht geladen werden:", error);
    }

    return [];
  }
}

export function formatDiagnosisCorrectionsForPrompt(
  corrections: ApprovedDiagnosisCorrection[]
) {
  if (corrections.length === 0) {
    return "Keine passenden freigegebenen Fachkorrekturen gefunden.";
  }

  return corrections
    .map((correction, index) => {
      const context = correction.caseContext
        ? `\n  Kontext: ${correction.caseContext}`
        : "";
      const quote = correction.quotedText
        ? `\n  Korrigiert Aussage: "${correction.quotedText}"`
        : "";

      return `${index + 1}. ${correction.title} (${correction.severity})${context}${quote}
  Verbindliche Regel: ${correction.approvedRule}`;
    })
    .join("\n\n");
}
