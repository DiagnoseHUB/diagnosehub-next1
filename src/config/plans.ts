export type UserPlan =
  | "free"
  | "diagnose_150"
  | "complete_150"
  | "unlimited"
  | "werkstatt"
  | "pro";

export type PremiumPlan = Exclude<UserPlan, "free" | "diagnose_150">;

export type CheckoutPlan =
  | "diagnose_150"
  | "complete_150"
  | "unlimited"
  | "service_reminder";

export type PlanConfig = {
  label: string;
  badge: string;

  /**
   * Echtes Limit: KI-Anfragen pro Kalendermonat.
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
  learningAccess: boolean;
  componentKnowledgeAccess: boolean;
  serviceReminderAccess: boolean;
};

export const UNLIMITED_DIAGNOSIS_LIMIT = 999999;

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
    learningAccess: false,
    componentKnowledgeAccess: false,
    serviceReminderAccess: false,
  },

  diagnose_150: {
    label: "Diagnose 150",
    badge: "Diagnose",
    monthlyDiagnosisLimit: 150,
    dailyDiagnosisLimit: 150,
    savedCaseLimit: 150,
    description:
      "Für Nutzer, die vor allem technische KI-Diagnosen brauchen, ohne Lernportal und Bauteilwissen.",
    features: [
      "150 Diagnosefälle pro Monat",
      "Folgefragen zählen mit",
      "150 gespeicherte Fälle",
      "KI-Diagnose mit Prüfplan",
      "Kein Bauteilwissen und kein Lernportal",
    ],
    learningAccess: false,
    componentKnowledgeAccess: false,
    serviceReminderAccess: false,
  },

  complete_150: {
    label: "Komplett 150",
    badge: "Alles dabei",
    monthlyDiagnosisLimit: 150,
    dailyDiagnosisLimit: 150,
    savedCaseLimit: 150,
    description:
      "Für Werkstatt und private Schrauber mit Diagnose, Lernen, Bauteilwissen und Service-Erinnerung.",
    features: [
      "150 Diagnosefälle pro Monat",
      "Lernportal und Prüfungsfragen",
      "Bauteilwissen für Sensoren, Aktoren und Systeme",
      "Service-Erinnerung inklusive",
      "150 gespeicherte Fälle",
    ],
    learningAccess: true,
    componentKnowledgeAccess: true,
    serviceReminderAccess: true,
  },

  unlimited: {
    label: "Unlimited",
    badge: "Unbegrenzt",
    monthlyDiagnosisLimit: UNLIMITED_DIAGNOSIS_LIMIT,
    dailyDiagnosisLimit: UNLIMITED_DIAGNOSIS_LIMIT,
    savedCaseLimit: UNLIMITED_DIAGNOSIS_LIMIT,
    description:
      "Für hohe Nutzung mit unbegrenzten Diagnosefällen, Lernportal, Bauteilwissen und Service-Erinnerung.",
    features: [
      "Unbegrenzte Diagnosefälle",
      "Lernportal und Prüfungsfragen",
      "Bauteilwissen inklusive",
      "Service-Erinnerung inklusive",
      "Unbegrenzt gespeicherte Fälle",
    ],
    learningAccess: true,
    componentKnowledgeAccess: true,
    serviceReminderAccess: true,
  },

  werkstatt: {
    label: "Partner Zugang",
    badge: "Partner Zugang",
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
    learningAccess: true,
    componentKnowledgeAccess: true,
    serviceReminderAccess: true,
  },

  pro: {
    label: "Unlimited",
    badge: "Unbegrenzt",
    monthlyDiagnosisLimit: UNLIMITED_DIAGNOSIS_LIMIT,
    dailyDiagnosisLimit: UNLIMITED_DIAGNOSIS_LIMIT,
    savedCaseLimit: UNLIMITED_DIAGNOSIS_LIMIT,
    description:
      "Kompatibler Alt-Tarif. Wird wie Unlimited behandelt.",
    features: [
      "Unbegrenzte Diagnosefälle",
      "Lernportal und Prüfungsfragen",
      "Bauteilwissen inklusive",
      "Service-Erinnerung inklusive",
      "Unbegrenzt gespeicherte Fälle",
    ],
    learningAccess: true,
    componentKnowledgeAccess: true,
    serviceReminderAccess: true,
  },
};

export const PLAN_LABELS: Record<UserPlan, string> = {
  free: PLAN_CONFIG.free.label,
  diagnose_150: PLAN_CONFIG.diagnose_150.label,
  complete_150: PLAN_CONFIG.complete_150.label,
  unlimited: PLAN_CONFIG.unlimited.label,
  werkstatt: PLAN_CONFIG.werkstatt.label,
  pro: PLAN_CONFIG.pro.label,
};

export const PLAN_BADGES: Record<UserPlan, string> = {
  free: PLAN_CONFIG.free.badge,
  diagnose_150: PLAN_CONFIG.diagnose_150.badge,
  complete_150: PLAN_CONFIG.complete_150.badge,
  unlimited: PLAN_CONFIG.unlimited.badge,
  werkstatt: PLAN_CONFIG.werkstatt.badge,
  pro: PLAN_CONFIG.pro.badge,
};

export const PLAN_MONTHLY_LIMITS: Record<UserPlan, number> = {
  free: PLAN_CONFIG.free.monthlyDiagnosisLimit,
  diagnose_150: PLAN_CONFIG.diagnose_150.monthlyDiagnosisLimit,
  complete_150: PLAN_CONFIG.complete_150.monthlyDiagnosisLimit,
  unlimited: PLAN_CONFIG.unlimited.monthlyDiagnosisLimit,
  werkstatt: PLAN_CONFIG.werkstatt.monthlyDiagnosisLimit,
  pro: PLAN_CONFIG.pro.monthlyDiagnosisLimit,
};

/**
 * Kompatibilität für alte Imports.
 * Bedeutet ab jetzt technisch Monatslimit, nicht Tageslimit.
 */
export const PLAN_DAILY_LIMITS: Record<UserPlan, number> = {
  free: PLAN_CONFIG.free.monthlyDiagnosisLimit,
  diagnose_150: PLAN_CONFIG.diagnose_150.monthlyDiagnosisLimit,
  complete_150: PLAN_CONFIG.complete_150.monthlyDiagnosisLimit,
  unlimited: PLAN_CONFIG.unlimited.monthlyDiagnosisLimit,
  werkstatt: PLAN_CONFIG.werkstatt.monthlyDiagnosisLimit,
  pro: PLAN_CONFIG.pro.monthlyDiagnosisLimit,
};

export const PLAN_SAVED_CASE_LIMITS: Record<UserPlan, number> = {
  free: PLAN_CONFIG.free.savedCaseLimit,
  diagnose_150: PLAN_CONFIG.diagnose_150.savedCaseLimit,
  complete_150: PLAN_CONFIG.complete_150.savedCaseLimit,
  unlimited: PLAN_CONFIG.unlimited.savedCaseLimit,
  werkstatt: PLAN_CONFIG.werkstatt.savedCaseLimit,
  pro: PLAN_CONFIG.pro.savedCaseLimit,
};

export const SELECTABLE_USER_PLANS: UserPlan[] = [
  "free",
  "diagnose_150",
  "complete_150",
  "unlimited",
];

const LEARNING_PLAN_RANK: Record<UserPlan, number> = {
  free: 0,
  diagnose_150: 0,
  complete_150: 2,
  unlimited: 2,
  werkstatt: 2,
  pro: 2,
};

export function isValidUserPlan(value: unknown): value is UserPlan {
  return (
    value === "free" ||
    value === "diagnose_150" ||
    value === "complete_150" ||
    value === "unlimited" ||
    value === "werkstatt" ||
    value === "pro"
  );
}

export function normalizeUserPlan(value: unknown): UserPlan {
  return isValidUserPlan(value) ? value : "free";
}

export function isValidCheckoutPlan(value: unknown): value is CheckoutPlan {
  return (
    value === "diagnose_150" ||
    value === "complete_150" ||
    value === "unlimited" ||
    value === "service_reminder"
  );
}

export function checkoutPlanToUserPlan(plan: CheckoutPlan): UserPlan | null {
  if (plan === "service_reminder") {
    return null;
  }

  return plan;
}

export function getPlanConfig(plan: unknown) {
  return PLAN_CONFIG[normalizeUserPlan(plan)];
}

export function getPlanLabel(plan: unknown) {
  return getPlanConfig(plan).label;
}

export function getMonthlyDiagnosisLimit(plan: unknown) {
  return getPlanConfig(plan).monthlyDiagnosisLimit;
}

/**
 * Kompatibilität für alte Stellen.
 * Bedeutet ab jetzt Monatslimit.
 */
export function getDailyDiagnosisLimit(plan: unknown) {
  return getPlanConfig(plan).monthlyDiagnosisLimit;
}

export function getSavedCaseLimit(plan: unknown) {
  return getPlanConfig(plan).savedCaseLimit;
}

export function hasLearningAccess(plan: unknown) {
  return getPlanConfig(plan).learningAccess;
}

export function hasComponentKnowledgeAccess(plan: unknown) {
  return getPlanConfig(plan).componentKnowledgeAccess;
}

export function hasServiceReminderAccess(plan: unknown) {
  return getPlanConfig(plan).serviceReminderAccess;
}

export function hasPremiumAccess(plan: unknown) {
  return hasLearningAccess(plan) || hasComponentKnowledgeAccess(plan);
}

export function isUnlimitedPlan(plan: unknown) {
  return getPlanConfig(plan).monthlyDiagnosisLimit >= UNLIMITED_DIAGNOSIS_LIMIT;
}

export function canAccessRequiredPlan(
  userPlan: unknown,
  requiredPlan: unknown
) {
  const normalizedUserPlan = normalizeUserPlan(userPlan);

  if (!isValidUserPlan(requiredPlan)) {
    return false;
  }

  const normalizedRequiredPlan = requiredPlan;

  if (normalizedRequiredPlan === "free") {
    return true;
  }

  if (!hasLearningAccess(normalizedUserPlan)) {
    return false;
  }

  return (
    LEARNING_PLAN_RANK[normalizedUserPlan] >=
    LEARNING_PLAN_RANK[normalizedRequiredPlan]
  );
}
