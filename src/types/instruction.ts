export type InstructionCategory =
  | "Motor"
  | "Elektrik"
  | "Klima"
  | "Fahrwerk"
  | "Bremse"
  | "Diagnose";

export type InstructionDifficulty = "leicht" | "mittel" | "schwer";

export type InstructionStep = {
  title: string;
  description: string;
  check?: string;
  warning?: string;
  measurement?: string;
  expectedResult?: string;
  decision?: string;
  qualityCheck?: string;
  imageHint?: string;
  imageAlt?: string;
  imageUrl?: string;
};

export type InstructionGuide = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: InstructionCategory;
  difficulty: InstructionDifficulty;
  estimatedTime: string;
  vehicleApplicability: string;
  tags: string[];
  diagnosisGoal?: string;
  missingVehicleData?: string[];
  requiredSkill?: string;
  escalationCriteria?: string[];
  symptoms: string[];
  tools: string[];
  partsAndMaterials?: string[];
  safetyNotes: string[];
  initialChecks: string[];
  measurementPlan?: string[];
  steps: InstructionStep[];
  commonCauses: string[];
  nextActions: string[];
  finalChecks?: string[];
  proHint?: string;
  lastUpdated: string;
};
