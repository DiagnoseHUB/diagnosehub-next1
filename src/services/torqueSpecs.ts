export type TorqueSpecStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "blocked"
  | "outdated";

export type TorqueSpecSafetyLevel =
  | "normal"
  | "important"
  | "safety_critical"
  | "engine_critical"
  | "high_voltage";

export type TorqueSpecRow = {
  id: string;
  user_id: string | null;
  manufacturer: string | null;
  model: string | null;
  series: string | null;
  year_from: number | null;
  year_to: number | null;
  engine_code: string | null;
  transmission_code: string | null;
  drive_type: string | null;
  system_group: string | null;
  component: string | null;
  fastener: string | null;
  position: string | null;
  torque_nm: number | string;
  torque_angle_deg: number | string | null;
  torque_sequence: string | null;
  new_fastener_required: boolean | null;
  thread_condition: string | null;
  safety_level: TorqueSpecSafetyLevel | null;
  note: string | null;
  source_type: string | null;
  source_reference: string | null;
  source_note: string | null;
  status: TorqueSpecStatus | null;
  visibility: string | null;
  review_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TorqueSpec = {
  id: string;
  userId: string | null;
  manufacturer: string;
  model: string;
  series: string;
  yearFrom: number | null;
  yearTo: number | null;
  engineCode: string;
  transmissionCode: string;
  driveType: string;
  systemGroup: string;
  component: string;
  fastener: string;
  position: string;
  torqueNm: number;
  torqueAngleDeg: number | null;
  torqueSequence: string;
  newFastenerRequired: boolean;
  threadCondition: string;
  safetyLevel: TorqueSpecSafetyLevel;
  note: string;
  sourceType: string;
  sourceReference: string;
  sourceNote: string;
  status: TorqueSpecStatus;
  visibility: string;
  reviewComment: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TorqueSpecInput = {
  id?: unknown;
  manufacturer?: unknown;
  model?: unknown;
  series?: unknown;
  yearFrom?: unknown;
  yearTo?: unknown;
  engineCode?: unknown;
  transmissionCode?: unknown;
  driveType?: unknown;
  systemGroup?: unknown;
  component?: unknown;
  fastener?: unknown;
  position?: unknown;
  torqueNm?: unknown;
  torqueAngleDeg?: unknown;
  torqueSequence?: unknown;
  newFastenerRequired?: unknown;
  threadCondition?: unknown;
  safetyLevel?: unknown;
  note?: unknown;
  sourceType?: unknown;
  sourceReference?: unknown;
  sourceNote?: unknown;
  reviewComment?: unknown;
  submitForReview?: unknown;
  action?: unknown;
};

export type TorqueSpecContext = {
  foundSpecs: TorqueSpec[];
  summary: string;
};

export const TORQUE_SPEC_STATUS_LABELS: Record<TorqueSpecStatus, string> = {
  draft: "Entwurf",
  pending_review: "Zur Prüfung",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  blocked: "Gesperrt",
  outdated: "Veraltet",
};

export const TORQUE_SPEC_SAFETY_LABELS: Record<TorqueSpecSafetyLevel, string> = {
  normal: "Normal",
  important: "Wichtig",
  safety_critical: "Sicherheitsrelevant",
  engine_critical: "Motorkritisch",
  high_voltage: "Hochvolt",
};

const TORQUE_INTENT_TERMS = [
  "Drehmoment",
  "Anzugsmoment",
  "anziehen",
  "anziehen?",
  "anziehen mit",
  "Nm",
  "Newtonmeter",
  "Drehwinkel",
  "Schraube",
  "Schrauben",
  "Mutter",
  "Muttern",
  "Befestigung",
  "Dehnschraube",
  "festziehen",
  "lösen",
  "Einbau",
  "Montage",
];

function toText(value: unknown, maxLength = 160) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function toNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return Math.round(numberValue);
}

function toNullablePositiveNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(String(value).replace(",", "."));

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null;
  }

  return Math.round(numberValue * 100) / 100;
}

function normalizeSafetyLevel(value: unknown): TorqueSpecSafetyLevel {
  if (
    value === "normal" ||
    value === "important" ||
    value === "safety_critical" ||
    value === "engine_critical" ||
    value === "high_voltage"
  ) {
    return value;
  }

  return "important";
}

