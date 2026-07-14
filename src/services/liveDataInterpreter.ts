export type LiveDataSeverity = "ok" | "notice" | "warning" | "critical";

export type ParsedLiveDataRow = {
  id: string;
  label: string;
  rawValue: string;
  numericValue: number | null;
  unit: string;
  status: LiveDataSeverity;
  note: string;
};

export type LiveDataAnomaly = {
  label: string;
  severity: LiveDataSeverity;
  finding: string;
  nextCheck: string;
};

export type LiveDataInterpretation = {
  summary: string;
  rows: ParsedLiveDataRow[];
  anomalies: LiveDataAnomaly[];
  nextChecks: string[];
  limitations: string[];
};

type RuleResult = {
  status: LiveDataSeverity;
  note: string;
  nextCheck?: string;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss");
}

function parseNumber(value: string) {
  const numberMatch = value.match(/-?\d+(?:[.,]\d+)?/);

  if (!numberMatch) {
    return null;
  }

  const parsed = Number.parseFloat(numberMatch[0].replace(",", "."));

  return Number.isFinite(parsed) ? parsed : null;
}

function parseUnit(value: string) {
  const unitMatch = value.match(
    /\b(v|volt|a|ampere|ohm|kpa|bar|mbar|psi|grad|°c|celsius|rpm|u\/min|g\/s|mg\/hub|%|hz)\b/i,
  );

  return unitMatch?.[1] || "";
}

function createRowId(label: string, index: number) {
  return `${normalize(label).replace(/[^a-z0-9]+/g, "-") || "wert"}-${index}`;
}

function getGenericRule(label: string, value: number | null, unit: string): RuleResult {
  const text = normalize(`${label} ${unit}`);

  if (value === null) {
    return {
      status: "notice",
      note: "Wert erkannt, aber nicht sicher numerisch auswertbar.",
      nextCheck: "Einheit und Messbedingung ergänzen.",
    };
  }

  if (text.includes("batterie") || text.includes("bordspannung") || text.includes("spannung klemme 30")) {
    if (value < 11.8) {
      return {
        status: "critical",
        note: "Allgemeiner Richtwert: Bordspannung ist für Diagnose und Startversuche zu niedrig.",
        nextCheck: "Batterie laden, Spannungsabfall unter Last prüfen und Massepunkte kontrollieren.",
      };
    }

    if (value < 12.3) {
      return {
        status: "warning",
        note: "Allgemeiner Richtwert: Spannung ist schwach, Diagnose kann verfälscht werden.",
        nextCheck: "Batteriezustand und Ladespannung prüfen.",
      };
    }
  }

  if (text.includes("ladespannung") || text.includes("generator")) {
    if (value < 13.5) {
      return {
        status: "warning",
        note: "Allgemeiner Richtwert: Ladespannung wirkt zu niedrig.",
        nextCheck: "Generatoransteuerung, Riemen, Masse und Plusleitung prüfen.",
      };
    }

    if (value > 15.0) {
      return {
        status: "critical",
        note: "Allgemeiner Richtwert: Ladespannung wirkt zu hoch.",
        nextCheck: "Generatorregler und Batteriesensor plausibilisieren.",
      };
    }
  }

  if (text.includes("kuehlmittel") || text.includes("coolant")) {
    if (value < -20 || value > 125) {
      return {
        status: "warning",
        note: "Kühlmitteltemperatur wirkt unplausibel für normalen Betrieb.",
        nextCheck: "Temperaturfühler, Stecker, Referenzspannung und realen Motorzustand vergleichen.",
      };
    }
  }

  if (text.includes("ansaugluft") || text.includes("iat")) {
    if (value < -30 || value > 90) {
      return {
        status: "notice",
        note: "Ansauglufttemperatur wirkt nur mit Umgebung und Betriebszustand bewertbar.",
        nextCheck: "Umgebungstemperatur, Wärmestau und Sensorplausibilität vergleichen.",
      };
    }
  }

  if (text.includes("raildruck") || text.includes("kraftstoffdruck")) {
    if (value < 150 && (text.includes("start") || text.includes("crank"))) {
      return {
        status: "warning",
        note: "Allgemeiner Diesel-Richtwert: Raildruck beim Starten könnte zu niedrig sein.",
        nextCheck: "Niederdruckversorgung, Filter, Rücklaufmenge, Druckregelventil und Leckage prüfen.",
      };
    }
  }

  if (text.includes("ladedruck") || text.includes("boost")) {
    if (value < 900 && (unit.toLowerCase().includes("mbar") || !unit)) {
      return {
        status: "notice",
        note: "Ladedruck ohne Sollwert, Lastzustand und Atmosphärendruck nur eingeschränkt bewertbar.",
        nextCheck: "Soll/Ist unter Last loggen und Ladeluftstrecke, Ansteuerung und Sensor plausibilisieren.",
      };
    }
  }

  if (text.includes("differenzdruck") || text.includes("dpf")) {
    if (value > 80) {
      return {
        status: "warning",
        note: "Allgemeiner Richtwert: DPF-Differenzdruck wirkt erhöht, abhängig von Drehzahl und Last.",
        nextCheck: "Messung im Leerlauf und bei erhöhter Drehzahl wiederholen, Schläuche und Sensor prüfen.",
      };
    }
  }

  if (text.includes("short trim") || text.includes("stft") || text.includes("long trim") || text.includes("ltft") || text.includes("fuel trim")) {
    if (Math.abs(value) > 15) {
      return {
        status: "warning",
        note: "Allgemeiner Richtwert: Kraftstoffkorrektur ist auffällig.",
        nextCheck: "Falschluft, Kraftstoffdruck, Luftmasse, Lambdasonde und Abgasleck prüfen.",
      };
    }
  }

  if (text.includes("lambda")) {
    if (value < 0.8 || value > 1.2) {
      return {
        status: "notice",
        note: "Lambda-Wert ist ohne Regelzustand, Last und Sondentyp nur eingeschränkt bewertbar.",
        nextCheck: "Sondentyp, Regelaktivität und Fuel Trims gemeinsam prüfen.",
      };
    }
  }

  if (text.includes("luftmasse") || text.includes("lmm") || text.includes("maf")) {
    if (value <= 0) {
      return {
        status: "warning",
        note: "Luftmasse ist null oder negativ und damit verdächtig.",
        nextCheck: "LMM-Signal, Spannungsversorgung, Masse, Ansaugleck und Steckverbindung prüfen.",
      };
    }
  }

  return {
    status: "ok",
    note: "Kein grober Ausreißer mit allgemeinen Richtwerten erkannt.",
  };
}

