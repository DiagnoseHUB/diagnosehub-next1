export type FaultCodeInfo = {
  code: string;
  title: string;
  system: string;
  description: string;
  typicalCauses: string[];
  suggestedChecks: string[];
};

export type FaultCodeContext = {
  foundCodes: FaultCodeInfo[];
  summary: string;
};

const FAULT_CODE_DATABASE: Record<string, FaultCodeInfo> = {
  P0299: {
    code: "P0299",
    title: "Ladedruckregelgrenze unterschritten",
    system: "Ladedruck / Aufladung",
    description:
      "Der gemessene Ladedruck liegt unter dem erwarteten Sollwert. Häufig bei Undichtigkeiten, Regelproblemen oder Turbolader-/Wastegate-/VTG-Problemen.",
    typicalCauses: [
      "Undichtigkeit in der Ladeluftstrecke",
      "Unterdruck-/Druckwandlerproblem",
      "VTG-Verstellung schwergaengig oder fehlerhaft",
      "Wastegate undicht oder ausgeschlagen",
      "Ladedrucksensor fehlerhaft",
      "Luftmassenmesser unplausibel",
      "Abgasgegendruck / DPF-Problem",
      "Turbolader mechanisch beschädigt",
    ],
    suggestedChecks: [
      "Ladedruck Soll/Ist unter Last vergleichen",
      "Ladeluftstrecke abdrücken",
      "Unterdruckversorgung prüfen",
      "Druckwandler / Ladedruckregelventil prüfen",
      "VTG-/Wastegate-Ansteuerung prüfen",
      "LMM-Wert plausibilisieren",
      "DPF-Differenzdruck prüfen",
    ],
  },

  P0234: {
    code: "P0234",
    title: "Ladedruckregelgrenze ueberschritten",
    system: "Ladedruck / Aufladung",
    description:
      "Der gemessene Ladedruck ist hoeher als erwartet. Häufig bei klemmender VTG, fehlerhafter Regelung oder falscher Druckrückmeldung.",
    typicalCauses: [
      "VTG-Verstellung klemmt",
      "Wastegate oeffnet nicht korrekt",
      "Druckwandler / Ladedruckregelventil fehlerhaft",
      "Unterdrucksystem falsch angesteuert",
      "Ladedrucksensor fehlerhaft",
      "Software-/Tuning-Einfluss",
    ],
    suggestedChecks: [
      "Ladedruck Soll/Ist loggen",
      "VTG-/Wastegate-Verstellung mechanisch prüfen",
      "Unterdruckansteuerung messen",
      "Druckwandler prüfen",
      "Ladedrucksensor plausibilisieren",
    ],
  },

  P0401: {
    code: "P0401",
    title: "AGR-Durchsatz zu gering",
    system: "Abgasrückführung",
    description:
      "Das Motorsteuergerät erkennt zu wenig AGR-Durchsatz. Häufig durch verkokte AGR-Strecken, klemmendes AGR-Ventil oder unplausible Luftmasse.",
    typicalCauses: [
      "AGR-Ventil verkokt oder klemmt",
      "AGR-Kühler / AGR-Strecke zugesetzt",
      "Luftmassenmesser unplausibel",
      "Unterdruck-/Stellgliedproblem",
      "DPF- oder Abgasgegendruckproblem",
    ],
    suggestedChecks: [
      "AGR Soll/Ist prüfen",
      "LMM-Veränderung bei AGR-Ansteuerung prüfen",
      "AGR-Ventil Stellgliedtest durchführen",
      "AGR-Strecke auf Verkokung prüfen",
      "Abgasgegendruck / DPF-Differenzdruck prüfen",
    ],
  },

  P0402: {
    code: "P0402",
    title: "AGR-Durchsatz zu hoch",
    system: "Abgasrückführung",
    description:
      "Das Motorsteuergerät erkennt zu viel AGR-Durchsatz. Möglich sind ein offen haengendes AGR-Ventil oder unplausible Luftmassenwerte.",
    typicalCauses: [
      "AGR-Ventil hängt offen",
      "AGR-Ansteuerung fehlerhaft",
      "Luftmassenmesser unplausibel",
      "Ansaugsystem verschmutzt",
    ],
    suggestedChecks: [
      "AGR Soll/Ist vergleichen",
      "LMM-Werte bei AGR offen/geschlossen vergleichen",
      "AGR-Ventil mechanisch prüfen",
      "Stellgliedtest durchführen",
    ],
  },

  P0087: {
    code: "P0087",
    title: "Kraftstoffrail-/Systemdruck zu niedrig",
    system: "Kraftstoffdruck / Raildruck",
    description:
      "Der Kraftstoffdruck im Hochdrucksystem ist zu niedrig. Relevant bei Diesel und Direkteinspritzer-Benzinern, Ursachen unterscheiden sich nach Motortyp.",
    typicalCauses: [
      "Kraftstofffilter zugesetzt",
      "Niederdruckversorgung zu schwach",
      "Hochdruckpumpe verschlissen",
      "Druckregelventil / Mengenregelventil fehlerhaft",
      "Injektor Rücklaufmenge zu hoch",
      "Kraftstoffsystem undicht",
      "Tankpumpe / Vorfoerderpumpe fehlerhaft",
    ],
    suggestedChecks: [
      "Raildruck Soll/Ist beim Starten und unter Last prüfen",
      "Niederdruckversorgung messen",
      "Kraftstofffilterzustand prüfen",
      "Injektor-Rücklaufmenge prüfen",
      "Mengenregelventil / Druckregelventil prüfen",
      "Kraftstoffsystem auf Luftblasen/Undichtigkeiten prüfen",
    ],
  },

  P0088: {
    code: "P0088",
    title: "Kraftstoffrail-/Systemdruck zu hoch",
    system: "Kraftstoffdruck / Raildruck",
    description:
      "Der Kraftstoffdruck im Hochdrucksystem ist zu hoch. Häufig durch Regelventile, Sensorik oder Ansteuerungsprobleme.",
    typicalCauses: [
      "Druckregelventil klemmt",
      "Mengenregelventil fehlerhaft",
      "Raildrucksensor unplausibel",
      "Rücklauf blockiert",
      "Software-/Tuning-Einfluss",
    ],
    suggestedChecks: [
      "Raildruck Soll/Ist vergleichen",
      "Raildrucksensor plausibilisieren",
      "Druckregelventil prüfen",
      "Mengenregelventil prüfen",
      "Rücklauf prüfen",
    ],
  },

  P0101: {
    code: "P0101",
    title: "Luftmassenmesser Bereich/Leistung unplausibel",
    system: "Luftmasse / Ansaugsystem",
    description:
      "Das Signal des Luftmassenmessers ist unplausibel im Verhaeltnis zu Betriebszustand, Ladedruck, AGR oder Drosselklappe.",
    typicalCauses: [
      "Luftmassenmesser verschmutzt oder fehlerhaft",
      "Falschluft / Undichtigkeit nach LMM",
      "AGR-Problem",
      "Ladeluftleck",
      "Luftfilter stark verschmutzt",
      "Kabel-/Steckerproblem",
    ],
    suggestedChecks: [
      "LMM-Wert im Leerlauf und unter Last prüfen",
      "Ansaugsystem auf Undichtigkeit prüfen",
      "Luftfilter prüfen",
      "AGR-Ansteuerung und LMM-Reaktion prüfen",
      "Stecker/Kabel prüfen",
    ],
  },

  P0171: {
    code: "P0171",
    title: "Gemisch zu mager Bank 1",
    system: "Gemischbildung / Benziner",
    description:
      "Das Motorsteuergerät regelt stark in Richtung Anfettung. Häufig bei Falschluft, Kraftstoffdruckproblemen oder unplausibler Luftmessung.",
    typicalCauses: [
      "Falschluft im Ansaugsystem",
      "Kurbelgehaeuseentlueftung defekt",
      "Kraftstoffdruck zu niedrig",
      "Luftmassenmesser unplausibel",
      "Lambdasonde unplausibel",
      "Undichtigkeit Abgasanlage vor Lambdasonde",
    ],
    suggestedChecks: [
      "Fuel Trims / Gemischadaption prüfen",
      "Ansaugsystem abnebeln",
      "Kurbelgehaeuseentlueftung prüfen",
      "Kraftstoffdruck prüfen",
      "Lambdasondenwerte plausibilisieren",
    ],
  },

  P0172: {
    code: "P0172",
    title: "Gemisch zu fett Bank 1",
    system: "Gemischbildung / Benziner",
    description:
      "Das Motorsteuergerät regelt stark in Richtung Abmagerung. Häufig durch zu hohen Kraftstoffdruck, tropfende Injektoren oder Sensorfehler.",
    typicalCauses: [
      "Injektor undicht",
      "Kraftstoffdruck zu hoch",
      "Luftmassenmesser unplausibel",
      "Lambdasonde unplausibel",
      "Tankentlueftungsventil hängt offen",
    ],
    suggestedChecks: [
      "Fuel Trims prüfen",
      "Kraftstoffdruck prüfen",
      "Injektoren auf Nachtropfen prüfen",
      "Tankentlueftungsventil prüfen",
      "LMM- und Lambdawerte plausibilisieren",
    ],
  },

  P0300: {
    code: "P0300",
    title: "Zufaellige/mehrere Zylinder Fehlzuendungen erkannt",
    system: "Verbrennung / Laufunruhe",
    description:
      "Das Steuergerät erkennt Verbrennungsaussetzer auf mehreren oder wechselnden Zylindern. Beim Benziner oft Zuendung/Falschluft/Kraftstoff, beim Diesel eher Injektoren/Raildruck/Kompression.",
    typicalCauses: [
      "Benziner: Zuendkerzen / Zuendspulen",
      "Benziner: Falschluft / PCV",
      "Diesel: Injektoren / Rücklaufmenge",
      "Raildruckschwankungen",
      "Kompressionsproblem",
      "Kraftstoffversorgung",
    ],
    suggestedChecks: [
      "Aussetzerzähller je Zylinder prüfen",
      "Motortyp beachten: Benziner Zuendung prüfen, Diesel Injektoren/Raildruck prüfen",
      "Kraftstoffdruck / Raildruck prüfen",
      "Falschluft / Ansaugsystem prüfen",
      "Kompression prüfen",
    ],
  },

  P0301: {
    code: "P0301",
    title: "Zylinder 1 Fehlzuendung erkannt",
    system: "Verbrennung / Laufunruhe",
    description:
      "Das Steuergerät erkennt Aussetzer auf Zylinder 1. Ursache abhaengig vom Motortyp.",
    typicalCauses: [
      "Benziner: Zuendkerze / Zuendspule Zylinder 1",
      "Benziner: Injektor Zylinder 1",
      "Diesel: Injektor Zylinder 1",
      "Kompression Zylinder 1",
      "Falschluft / mechanisches Problem",
    ],
    suggestedChecks: [
      "Aussetzerzähller prüfen",
      "Benziner: Zuendspule/Zuendkerze quer tauschen",
      "Diesel: Injektor-Korrekturwerte/Rücklaufmenge prüfen",
      "Kompression prüfen",
      "Injektor-Ansteuerung prüfen",
    ],
  },

  P0302: {
    code: "P0302",
    title: "Zylinder 2 Fehlzuendung erkannt",
    system: "Verbrennung / Laufunruhe",
    description:
      "Das Steuergerät erkennt Aussetzer auf Zylinder 2. Ursache abhaengig vom Motortyp.",
    typicalCauses: [
      "Benziner: Zuendkerze / Zuendspule Zylinder 2",
      "Benziner: Injektor Zylinder 2",
      "Diesel: Injektor Zylinder 2",
      "Kompression Zylinder 2",
      "Falschluft / mechanisches Problem",
    ],
    suggestedChecks: [
      "Aussetzerzähller prüfen",
      "Benziner: Zuendspule/Zuendkerze quer tauschen",
      "Diesel: Injektor-Korrekturwerte/Rücklaufmenge prüfen",
      "Kompression prüfen",
      "Injektor-Ansteuerung prüfen",
    ],
  },

  P0303: {
    code: "P0303",
    title: "Zylinder 3 Fehlzuendung erkannt",
    system: "Verbrennung / Laufunruhe",
    description:
      "Das Steuergerät erkennt Aussetzer auf Zylinder 3. Ursache abhaengig vom Motortyp.",
    typicalCauses: [
      "Benziner: Zuendkerze / Zuendspule Zylinder 3",
      "Benziner: Injektor Zylinder 3",
      "Diesel: Injektor Zylinder 3",
      "Kompression Zylinder 3",
      "Falschluft / mechanisches Problem",
    ],
    suggestedChecks: [
      "Aussetzerzähller prüfen",
      "Benziner: Zuendspule/Zuendkerze quer tauschen",
      "Diesel: Injektor-Korrekturwerte/Rücklaufmenge prüfen",
      "Kompression prüfen",
      "Injektor-Ansteuerung prüfen",
    ],
  },

  P0304: {
    code: "P0304",
    title: "Zylinder 4 Fehlzuendung erkannt",
    system: "Verbrennung / Laufunruhe",
    description:
      "Das Steuergerät erkennt Aussetzer auf Zylinder 4. Ursache abhaengig vom Motortyp.",
    typicalCauses: [
      "Benziner: Zuendkerze / Zuendspule Zylinder 4",
      "Benziner: Injektor Zylinder 4",
      "Diesel: Injektor Zylinder 4",
      "Kompression Zylinder 4",
      "Falschluft / mechanisches Problem",
    ],
    suggestedChecks: [
      "Aussetzerzähller prüfen",
      "Benziner: Zuendspule/Zuendkerze quer tauschen",
      "Diesel: Injektor-Korrekturwerte/Rücklaufmenge prüfen",
      "Kompression prüfen",
      "Injektor-Ansteuerung prüfen",
    ],
  },

  P2002: {
    code: "P2002",
    title: "DPF-Wirkungsgrad unter Schwelle",
    system: "Dieselpartikelfilter",
    description:
      "Das Steuergerät erkennt eine unzureichende Filterwirkung oder unplausible DPF-Werte.",
    typicalCauses: [
      "DPF stark beladen oder beschädigt",
      "Differenzdrucksensor fehlerhaft",
      "Differenzdruckleitungen verstopft oder undicht",
      "Temperatursensoren unplausibel",
      "AGR-/Ladedruckproblem verursacht Rußbildung",
      "Regeneration nicht erfolgreich",
    ],
    suggestedChecks: [
      "DPF-Differenzdruck im Leerlauf und unter Last prüfen",
      "Aschemasse / Rußmasse prüfen",
      "Differenzdruckleitungen prüfen",
      "Abgastemperatursensoren prüfen",
      "Regenerationshistorie prüfen",
      "Ursache für erhöhte Rußbildung prüfen",
    ],
  },

  P2453: {
    code: "P2453",
    title: "DPF-Differenzdrucksensor Signal unplausibel",
    system: "Dieselpartikelfilter",
    description:
      "Das Signal des Differenzdrucksensors ist unplausibel oder außerhalb des erwarteten Bereichs.",
    typicalCauses: [
      "Differenzdrucksensor fehlerhaft",
      "Schlaeuche verstopft, vertauscht oder undicht",
      "Kabel-/Steckerproblem",
      "DPF stark beladen",
    ],
    suggestedChecks: [
      "Differenzdruck bei Motor aus prüfen",
      "Differenzdruck im Leerlauf prüfen",
      "Schlaeuche prüfen",
      "Sensorversorgung und Signal prüfen",
      "DPF-Beladung prüfen",
    ],
  },
};

