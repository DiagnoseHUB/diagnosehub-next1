export type ServiceIntervalPreset = {
  id: string;
  label: string;
  aliases: string[];
  months: number;
  km: number;
  brakeFluidMonths: number;
  note: string;
};

export const DEFAULT_SERVICE_INTERVAL_PRESET: ServiceIntervalPreset = {
  id: "standard",
  label: "Standard-Pkw",
  aliases: [],
  months: 12,
  km: 15000,
  brakeFluidMonths: 24,
  note: "Allgemeiner Standardwert, wenn kein genauer Hersteller erkannt wurde.",
};

export const LONG_LIFE_SERVICE_INTERVAL_PRESET: ServiceIntervalPreset = {
  id: "longlife",
  label: "LongLife / flexibler Service",
  aliases: [],
  months: 24,
  km: 30000,
  brakeFluidMonths: 24,
  note: "Typischer LongLife-Rahmen nach Anzeige, abhängig von Ölqualität, Nutzung und Fahrzeug.",
};

export const SERVICE_INTERVAL_PRESETS: ServiceIntervalPreset[] = [
  {
    id: "vw-group",
    label: "VW / Audi / Seat / Skoda",
    aliases: ["vw", "volkswagen", "audi", "seat", "skoda", "škoda", "cupra"],
    months: 12,
    km: 15000,
    brakeFluidMonths: 24,
    note: "Konservativer Festintervall. Bei LongLife kann das Fahrzeug abweichen.",
  },
  {
    id: "bmw-mini",
    label: "BMW / MINI",
    aliases: ["bmw", "mini"],
    months: 24,
    km: 30000,
    brakeFluidMonths: 24,
    note: "Typischer CBS-Rahmen. Das Fahrzeug kann nach Zustand früher melden.",
  },
  {
    id: "mercedes",
    label: "Mercedes-Benz",
    aliases: ["mercedes", "benz", "amg", "smart"],
    months: 12,
    km: 25000,
    brakeFluidMonths: 24,
    note: "Typischer Assyst-Rahmen, je nach Modell und Nutzung abweichend.",
  },
  {
    id: "opel-ford",
    label: "Opel / Ford",
    aliases: ["opel", "vauxhall", "ford"],
    months: 12,
    km: 20000,
    brakeFluidMonths: 24,
    note: "Häufiger Service-Rahmen für viele Modelle.",
  },
  {
    id: "toyota-hyundai-kia",
    label: "Toyota / Hyundai / Kia",
    aliases: ["toyota", "lexus", "hyundai", "kia"],
    months: 12,
    km: 15000,
    brakeFluidMonths: 24,
    note: "Konservativer Jahresservice für viele Modelle.",
  },
  {
    id: "renault-stellantis",
    label: "Renault / Dacia / Peugeot / Citroën",
    aliases: [
      "renault",
      "dacia",
      "peugeot",
      "citroen",
      "citroën",
      "ds",
      "fiat",
      "alfa",
      "jeep",
    ],
    months: 12,
    km: 20000,
    brakeFluidMonths: 24,
    note: "Häufiger Richtwert für viele europäische Modelle.",
  },
  {
    id: "mazda-honda-nissan",
    label: "Mazda / Honda / Nissan",
    aliases: ["mazda", "honda", "nissan", "infiniti", "mitsubishi", "subaru"],
    months: 12,
    km: 20000,
    brakeFluidMonths: 24,
    note: "Häufiger Richtwert für viele asiatische Modelle.",
  },
  {
    id: "electric",
    label: "Elektrofahrzeug",
    aliases: ["tesla", "id.", "ioniq", "ev", "elektro", "electric"],
    months: 24,
    km: 0,
    brakeFluidMonths: 24,
    note: "Kein klassischer Ölservice. Fokus auf HU, Bremsflüssigkeit, Reifen und Filter.",
  },
];

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isLongLifeServiceText(value: string) {
  const normalizedValue = normalizeSearchValue(value);

  return [
    "longlife",
    "long life",
    "flexibel",
    "flex service",
    "flex-service",
    "variable",
    "wiv",
    "qg1",
    "wartungsintervallverlangerung",
  ].some((alias) => normalizedValue.includes(normalizeSearchValue(alias)));
}

export function findServiceIntervalPreset(
  value: string,
  options: { longLife?: boolean } = {},
) {
  const normalizedValue = normalizeSearchValue(value);

  if (options.longLife === true) {
    return LONG_LIFE_SERVICE_INTERVAL_PRESET;
  }

  if (options.longLife !== false && isLongLifeServiceText(value)) {
    return LONG_LIFE_SERVICE_INTERVAL_PRESET;
  }

  if (!normalizedValue) {
    return DEFAULT_SERVICE_INTERVAL_PRESET;
  }

  return (
    SERVICE_INTERVAL_PRESETS.find((preset) =>
      preset.aliases.some((alias) =>
        normalizedValue.includes(normalizeSearchValue(alias)),
      ),
    ) || DEFAULT_SERVICE_INTERVAL_PRESET
  );
}