function normalizeStatus(value: unknown): TorqueSpecStatus {
  if (
    value === "draft" ||
    value === "pending_review" ||
    value === "approved" ||
    value === "rejected" ||
    value === "blocked" ||
    value === "outdated"
  ) {
    return value;
  }

  return "draft";
}

function normalizeTorqueSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTorqueToken(value: string) {
  return normalizeTorqueSearchText(value).replace(/\s+/g, "");
}

function numberFromDatabase(value: number | string | null | undefined) {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function scoreTextField(input: string, compactInput: string, value: string, weight: number) {
  const normalizedValue = normalizeTorqueSearchText(value);
  const compactValue = normalizeTorqueToken(value);

  if (!normalizedValue || !compactValue) {
    return 0;
  }

  if (input.includes(normalizedValue) || compactInput.includes(compactValue)) {
    return weight;
  }

  return 0;
}

function formatVehicleRange(spec: TorqueSpec) {
  const parts = [
    spec.manufacturer,
    spec.model,
    spec.series,
    spec.engineCode ? `Motor ${spec.engineCode}` : "",
    spec.transmissionCode ? `Getriebe ${spec.transmissionCode}` : "",
  ].filter(Boolean);

  const yearRange =
    spec.yearFrom || spec.yearTo
      ? `${spec.yearFrom ?? "?"}-${spec.yearTo ?? "?"}`
      : "";

  if (yearRange) {
    parts.push(`Baujahr ${yearRange}`);
  }

  return parts.length ? parts.join(" ") : "fahrzeugübergreifend hinterlegt";
}

export function toTorqueSpec(row: TorqueSpecRow): TorqueSpec {
  return {
    id: row.id,
    userId: row.user_id,
    manufacturer: row.manufacturer || "",
    model: row.model || "",
    series: row.series || "",
    yearFrom: row.year_from ?? null,
    yearTo: row.year_to ?? null,
    engineCode: row.engine_code || "",
    transmissionCode: row.transmission_code || "",
    driveType: row.drive_type || "",
    systemGroup: row.system_group || "",
    component: row.component || "",
    fastener: row.fastener || "",
    position: row.position || "",
    torqueNm: numberFromDatabase(row.torque_nm),
    torqueAngleDeg: row.torque_angle_deg === null ? null : numberFromDatabase(row.torque_angle_deg),
    torqueSequence: row.torque_sequence || "",
    newFastenerRequired: Boolean(row.new_fastener_required),
    threadCondition: row.thread_condition || "",
    safetyLevel: normalizeSafetyLevel(row.safety_level),
    note: row.note || "",
    sourceType: row.source_type || "",
    sourceReference: row.source_reference || "",
    sourceNote: row.source_note || "",
    status: normalizeStatus(row.status),
    visibility: row.visibility || "private",
    reviewComment: row.review_comment || "",
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildTorqueSpecInsertPayload(userId: string, input: TorqueSpecInput) {
  const torqueNm = toNullablePositiveNumber(input.torqueNm);
  const torqueAngleDeg = toNullablePositiveNumber(input.torqueAngleDeg);
  const submitForReview = input.submitForReview === true;

  return {
    user_id: userId,
    manufacturer: toText(input.manufacturer, 80),
    model: toText(input.model, 80),
    series: toText(input.series, 80),
    year_from: toNullableInteger(input.yearFrom),
    year_to: toNullableInteger(input.yearTo),
    engine_code: toText(input.engineCode, 80),
    transmission_code: toText(input.transmissionCode, 80),
    drive_type: toText(input.driveType, 80),
    system_group: toText(input.systemGroup, 100),
    component: toText(input.component, 140),
    fastener: toText(input.fastener, 140),
    position: toText(input.position, 140),
    torque_nm: torqueNm,
    torque_angle_deg: torqueAngleDeg,
    torque_sequence: toText(input.torqueSequence, 500),
    new_fastener_required: input.newFastenerRequired === true,
    thread_condition: toText(input.threadCondition, 120),
    safety_level: normalizeSafetyLevel(input.safetyLevel),
    note: toText(input.note, 900),
    source_type: toText(input.sourceType, 120) || "Herstellerdaten",
    source_reference: toText(input.sourceReference, 240),
    source_note: toText(input.sourceNote, 900),
    status: submitForReview ? "pending_review" : "draft",
    visibility: "private",
  };
}

export function buildTorqueSpecUpdatePayload(input: TorqueSpecInput) {
  const updatePayload: Record<string, string | number | boolean | null> = {};

  if ("manufacturer" in input) updatePayload.manufacturer = toText(input.manufacturer, 80);
  if ("model" in input) updatePayload.model = toText(input.model, 80);
  if ("series" in input) updatePayload.series = toText(input.series, 80);
  if ("yearFrom" in input) updatePayload.year_from = toNullableInteger(input.yearFrom);
  if ("yearTo" in input) updatePayload.year_to = toNullableInteger(input.yearTo);
  if ("engineCode" in input) updatePayload.engine_code = toText(input.engineCode, 80);
  if ("transmissionCode" in input) {
    updatePayload.transmission_code = toText(input.transmissionCode, 80);
  }
  if ("driveType" in input) updatePayload.drive_type = toText(input.driveType, 80);
  if ("systemGroup" in input) updatePayload.system_group = toText(input.systemGroup, 100);
  if ("component" in input) updatePayload.component = toText(input.component, 140);
  if ("fastener" in input) updatePayload.fastener = toText(input.fastener, 140);
  if ("position" in input) updatePayload.position = toText(input.position, 140);
  if ("torqueNm" in input) updatePayload.torque_nm = toNullablePositiveNumber(input.torqueNm);
  if ("torqueAngleDeg" in input) {
    updatePayload.torque_angle_deg = toNullablePositiveNumber(input.torqueAngleDeg);
  }
  if ("torqueSequence" in input) {
    updatePayload.torque_sequence = toText(input.torqueSequence, 500);
  }
  if ("newFastenerRequired" in input) {
    updatePayload.new_fastener_required = input.newFastenerRequired === true;
  }
  if ("threadCondition" in input) {
    updatePayload.thread_condition = toText(input.threadCondition, 120);
  }
  if ("safetyLevel" in input) {
    updatePayload.safety_level = normalizeSafetyLevel(input.safetyLevel);
  }
  if ("note" in input) updatePayload.note = toText(input.note, 900);
  if ("sourceType" in input) {
    updatePayload.source_type = toText(input.sourceType, 120) || "Herstellerdaten";
  }
  if ("sourceReference" in input) {
    updatePayload.source_reference = toText(input.sourceReference, 240);
  }
  if ("sourceNote" in input) updatePayload.source_note = toText(input.sourceNote, 900);

  if (input.submitForReview === true) {
    updatePayload.status = "pending_review";
  }

  updatePayload.visibility = "private";

  return updatePayload;
}

export function validateTorqueSpecPayload(
  payload: ReturnType<typeof buildTorqueSpecInsertPayload> | ReturnType<typeof buildTorqueSpecUpdatePayload>,
  submitForReview: boolean
) {
  if (!payload.system_group) {
    return "Baugruppe fehlt.";
  }

  if (!payload.component) {
    return "Bauteil fehlt.";
  }

  if (!payload.fastener) {
    return "Schraubstelle fehlt.";
  }

  if (!payload.torque_nm || Number(payload.torque_nm) <= 0) {
    return "Drehmoment in Nm fehlt.";
  }

  if (submitForReview && !payload.source_reference) {
    return "Für die Prüfung ist eine Quellenangabe nötig.";
  }

  return "";
}

export function getTorqueSpecId(input: TorqueSpecInput) {
  return typeof input.id === "string" ? input.id : "";
}

export function getTorqueSpecAction(input: TorqueSpecInput) {
  return typeof input.action === "string" ? input.action : "";
}

export function getTorqueReviewComment(input: TorqueSpecInput) {
  return toText(input.reviewComment, 900);
}

export function hasTorqueSpecIntent(input: string) {
  const normalizedInput = normalizeTorqueSearchText(input);

  if (!normalizedInput) {
    return false;
  }

  return TORQUE_INTENT_TERMS.some((term) =>
    normalizedInput.includes(normalizeTorqueSearchText(term))
  );
}

export function formatTorqueValue(spec: TorqueSpec) {
  const baseValue = `${spec.torqueNm.toLocaleString("de-DE", {
    maximumFractionDigits: 2,
  })} Nm`;

  if (!spec.torqueAngleDeg) {
    return baseValue;
  }

  return `${baseValue} + ${spec.torqueAngleDeg.toLocaleString("de-DE", {
    maximumFractionDigits: 1,
  })}°`;
}

export function formatTorqueSpecTitle(spec: TorqueSpec) {
  const location = [spec.component, spec.fastener, spec.position]
    .filter(Boolean)
    .join(" / ");

  return location || "Drehmomentwert";
}

export function scoreTorqueSpec(spec: TorqueSpec, input: string) {
  const normalizedInput = normalizeTorqueSearchText(input);
  const compactInput = normalizeTorqueToken(input);
  let score = 0;

  score += scoreTextField(normalizedInput, compactInput, spec.manufacturer, 7);
  score += scoreTextField(normalizedInput, compactInput, spec.model, 8);
  score += scoreTextField(normalizedInput, compactInput, spec.series, 5);
  score += scoreTextField(normalizedInput, compactInput, spec.engineCode, 10);
  score += scoreTextField(normalizedInput, compactInput, spec.transmissionCode, 6);
  score += scoreTextField(normalizedInput, compactInput, spec.systemGroup, 6);
  score += scoreTextField(normalizedInput, compactInput, spec.component, 12);
  score += scoreTextField(normalizedInput, compactInput, spec.fastener, 14);
  score += scoreTextField(normalizedInput, compactInput, spec.position, 5);

  if (!spec.manufacturer && !spec.model && !spec.engineCode) {
    score += 2;
  }

  return score;
}

export function detectTorqueSpecContext(
  input: string,
  specs: TorqueSpec[],
  limit = 4
): TorqueSpecContext {
  if (!hasTorqueSpecIntent(input) || specs.length === 0) {
    return {
      foundSpecs: [],
      summary: "Keine freigegebenen Drehmomentwerte erkannt.",
    };
  }

  const foundSpecs = specs
    .filter((spec) => spec.status === "approved")
    .map((spec) => ({
      spec,
      score: scoreTorqueSpec(spec, input),
    }))
    .filter((entry) => entry.score >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.spec);

  return {
    foundSpecs,
    summary: foundSpecs.length
      ? `Erkannte freigegebene Drehmomentwerte: ${foundSpecs
          .map((spec) => formatTorqueSpecTitle(spec))
          .join(", ")}.`
      : "Keine freigegebenen Drehmomentwerte erkannt.",
  };
}

export function formatTorqueSpecContext(context: TorqueSpecContext) {
  if (context.foundSpecs.length === 0) {
    return "Keine passenden freigegebenen Drehmomentwerte erkannt.";
  }

  return context.foundSpecs
    .map((spec) => {
      const details = [
        `Fahrzeugbezug: ${formatVehicleRange(spec)}`,
        `Baugruppe: ${spec.systemGroup}`,
        `Bauteil/Schraubstelle: ${formatTorqueSpecTitle(spec)}`,
        `Drehmoment: ${formatTorqueValue(spec)}`,
        spec.torqueSequence ? `Reihenfolge: ${spec.torqueSequence}` : "",
        spec.threadCondition ? `Gewinde/Zustand: ${spec.threadCondition}` : "",
        spec.newFastenerRequired ? "Neue Schraube/Mutter erforderlich: ja" : "",
        `Sicherheitsstufe: ${TORQUE_SPEC_SAFETY_LABELS[spec.safetyLevel]}`,
        `Quelle: ${spec.sourceType}${spec.sourceReference ? `, ${spec.sourceReference}` : ""}`,
        spec.note ? `Hinweis: ${spec.note}` : "",
      ].filter(Boolean);

      return details.join("\n");
    })
    .join("\n\n---\n\n");
}

export function formatTorqueSpecContextForPrompt(context: TorqueSpecContext) {
  if (context.foundSpecs.length === 0) {
    return "";
  }

  return `Manuell geprüfte und freigegebene Drehmomentwerte aus der gemeinsamen DiagnoseHUB-Datenbank:
${formatTorqueSpecContext(context)}

Wichtig: Diese Drehmomentwerte dürfen sichtbar genannt werden, weil sie manuell freigegeben wurden. Nicht passende oder nicht hinterlegte Drehmomente nicht raten. Wenn Fahrzeugdaten fehlen, den Wert nur mit dem hinterlegten Fahrzeugbezug nennen.`;
}
