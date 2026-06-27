export type UserPlan = "free" | "werkstatt" | "pro";

export type PremiumPlan = "werkstatt" | "pro";

export type PlanConfig = {
  label: string;
  badge: string;
  dailyDiagnosisLimit: number;
  savedCaseLimit: number;
  description: string;
  features: string[];
};

export const PLAN_CONFIG: Record<UserPlan, PlanConfig> = {
  free: {
    label: "Free",
    badge: "Kostenlos",
    dailyDiagnosisLimit: 3,
    savedCaseLimit: 3,
    description: "Für Tests und einzelne Diagnosefälle.",
    features: [
      "3 KI-Diagnosen pro Tag",
      "3 gespeicherte Fälle",
      "Standard-Prüfprotokoll",
      "Basis-Fallbericht als TXT",
    ],
  },
  werkstatt: {
    label: "Werkstatt Demo",
    badge: "Premium Demo",
    dailyDiagnosisLimit: 30,
    savedCaseLimit: 25,
    description: "Vorbereitung für den späteren Werkstatt-Zugang.",
    features: [
      "30 KI-Diagnosen pro Tag",
      "25 gespeicherte Fälle",
      "Individuelle Prüfprotokolle",
      "Erweiterte Fehlercode-Logik",
    ],
  },
  pro: {
    label: "Werkstatt Pro Demo",
    badge: "Pro Demo",
    dailyDiagnosisLimit: 100,
    savedCaseLimit: 100,
    description: "Vorbereitung für größere Betriebe.",
    features: [
      "100 KI-Diagnosen pro Tag",
      "100 gespeicherte Fälle",
      "Pro-Funktionen vorbereitet",
      "Mehrnutzer-Logik später möglich",
    ],
  },
};

export const PLAN_LABELS: Record<UserPlan, string> = {
  free: PLAN_CONFIG.free.label,
  werkstatt: PLAN_CONFIG.werkstatt.label,
  pro: PLAN_CONFIG.pro.label,
};

export const PLAN_BADGES: Record<UserPlan, string> = {
  free: PLAN_CONFIG.free.badge,
  werkstatt: PLAN_CONFIG.werkstatt.badge,
  pro: PLAN_CONFIG.pro.badge,
};

export const PLAN_DAILY_LIMITS: Record<UserPlan, number> = {
  free: PLAN_CONFIG.free.dailyDiagnosisLimit,
  werkstatt: PLAN_CONFIG.werkstatt.dailyDiagnosisLimit,
  pro: PLAN_CONFIG.pro.dailyDiagnosisLimit,
};

export const PLAN_SAVED_CASE_LIMITS: Record<UserPlan, number> = {
  free: PLAN_CONFIG.free.savedCaseLimit,
  werkstatt: PLAN_CONFIG.werkstatt.savedCaseLimit,
  pro: PLAN_CONFIG.pro.savedCaseLimit,
};

export function isValidUserPlan(value: unknown): value is UserPlan {
  return value === "free" || value === "werkstatt" || value === "pro";
}

export function getPlanConfig(plan: UserPlan) {
  return PLAN_CONFIG[plan];
}

export function getPlanLabel(plan: UserPlan) {
  return PLAN_CONFIG[plan].label;
}

export function getDailyDiagnosisLimit(plan: UserPlan) {
  return PLAN_CONFIG[plan].dailyDiagnosisLimit;
}

export function getSavedCaseLimit(plan: UserPlan) {
  return PLAN_CONFIG[plan].savedCaseLimit;
}