function normalizeFaultCode(code: string) {
  return code.trim().toUpperCase();
}

export function detectFaultCodeContext(input: string): FaultCodeContext {
  const upperText = input.toUpperCase();

  const detectedCodes = new Set<string>();
  const pattern = /\bP[0-9]{4}\b/g;

  for (const match of upperText.matchAll(pattern)) {
    detectedCodes.add(normalizeFaultCode(match[0]));
  }

  const foundCodes = Array.from(detectedCodes)
    .map((code) => FAULT_CODE_DATABASE[code])
    .filter((codeInfo): codeInfo is FaultCodeInfo => Boolean(codeInfo));

  if (foundCodes.length === 0) {
    return {
      foundCodes: [],
      summary: "Keine bekannten Fehlercodes aus der internen Datenbank erkannt.",
    };
  }

  return {
    foundCodes,
    summary: foundCodes
      .map((code) => `${code.code}: ${code.title} (${code.system})`)
      .join("\n"),
  };
}

export function formatFaultCodeContext(context: FaultCodeContext) {
  if (context.foundCodes.length === 0) {
    return context.summary;
  }

  return context.foundCodes
    .map((faultCode) => {
      return `
${faultCode.code} - ${faultCode.title}
System: ${faultCode.system}
Beschreibung: ${faultCode.description}

Typische Ursachen:
${faultCode.typicalCauses.map((cause) => `- ${cause}`).join("\n")}

Empfohlene Prüfungen:
${faultCode.suggestedChecks.map((check) => `- ${check}`).join("\n")}
`;
    })
    .join("\n---\n");
}