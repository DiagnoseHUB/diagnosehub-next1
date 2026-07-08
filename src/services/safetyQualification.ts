import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { InstructionGuide } from "@/types/instruction";

export type SafetyAccountType = "private" | "mechanic" | "workshop" | "admin";
export type SafetyUserRole =
  | "private"
  | "mechanic"
  | "workshop"
  | "hv_verified"
  | "admin";
export type QualificationLevel =
  | "none"
  | "self_declared"
  | "verified_workshop"
  | "hv_verified";
export type RiskClass = "green" | "yellow" | "orange" | "red" | "hv" | "black";
export type SafetyAccessDecision =
  | "allow"
  | "allow_with_warning"
  | "limited"
  | "block";

export type SafetyProfile = {
  userId: string;
  email: string;
  accountType: SafetyAccountType;
  role: SafetyUserRole;
  qualificationLevel: QualificationLevel;
  companyVerified: boolean;
  hvVerified: boolean;
  hvQualification: "none" | "hv1" | "hv2" | "hv3" | "other";
  riskAccessLevel: Exclude<RiskClass, "black">;
  termsSafetyAcceptedAt: string | null;
};

export type SafetyEvaluation = {
  profile: SafetyProfile;
  riskClass: RiskClass;
  decision: SafetyAccessDecision;
  warningType: "none" | "general" | "strong" | "hv" | "blocked";
  safetyBlock: string;
  allowedFullInstruction: boolean;
  limitedReason: string;
  blacklistReason: string;
};

type WorkshopSafetyProfileRow = {
  id: string;
  email: string | null;
  role: string | null;
  account_type?: string | null;
  qualification_level?: string | null;
  company_verified?: boolean | null;
  hv_qualification?: string | null;
  hv_verified?: boolean | null;
  terms_safety_accepted_at?: string | null;
  risk_access_level?: string | null;
};

const GENERAL_SAFETY_BLOCK =
  "Sicherheitshinweis: Diese Arbeit betrifft ein sicherheitsrelevantes Fahrzeugsystem. Fehlerhafte Arbeiten können zu schweren Personen- und Sachschäden führen. Die folgenden Informationen richten sich an fachkundige Personen und ersetzen keine Herstellervorgaben, keine Reparaturdatenbank und keine fachliche Verantwortung des Ausführenden. Arbeiten an Bremsanlage, Lenkung, Fahrwerk, Airbag-/Gurtstraffersystemen, Hochvoltkomponenten oder anderen sicherheitsrelevanten Systemen dürfen nur mit entsprechender Fachkunde, geeignetem Werkzeug, aktueller Herstellerinformation und abschließender Funktionsprüfung durchgeführt werden.";

const HV_SAFETY_BLOCK =
  "Hochvolt-Warnung: Arbeiten an Hochvolt-Systemen dürfen ausschließlich durch entsprechend qualifizierte Personen nach Herstellervorgaben und geltenden Sicherheitsregeln durchgeführt werden. Es besteht Lebensgefahr durch elektrischen Schlag, Lichtbogen, Restspannung und fehlerhafte Wiederinbetriebnahme. DiagnoseHUB stellt keine Hochvolt-Qualifikation dar. Ohne passende Hochvolt-Qualifikation dürfen keine Arbeiten am HV-System durchgeführt werden.";

const PRIVATE_LIMITED_RED_TEXT =
  "Diese Arbeit betrifft ein sicherheitsrelevantes System. Ich gebe dir deshalb keine Schritt-für-Schritt-Reparaturanleitung. Ich kann dir helfen, Symptome einzuordnen, mögliche Ursachen zu verstehen und zu entscheiden, ob das Fahrzeug noch bewegt werden sollte oder direkt in eine Werkstatt muss.";

const PRIVATE_LIMITED_HV_TEXT =
  "Diese Anfrage betrifft ein Hochvolt-System. Handlungsleitende Anleitungen zu Hochvolt-Arbeiten werden nur für Nutzer mit geprüfter Hochvolt-Qualifikation freigeschaltet. Ohne entsprechende Qualifikation besteht Lebensgefahr. Ich kann allgemeine Informationen zur Funktion des Systems geben und empfehlen, eine qualifizierte Hochvolt-Fachkraft einzubeziehen.";

function normalizeSafetyText(value: string) {
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

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(normalizeSafetyText(word)));
}

function normalizeAccountType(value: unknown): SafetyAccountType {
  if (
    value === "private" ||
    value === "mechanic" ||
    value === "workshop" ||
    value === "admin"
  ) {
    return value;
  }

  return "private";
}

