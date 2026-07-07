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
  symptoms: string[];
  tools: string[];
  safetyNotes: string[];
  initialChecks: string[];
  steps: InstructionStep[];
  commonCauses: string[];
  nextActions: string[];
  proHint?: string;
  lastUpdated: string;
};