export function parseLiveDataBlock(rawText: string): ParsedLiveDataRow[] {
  const lines = rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80);

  return lines.map((line, index) => {
    const parts = line.split(/[:;\t=]/).map((part) => part.trim()).filter(Boolean);
    const label = parts.length >= 2 ? parts[0] : `Messwert ${index + 1}`;
    const rawValue = parts.length >= 2 ? parts.slice(1).join(" ") : line;
    const numericValue = parseNumber(rawValue);
    const unit = parseUnit(rawValue) || parseUnit(label);
    const rule = getGenericRule(label, numericValue, unit);

    return {
      id: createRowId(label, index),
      label,
      rawValue,
      numericValue,
      unit,
      status: rule.status,
      note: rule.note,
    };
  });
}

export function interpretLiveData(rawText: string): LiveDataInterpretation {
  const rows = parseLiveDataBlock(rawText);
  const anomalies = rows
    .filter((row) => row.status !== "ok")
    .map((row) => {
      const rule = getGenericRule(row.label, row.numericValue, row.unit);

      return {
        label: row.label,
        severity: row.status,
        finding: row.note,
        nextCheck: rule.nextCheck || "Messbedingung, Sollwert und Plausibilität ergänzen.",
      };
    });
  const nextChecks = Array.from(
    new Set(
      anomalies.map((anomaly) => anomaly.nextCheck).concat([
        "Soll-/Istwerte immer mit Betriebszustand, Drehzahl, Last und Temperatur dokumentieren.",
        "Auffällige Werte nicht einzeln bewerten, sondern gegen Symptom, Fehlercode und Vorprüfung plausibilisieren.",
      ]),
    ),
  ).slice(0, 8);
  const criticalCount = anomalies.filter((item) => item.severity === "critical").length;
  const warningCount = anomalies.filter((item) => item.severity === "warning").length;

  return {
    summary:
      rows.length === 0
        ? "Keine Live-Daten erkannt."
        : criticalCount > 0
          ? `${rows.length} Messwerte erkannt, ${criticalCount} kritische Auffälligkeit(en).`
          : warningCount > 0
            ? `${rows.length} Messwerte erkannt, ${warningCount} auffällige Warnung(en).`
            : `${rows.length} Messwerte erkannt, keine groben Ausreißer nach allgemeinen Richtwerten.`,
    rows,
    anomalies,
    nextChecks,
    limitations: [
      "Die Bewertung nutzt allgemeine Richtwerte und ersetzt keine fahrzeuggenauen Hersteller-Solldaten.",
      "Werte ohne Betriebszustand, Temperatur, Last und Drehzahl sind nur eingeschränkt bewertbar.",
    ],
  };
}