function normalizeQualificationLevel(value: unknown): QualificationLevel {
  if (
    value === "none" ||
    value === "self_declared" ||
    value === "verified_workshop" ||
    value === "hv_verified"
  ) {
    return value;
  }

  return "none";
}

function normalizeHvQualification(value: unknown): SafetyProfile["hvQualification"] {
  if (
    value === "none" ||
    value === "hv1" ||
    value === "hv2" ||
    value === "hv3" ||
    value === "other"
  ) {
    return value;
  }

  return "none";
}

function normalizeRiskAccessLevel(value: unknown): SafetyProfile["riskAccessLevel"] {
  if (
    value === "green" ||
    value === "yellow" ||
    value === "orange" ||
    value === "red" ||
    value === "hv"
  ) {
    return value;
  }

  return "yellow";
}

function getAdminEmails() {
  return (
    process.env.SAFETY_ADMIN_EMAILS ||
    process.env.ADMIN_EMAILS ||
    process.env.DIAGNOSEHUB_OWNER_EMAIL ||
    ""
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isSafetyAdmin(profile: SafetyProfile) {
  return profile.role === "admin";
}

function roleFromProfile(row: WorkshopSafetyProfileRow | null, user: User): SafetyUserRole {
  const email = user.email?.trim().toLowerCase() || "";
  const accountType = normalizeAccountType(row?.account_type);
  const qualificationLevel = normalizeQualificationLevel(row?.qualification_level);
  const hvVerified = Boolean(row?.hv_verified);
  const legacyRole = normalizeSafetyText(row?.role || "");

  if (accountType === "admin" || getAdminEmails().includes(email)) {
    return "admin";
  }

  if (hvVerified && qualificationLevel === "hv_verified") {
    return "hv_verified";
  }

  if (accountType === "workshop") {
    return "workshop";
  }

  if (
    accountType === "mechanic" ||
    legacyRole.includes("geselle") ||
    legacyRole.includes("meister") ||
    legacyRole.includes("mechaniker") ||
    legacyRole.includes("fachkraft")
  ) {
    return "mechanic";
  }

  if (
    legacyRole.includes("werkstatt") ||
    legacyRole.includes("inhaber") ||
    legacyRole.includes("betrieb")
  ) {
    return "workshop";
  }

  return "private";
}

export async function loadSafetyProfile(
  supabase: SupabaseClient,
  user: User
): Promise<SafetyProfile> {
  const { data, error } = await supabase
    .from("workshop_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Sicherheitsprofil konnte nicht geladen werden: ${error.message}`);
  }

  const row = (data || null) as WorkshopSafetyProfileRow | null;
  const accountType = normalizeAccountType(row?.account_type);
  const role = roleFromProfile(row, user);
  const qualificationLevel = normalizeQualificationLevel(row?.qualification_level);

  return {
    userId: user.id,
    email: user.email || row?.email || "",
    accountType,
    role,
    qualificationLevel,
    companyVerified: Boolean(row?.company_verified),
    hvVerified: Boolean(row?.hv_verified) && qualificationLevel === "hv_verified",
    hvQualification: normalizeHvQualification(row?.hv_qualification),
    riskAccessLevel: normalizeRiskAccessLevel(row?.risk_access_level),
    termsSafetyAcceptedAt: row?.terms_safety_accepted_at || null,
  };
}

export function classifyInstructionRisk(input: string): RiskClass {
  const text = normalizeSafetyText(input);

  if (!text) {
    return "yellow";
  }

  if (
    includesAny(text, [
      "dpf entfernen",
      "dpf delete",
      "opf entfernen",
      "agr deaktivieren",
      "kat entfernen",
      "katalysator entfernen",
      "abgasmanipulation",
      "tuev umgehen",
      "au umgehen",
      "airbag deaktivieren",
      "gurtstraffer deaktivieren",
      "wegfahrsperre umgehen",
      "tacho manipulieren",
      "kilometerstand aendern",
      "diebstahl",
      "unbefugt oeffnen",
      "hv unter spannung",
      "hochvolt unter spannung",
    ])
  ) {
    return "black";
  }

  if (
    includesAny(text, [
      "hochvolt",
      "hv batterie",
      "hv-batterie",
      "inverter",
      "e maschine",
      "onboard lader",
      "orange leitung",
      "service disconnect",
      "hochvolt freischalten",
      "hv freischalten",
    ])
  ) {
    return "hv";
  }

  if (
    includesAny(text, [
      "airbag",
      "gurtstraffer",
      "bremse",
      "bremsbelag",
      "bremsscheibe",
      "bremssattel",
      "bremsleitung",
      "lenkung",
      "spurstange",
      "lenkgetriebe",
      "sicherheitsgurt",
      "pyrotechnik",
    ])
  ) {
    return "red";
  }

  if (
    includesAny(text, [
      "fahrwerk",
      "querlenker",
      "traggelenk",
      "radlager",
      "zahnriemen",
      "steuerkette",
      "steuertrieb",
      "kraftstoff",
      "injektor",
      "hochdruckpumpe",
      "klimaanlage",
      "kaeltemittel",
      "turbolader",
      "kupplung",
    ])
  ) {
    return "orange";
  }

  if (
    includesAny(text, [
      "batterie abklemmen",
      "12v batterie",
      "oelstand",
      "luftfilter",
      "innenraumfilter",
      "sensor wechseln",
      "zundkerze",
      "gluehkerze",
    ])
  ) {
    return "yellow";
  }

  if (
    includesAny(text, [
      "wischer",
      "scheibenwischer",
      "bedienung",
      "sichtpruefung",
      "lampe",
      "reifenluftdruck",
    ])
  ) {
    return "green";
  }

  return "yellow";
}

export function evaluateSafetyAccess(
  profile: SafetyProfile,
  riskClass: RiskClass
): SafetyEvaluation {
  if (riskClass === "black") {
    return {
      profile,
      riskClass,
      decision: "block",
      warningType: "blocked",
      safetyBlock: "",
      allowedFullInstruction: false,
      limitedReason: "",
      blacklistReason:
        "Diese Anfrage betrifft Inhalte, die DiagnoseHUB nicht ausgeben darf. Ich kann nur legale, sichere Diagnose- oder Reparaturalternativen erklären.",
    };
  }

  if (profile.role === "admin" || profile.role === "hv_verified") {
    return {
      profile,
      riskClass,
      decision: riskClass === "green" ? "allow" : "allow_with_warning",
      warningType: riskClass === "hv" ? "hv" : riskClass === "green" ? "none" : "general",
      safetyBlock: riskClass === "hv" ? HV_SAFETY_BLOCK : riskClass === "green" ? "" : GENERAL_SAFETY_BLOCK,
      allowedFullInstruction: true,
      limitedReason: "",
      blacklistReason: "",
    };
  }

  if (riskClass === "hv") {
    return {
      profile,
      riskClass,
      decision: "limited",
      warningType: "hv",
      safetyBlock: HV_SAFETY_BLOCK,
      allowedFullInstruction: false,
      limitedReason: PRIVATE_LIMITED_HV_TEXT,
      blacklistReason: "",
    };
  }

  if (profile.role === "private") {
    if (riskClass === "green") {
      return {
        profile,
        riskClass,
        decision: "allow",
        warningType: "none",
        safetyBlock: "",
        allowedFullInstruction: true,
        limitedReason: "",
        blacklistReason: "",
      };
    }

    if (riskClass === "yellow") {
      return {
        profile,
        riskClass,
        decision: "allow_with_warning",
        warningType: "general",
        safetyBlock:
          "Sicherheitshinweis: Auch einfache Wartungsarbeiten dürfen nur mit geeignetem Werkzeug, sicher abgestelltem Fahrzeug und passender Fahrzeugkenntnis durchgeführt werden. Bei Unsicherheit eine Fachperson einbeziehen.",
        allowedFullInstruction: true,
        limitedReason: "",
        blacklistReason: "",
      };
    }

    return {
      profile,
      riskClass,
      decision: "limited",
      warningType: riskClass === "red" ? "strong" : "general",
      safetyBlock: GENERAL_SAFETY_BLOCK,
      allowedFullInstruction: false,
      limitedReason:
        riskClass === "red"
          ? PRIVATE_LIMITED_RED_TEXT
          : "Diese Arbeit ist technisch anspruchsvoll oder potenziell sicherheitsrelevant. Ich gebe dir keine vollständige Reparaturanleitung, kann aber Symptome, mögliche Ursachen, Sichtprüfungen ohne Demontage und Werkstattfragen erklären.",
      blacklistReason: "",
    };
  }

  if (profile.role === "mechanic") {
    return {
      profile,
      riskClass,
      decision: riskClass === "green" || riskClass === "yellow" ? "allow" : "allow_with_warning",
      warningType: riskClass === "red" ? "strong" : riskClass === "green" || riskClass === "yellow" ? "none" : "general",
      safetyBlock: riskClass === "green" || riskClass === "yellow" ? "" : GENERAL_SAFETY_BLOCK,
      allowedFullInstruction: true,
      limitedReason: "",
      blacklistReason: "",
    };
  }

  return {
    profile,
    riskClass,
    decision: riskClass === "green" || riskClass === "yellow" || riskClass === "orange" ? "allow" : "allow_with_warning",
    warningType: riskClass === "red" ? "strong" : riskClass === "green" || riskClass === "yellow" ? "none" : "general",
    safetyBlock: riskClass === "green" || riskClass === "yellow" ? "" : GENERAL_SAFETY_BLOCK,
    allowedFullInstruction: true,
    limitedReason: "",
    blacklistReason: "",
  };
}

export function buildSafetyPrompt(evaluation: SafetyEvaluation) {
  if (evaluation.decision === "block") {
    return `
SICHERHEITSENTSCHEIDUNG:
- Risikoklasse: ${evaluation.riskClass}
- Ausgabe blockieren.
- Keine Reparaturanleitung, keine Umgehung, keine technischen Handlungsschritte ausgeben.
`;
  }

  if (evaluation.decision === "limited") {
    return `
SICHERHEITSENTSCHEIDUNG:
- Risikoklasse: ${evaluation.riskClass}
- Nutzerrolle: ${evaluation.profile.role}
- Keine vollständige Schritt-für-Schritt-Reparaturanleitung ausgeben.
- Erlaubt: Symptome, mögliche Ursachen, grobe Aufwandseinschätzung, Werkstattfragen, Sichtprüfung ohne Demontage, Hinweis wann das Fahrzeug nicht weiter bewegt werden sollte.
- Nicht erlaubt: Demontageschritte, Montageanleitung, Drehmomente, Freischaltanleitungen, sicherheitsrelevante Arbeiten.
- Begrenzungstext: ${evaluation.limitedReason}
`;
  }

  if (!evaluation.safetyBlock) {
    return `
SICHERHEITSENTSCHEIDUNG:
- Risikoklasse: ${evaluation.riskClass}
- Vollständige Anleitung erlaubt.
`;
  }

  return `
SICHERHEITSENTSCHEIDUNG:
- Risikoklasse: ${evaluation.riskClass}
- Nutzerrolle: ${evaluation.profile.role}
- Vollständige Anleitung erlaubt, aber Sicherheitsblock muss am Anfang sichtbar sein.
- Sicherheitsblock: ${evaluation.safetyBlock}
- Keine erfundenen Drehmomente, Herstellerwerte oder Spezialwerkzeugnummern.
- Endkontrolle, Herstellervorgaben und Dokumentation nennen, wenn sicherheitsrelevant.
`;
}

export function applySafetyToGuide(
  guide: InstructionGuide,
  evaluation: SafetyEvaluation
): InstructionGuide {
  if (!evaluation.safetyBlock) {
    return guide;
  }

  const safetyNotes = [
    evaluation.safetyBlock,
    ...(guide.safetyNotes || []).filter((note) => note !== evaluation.safetyBlock),
  ].slice(0, 6);

  const proHint = [
    evaluation.riskClass === "red"
      ? "Drehmomente, fahrzeugspezifische Vorgaben und Prüfschritte immer nach aktueller Herstellerinformation prüfen. Endkontrolle, Probefahrt und Dokumentation gehören zum Arbeitsabschluss."
      : "",
    evaluation.riskClass === "hv"
      ? "Hochvolt-Arbeiten nur mit geprüfter Qualifikation, passender Schutzausrüstung und Herstellervorgaben durchführen."
      : "",
    guide.proHint || "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ...guide,
    safetyNotes,
    proHint,
  };
}

export function createLimitedSafetyGuide(
  query: string,
  evaluation: SafetyEvaluation
): InstructionGuide {
  const now = new Date().toISOString().slice(0, 10);
  const title =
    evaluation.riskClass === "hv"
      ? `Hochvolt-Sicherheit: ${query}`
      : `Sicherheitsbegrenzte Einordnung: ${query}`;

  return {
    id: `safety-limited-${Date.now()}`,
    slug: `safety-limited-${Date.now()}`,
    title,
    subtitle: evaluation.limitedReason || evaluation.blacklistReason,
    category:
      evaluation.riskClass === "red"
        ? "Bremse"
        : evaluation.riskClass === "hv"
          ? "Elektrik"
          : "Diagnose",
    difficulty: "schwer",
    estimatedTime: "Werkstattabhängig",
    vehicleApplicability:
      "Sicherheitsbegrenzte Ausgabe. Für vollständige Arbeiten sind passende Qualifikation und Herstellerdaten nötig.",
    tags: ["Sicherheit", evaluation.riskClass, "Werkstattverweis"],
    symptoms: [
      "Geräusche, Warnlampen, Geruch, Vibrationen oder verändertes Fahrverhalten ernst nehmen.",
      "Bei Bremsen, Lenkung, Airbag, Fahrwerk oder Hochvolt keine Probefahrt erzwingen, wenn ein Sicherheitsrisiko besteht.",
    ],
    tools: ["Sichtprüfung ohne Demontage", "Notizen für Werkstattgespräch"],
    safetyNotes: [
      evaluation.safetyBlock || evaluation.limitedReason || evaluation.blacklistReason,
    ].filter(Boolean),
    initialChecks: [
      "Fahrzeugdaten, Fehlerbild und Zeitpunkt der Beanstandung notieren.",
      "Nur sichtbare Schäden, Flüssigkeitsverlust, lose Teile oder Warnanzeigen prüfen.",
      "Keine Demontage und keine Arbeit an sicherheitsrelevanten Bauteilen durchführen.",
    ],
    steps: [
      {
        title: "Symptome einordnen",
        description:
          "Beschreibe Geräusch, Warnmeldung, Geruch, Pedalgefühl, Lenkverhalten oder Fahrzustand möglichst genau.",
        check: "Zeitpunkt, Geschwindigkeit und Betriebszustand notieren.",
        warning: "Bei starkem Sicherheitsverdacht Fahrzeug nicht weiter bewegen.",
        imageHint: "Notizliste mit Warnsymbolen und Fahrzeugumriss.",
        imageAlt: "Symptome sicher dokumentieren.",
      },
      {
        title: "Sichtprüfung ohne Demontage",
        description:
          "Nur von außen sichtbare Schäden, Flüssigkeitsverlust, lose Teile, Rauch, Geruch oder beschädigte Leitungen prüfen.",
        check: "Keine Abdeckungen, Räder, Leitungen oder Sicherheitsbauteile demontieren.",
        warning: "Keine Arbeiten an Bremsen, Airbag, Hochvolt oder Lenkung durchführen.",
        imageHint: "Sichere Sichtprüfung am stehenden Fahrzeug.",
        imageAlt: "Sichtprüfung ohne Demontage.",
      },
      {
        title: "Werkstatt vorbereiten",
        description:
          "Fehlerbild, Fahrzeugdaten, Fotos ohne Demontage und bisherige Reparaturen für die Werkstatt vorbereiten.",
        check: "Fragen zu Weiterfahrt, Abschleppen und Prüfauftrag notieren.",
        warning: "",
        imageHint: "Werkstatt-Checkliste mit Fahrzeugdaten.",
        imageAlt: "Werkstattfragen vorbereiten.",
      },
    ],
    commonCauses: [
      "Verschleiß, Undichtigkeit, beschädigte Leitung, falscher Messwert oder mechanischer Schaden.",
      "Ein Fehlercode oder Symptom benennt nicht automatisch das defekte Bauteil.",
    ],
    nextActions: [
      "Qualifizierte Werkstatt oder Fachperson einbeziehen.",
      "Bei Brems-, Lenk-, Airbag-, Fahrwerks- oder Hochvoltverdacht Weiterfahrt vermeiden.",
      "Prüfumfang und Freigabe für Diagnose vorab klären.",
    ],
    proHint:
      "Aus Sicherheitsgründen wurde keine vollständige Reparaturanleitung ausgegeben.",
    lastUpdated: now,
  };
}

export async function logSafetyAccess(
  supabase: SupabaseClient,
  evaluation: SafetyEvaluation,
  input: {
    action: string;
    query: string;
    source: string;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("safety_access_logs").insert({
    user_id: evaluation.profile.userId,
    action: input.action,
    query: input.query.slice(0, 700),
    source: input.source,
    risk_class: evaluation.riskClass,
    access_decision: evaluation.decision,
    account_type: evaluation.profile.accountType,
    qualification_level: evaluation.profile.qualificationLevel,
    hv_verified: evaluation.profile.hvVerified,
    warning_type: evaluation.warningType,
    safety_warning: evaluation.safetyBlock || evaluation.limitedReason || evaluation.blacklistReason,
    metadata: input.metadata || {},
  });

  if (error) {
    console.error("Sicherheitslog konnte nicht gespeichert werden:", error);
  }
}
