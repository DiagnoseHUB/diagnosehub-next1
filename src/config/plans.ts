export type UserPlan = "free" | "werkstatt" | "pro";

export type PremiumPlan = "werkstatt" | "pro";

export type PlanConfig = {
  label: string;
  badge: string;

  /**
   * Neues echtes Limit: KI-Anfragen pro Kalendermonat.
   * Diagnose + Folgefragen zählen beide.
   */
  monthlyDiagnosisLimit: number;

  /**
   * Kompatibilitätsfeld, damit bestehende Dateien nicht sofort brechen.
   * Wird technisch ebenfalls als Monatslimit genutzt.
   */
  dailyDiagnosisLimit: number;

  savedCaseLimit: number;
  description: string;
  features: string[];
};

export const PLAN_CONFIG: Record<UserPlan, PlanConfig> = {
  free: {
    label: "Free",
    badge: "Kostenlos",
    monthlyDiagnosisLimit: 3,
    dailyDiagnosisLimit: 3,
    savedCaseLimit: 3,
    description:
      "Für kurze Tests. Enthält 3 KI-Anfragen pro Monat inklusive Folgefragen.",
    features: [
      "3 KI-Anfragen pro Monat",
      "Folgefragen zählen mit",
      "3 gespeicherte Fälle",
      "Standard-Prüfprotokoll",
      "Basis-Fallbericht als TXT",
    ],
  },

  werkstatt: {
    label: "Werkstatt Demo",
    badge: "Premium Demo",
    monthlyDiagnosisLimit: 100,
    dailyDiagnosisLimit: 100,
    savedCaseLimit: 25,
    description:
      "Kostenloser Demo-/Testzugang für ausgewählte Werkstätten.",
    features: [
      "100 KI-Anfragen pro Monat",
      "Folgefragen zählen mit",
      "25 gespeicherte Fälle",
      "Individuelle Prüfprotokolle",
      "Erweiterte Fehlercode-Logik",
    ],
  },

  pro: {
    label: "Werkstatt Pro",
    badge: "Pro",
    monthlyDiagnosisLimit: 9999,
    dailyDiagnosisLimit: 9999,
    savedCaseLimit: 100,
    description:
      "Vollzugang für Werkstätten mit hoher Nutzung und erweiterten Funktionen.",
    features: [
      "Sehr hohes KI-Monatslimit",
      "Folgefragen inklusive",
      "100 gespeicherte Fälle",
      "Pro-Funktionen",
      "Mehr Werkstattfunktionen vorbereitet",
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

export const PLAN_MONTHLY_LIMITS: Record<UserPlan, number> = {
  free: PLAN_CONFIG.free.monthlyDiagnosisLimit,
  werkstatt: PLAN_CONFIG.werkstatt.monthlyDiagnosisLimit,
  pro: PLAN_CONFIG.pro.monthlyDiagnosisLimit,
};

/**
 * Kompatibilität für alte Imports.
 * Bedeutet ab jetzt technisch Monatslimit, nicht Tageslimit.
 */
export const PLAN_DAILY_LIMITS: Record<UserPlan, number> = {
  free: PLAN_CONFIG.free.monthlyDiagnosisLimit,
  werkstatt: PLAN_CONFIG.werkstatt.monthlyDiagnosisLimit,
  pro: PLAN_CONFIG.pro.monthlyDiagnosisLimit,
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

export function getMonthlyDiagnosisLimit(plan: UserPlan) {
  return PLAN_CONFIG[plan].monthlyDiagnosisLimit;
}

/**
 * Kompatibilität für alte Stellen.
 * Bedeutet ab jetzt Monatslimit.
 */
export function getDailyDiagnosisLimit(plan: UserPlan) {
  return PLAN_CONFIG[plan].monthlyDiagnosisLimit;
}

export function getSavedCaseLimit(plan: UserPlan) {
  return PLAN_CONFIG[plan].savedCaseLimit;
}