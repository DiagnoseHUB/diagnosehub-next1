export type DiagnosisResult = {
  title: string;
  description: string;
  priority: string;
  probability: string;
  causes: string[];
  checks: string[];
};

export function getDiagnosis(input: string): DiagnosisResult {
  const text = input.toLowerCase();

  if (text.includes("p0299")) {
    return {
      title: "Fehlercode P0299",
      description: "Ladedruckregelgrenze unterschritten.",
      priority: "Hoch",
      probability: "85%",
      causes: [
        "Undichtigkeit im Ladeluftsystem",
        "Turboladerregelung fehlerhaft",
        "Unterdrucksystem prüfen",
        "Ladedrucksensor prüfen",
      ],
      checks: [
        "Fehlerspeicher vollständig auslesen",
        "Ladedruck Soll/Ist vergleichen",
        "Ladeluftstrecke abdrücken",
        "Unterdruckleitungen prüfen",
      ],
    };
  }

  if (text.includes("cdhb") || text.includes("ruckelt")) {
    return {
      title: "Audi/VW 1.8 TFSI CDHB – Ruckeln im Leerlauf",
      description: "Unruhiger Motorlauf oder Ruckeln hauptsächlich im Leerlauf.",
      priority: "Mittel",
      probability: "75%",
      causes: [
        "Kurbelgehäuseentlüftung/Falschluft prüfen",
        "Zündaussetzerzähler prüfen",
        "Einspritzventile prüfen",
        "Verkokung der Einlassventile möglich",
      ],
      checks: [
        "Fehlerspeicher auslesen",
        "Zündaussetzer pro Zylinder prüfen",
        "Kraftstoffdruck Soll/Ist vergleichen",
        "Ansaugsystem auf Falschluft prüfen",
      ],
    };
  }

  return {
    title: "Allgemeine Diagnose",
    description: "Noch keine spezifische Diagnose hinterlegt.",
    priority: "Unbekannt",
    probability: "—",
    causes: [
      "Fehlerspeicher vollständig auslesen",
      "Live-Daten prüfen",
      "Kraftstoffversorgung prüfen",
      "Zündung und Ansaugsystem prüfen",
    ],
    checks: [
      "Fehlerspeicher lesen",
      "Live-Daten erfassen",
      "Symptom reproduzieren",
      "Mechanische Grundprüfung durchführen",
    ],
  };
}