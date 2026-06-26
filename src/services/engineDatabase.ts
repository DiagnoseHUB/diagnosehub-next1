export type EngineType = "Diesel" | "Benziner" | "Unbekannt";

export type EngineInfo = {
  code: string;
  engineType: EngineType;
  label: string;
  notes?: string;
};

export type EngineContext = {
  engineType: EngineType;
  source: string;
  label: string;
  code: string | null;
  notes?: string;
};

const ENGINE_CODE_DATABASE: Record<string, EngineInfo> = {
  CDHB: {
    code: "CDHB",
    engineType: "Benziner",
    label: "Audi/VW 1.8 TFSI Benziner",
    notes: "EA888 TFSI, Ottomotor mit Zündkerzen/Zündspulen.",
  },
  CDAA: {
    code: "CDAA",
    engineType: "Benziner",
    label: "Audi/VW 1.8 TFSI Benziner",
    notes: "EA888 TFSI, Ottomotor mit Zündkerzen/Zündspulen.",
  },
  CAWB: {
    code: "CAWB",
    engineType: "Benziner",
    label: "VW/Audi 2.0 TFSI Benziner",
    notes: "EA888 TFSI, Ottomotor mit Zündkerzen/Zündspulen.",
  },
  CCZA: {
    code: "CCZA",
    engineType: "Benziner",
    label: "VW/Audi 2.0 TFSI Benziner",
    notes: "EA888 TFSI, Ottomotor mit Zündkerzen/Zündspulen.",
  },
  CCTA: {
    code: "CCTA",
    engineType: "Benziner",
    label: "VW/Audi 2.0 TFSI Benziner",
    notes: "EA888 TFSI, Ottomotor mit Zündkerzen/Zündspulen.",
  },
  CAXA: {
    code: "CAXA",
    engineType: "Benziner",
    label: "VW/Audi 1.4 TSI Benziner",
    notes: "TSI-Ottomotor mit Zündkerzen/Zündspulen.",
  },
  CAVD: {
    code: "CAVD",
    engineType: "Benziner",
    label: "VW/Audi 1.4 TSI Benziner",
    notes: "TSI-Ottomotor mit Zündkerzen/Zündspulen.",
  },
  CHHB: {
    code: "CHHB",
    engineType: "Benziner",
    label: "VW/Audi 2.0 TSI Benziner",
    notes: "EA888 TSI, Ottomotor mit Zündkerzen/Zündspulen.",
  },
  CJSA: {
    code: "CJSA",
    engineType: "Benziner",
    label: "VW/Audi 1.8 TFSI Benziner",
    notes: "EA888 TFSI, Ottomotor mit Zündkerzen/Zündspulen.",
  },
  CJXA: {
    code: "CJXA",
    engineType: "Benziner",
    label: "VW/Audi 2.0 TSI Benziner",
    notes: "EA888 TSI, Ottomotor mit Zündkerzen/Zündspulen.",
  },
  CZEA: {
    code: "CZEA",
    engineType: "Benziner",
    label: "VW/Audi 1.4 TSI Benziner",
    notes: "EA211 TSI, Ottomotor mit Zündkerzen/Zündspulen.",
  },
  CZDA: {
    code: "CZDA",
    engineType: "Benziner",
    label: "VW/Audi 1.4 TSI Benziner",
    notes: "EA211 TSI, Ottomotor mit Zündkerzen/Zündspulen.",
  },
  CYVB: {
    code: "CYVB",
    engineType: "Benziner",
    label: "VW/Audi 1.2 TSI Benziner",
    notes: "EA211 TSI, Ottomotor mit Zündkerzen/Zündspulen.",
  },
  D14NEL: {
    code: "D14NEL",
    engineType: "Benziner",
    label: "Opel 1.4 Turbo Benziner",
    notes: "Opel Ottomotor mit Zündkerzen/Zündspule.",
  },
  A14NET: {
    code: "A14NET",
    engineType: "Benziner",
    label: "Opel 1.4 Turbo Benziner",
    notes: "Opel Ottomotor mit Zündkerzen/Zündspule.",
  },
  B14NET: {
    code: "B14NET",
    engineType: "Benziner",
    label: "Opel 1.4 Turbo Benziner",
    notes: "Opel Ottomotor mit Zündkerzen/Zündspule.",
  },
  N43B20: {
    code: "N43B20",
    engineType: "Benziner",
    label: "BMW N43 Benziner",
    notes: "BMW Ottomotor mit Zündkerzen/Zündspulen.",
  },
  N46B20: {
    code: "N46B20",
    engineType: "Benziner",
    label: "BMW N46 Benziner",
    notes: "BMW Ottomotor mit Zündkerzen/Zündspulen.",
  },
  N52B25: {
    code: "N52B25",
    engineType: "Benziner",
    label: "BMW N52 Benziner",
    notes: "BMW Ottomotor mit Zündkerzen/Zündspulen.",
  },
  N52B30: {
    code: "N52B30",
    engineType: "Benziner",
    label: "BMW N52 Benziner",
    notes: "BMW Ottomotor mit Zündkerzen/Zündspulen.",
  },
  N54B30: {
    code: "N54B30",
    engineType: "Benziner",
    label: "BMW N54 Benziner",
    notes: "BMW Turbo-Ottomotor mit Zündkerzen/Zündspulen.",
  },
  N55B30: {
    code: "N55B30",
    engineType: "Benziner",
    label: "BMW N55 Benziner",
    notes: "BMW Turbo-Ottomotor mit Zündkerzen/Zündspulen.",
  },
  B48B20: {
    code: "B48B20",
    engineType: "Benziner",
    label: "BMW B48 Benziner",
    notes: "BMW Turbo-Ottomotor mit Zündkerzen/Zündspulen.",
  },
  B58B30: {
    code: "B58B30",
    engineType: "Benziner",
    label: "BMW B58 Benziner",
    notes: "BMW Turbo-Ottomotor mit Zündkerzen/Zündspulen.",
  },

  CBAB: {
    code: "CBAB",
    engineType: "Diesel",
    label: "VW/Audi 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CAGA: {
    code: "CAGA",
    engineType: "Diesel",
    label: "Audi/VW 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CAGB: {
    code: "CAGB",
    engineType: "Diesel",
    label: "Audi/VW 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CAGC: {
    code: "CAGC",
    engineType: "Diesel",
    label: "Audi/VW 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CAHA: {
    code: "CAHA",
    engineType: "Diesel",
    label: "Audi/VW 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CAHB: {
    code: "CAHB",
    engineType: "Diesel",
    label: "Audi/VW 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CGLC: {
    code: "CGLC",
    engineType: "Diesel",
    label: "Audi/VW 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CGLD: {
    code: "CGLD",
    engineType: "Diesel",
    label: "Audi/VW 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CJCA: {
    code: "CJCA",
    engineType: "Diesel",
    label: "VW/Audi 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CJCB: {
    code: "CJCB",
    engineType: "Diesel",
    label: "VW/Audi 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CFFB: {
    code: "CFFB",
    engineType: "Diesel",
    label: "VW/Audi 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CFGB: {
    code: "CFGB",
    engineType: "Diesel",
    label: "VW/Audi 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CRLB: {
    code: "CRLB",
    engineType: "Diesel",
    label: "VW/Audi 2.0 TDI Diesel",
    notes: "EA288 Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CUNA: {
    code: "CUNA",
    engineType: "Diesel",
    label: "VW/Audi 2.0 TDI Diesel",
    notes: "EA288 Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  CUAA: {
    code: "CUAA",
    engineType: "Diesel",
    label: "VW 2.0 BiTDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  DDAA: {
    code: "DDAA",
    engineType: "Diesel",
    label: "VW 2.0 TDI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  DFGA: {
    code: "DFGA",
    engineType: "Diesel",
    label: "VW 2.0 TDI Diesel",
    notes: "EA288 Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  DETA: {
    code: "DETA",
    engineType: "Diesel",
    label: "VW/Audi 2.0 TDI Diesel",
    notes: "EA288 Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  DCXA: {
    code: "DCXA",
    engineType: "Diesel",
    label: "VW/Audi 2.0 TDI Diesel",
    notes: "EA288 Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  N47D20: {
    code: "N47D20",
    engineType: "Diesel",
    label: "BMW N47 Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  B47D20: {
    code: "B47D20",
    engineType: "Diesel",
    label: "BMW B47 Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  M57D30: {
    code: "M57D30",
    engineType: "Diesel",
    label: "BMW M57 Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  N57D30: {
    code: "N57D30",
    engineType: "Diesel",
    label: "BMW N57 Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  OM651: {
    code: "OM651",
    engineType: "Diesel",
    label: "Mercedes OM651 Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  OM642: {
    code: "OM642",
    engineType: "Diesel",
    label: "Mercedes OM642 Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  A17DTR: {
    code: "A17DTR",
    engineType: "Diesel",
    label: "Opel 1.7 CDTI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
  Z17DTH: {
    code: "Z17DTH",
    engineType: "Diesel",
    label: "Opel 1.7 CDTI Diesel",
    notes: "Common-Rail-Diesel, keine Zündkerzen/Zündspulen.",
  },
};

function findEngineCode(input: string): EngineInfo | null {
  const upperText = input.toUpperCase();

  const sortedCodes = Object.keys(ENGINE_CODE_DATABASE).sort(
    (a, b) => b.length - a.length
  );

  for (const code of sortedCodes) {
    const pattern = new RegExp(`(^|[^A-Z0-9])${code}([^A-Z0-9]|$)`, "i");

    if (pattern.test(upperText)) {
      return ENGINE_CODE_DATABASE[code];
    }
  }

  return null;
}

export function detectEngineContext(input: string): EngineContext {
  const knownEngine = findEngineCode(input);

  if (knownEngine) {
    return {
      engineType: knownEngine.engineType,
      source: "Motorkennbuchstabe",
      label: knownEngine.label,
      code: knownEngine.code,
      notes: knownEngine.notes,
    };
  }

  const text = input.toLowerCase();

  const dieselTerms = [
    "diesel",
    "tdi",
    "cdi",
    "dci",
    "hdi",
    "tdci",
    "crdi",
    "jtd",
    "multijet",
    "bluehdi",
    "d-4d",
    "d4d",
    "dpf",
    "partikelfilter",
    "common rail",
    "raildruck",
    "rücklaufmenge",
    "glühkerze",
    "glühkerzen",
    "injektor",
    "injektoren",
  ];

  const petrolTerms = [
    "benzin",
    "benziner",
    "ottomotor",
    "tfsi",
    "tsi",
    "fsi",
    "mpi",
    "gdi",
    "zündkerze",
    "zündkerzen",
    "zündspule",
    "zündspulen",
    "zündaussetzer",
  ];

  const isDiesel = dieselTerms.some((term) => text.includes(term));
  const isPetrol = petrolTerms.some((term) => text.includes(term));

  if (isDiesel && !isPetrol) {
    return {
      engineType: "Diesel",
      source: "Begriffe in der Eingabe",
      label: "Diesel erkannt",
      code: null,
      notes: "Diesel anhand von Begriffen erkannt.",
    };
  }

  if (isPetrol && !isDiesel) {
    return {
      engineType: "Benziner",
      source: "Begriffe in der Eingabe",
      label: "Benziner erkannt",
      code: null,
      notes: "Benziner anhand von Begriffen erkannt.",
    };
  }

  if (isDiesel && isPetrol) {
    return {
      engineType: "Unbekannt",
      source: "Widersprüchliche Begriffe",
      label: "Motortyp nicht eindeutig",
      code: null,
      notes:
        "Die Eingabe enthält Diesel- und Benziner-Begriffe. Motorcode oder Kraftstoffart angeben.",
    };
  }

  return {
    engineType: "Unbekannt",
    source: "Nicht eindeutig",
    label: "Motortyp unbekannt",
    code: null,
    notes: "Kraftstoffart oder Motorkennbuchstabe nicht eindeutig erkannt.",
  };
}