export type SignalLibraryCategory =
  | "Kurbel-/Nockenwellensensor"
  | "LIN/CAN"
  | "Einspritzung"
  | "Zündung"
  | "Lambdasonde"
  | "Drucksensor"
  | "Stromaufnahme";

export type SignalSeverity = "info" | "warning" | "stop";

export type SignalReferenceValue = {
  label: string;
  value: string;
  condition: string;
  confidence: "allgemein" | "systemabhängig" | "nur Vergleich";
  note: string;
};

export type SignalFaultPattern = {
  title: string;
  symptom: string;
  signalClue: string;
  nextCheck: string;
  severity: SignalSeverity;
};

export type SignalChannel = {
  label: string;
  color: string;
  unit: string;
  scaleHint: string;
  points: number[];
};

export type SignalLibraryEntry = {
  id: string;
  slug: string;
  title: string;
  category: SignalLibraryCategory;
  systemGroup: string;
  signalType: string;
  summary: string;
  whenToUse: string[];
  measurementSetup: string[];
  expectedPattern: string;
  referenceValues: SignalReferenceValue[];
  commonFaults: SignalFaultPattern[];
  safetyNotes: string[];
  nextChecks: string[];
  channels: SignalChannel[];
  tags: string[];
  sourceNote: string;
  updatedAt: string;
};

export const SIGNAL_CATEGORIES: SignalLibraryCategory[] = [
  "Kurbel-/Nockenwellensensor",
  "LIN/CAN",
  "Einspritzung",
  "Zündung",
  "Lambdasonde",
  "Drucksensor",
  "Stromaufnahme",
];

const digitalHighLow = [
  0.08, 0.08, 0.9, 0.9, 0.08, 0.08, 0.9, 0.9, 0.08, 0.08, 0.9, 0.9, 0.08,
  0.08, 0.9, 0.9, 0.08,
];

const sineWithGap = [
  0.5, 0.68, 0.83, 0.92, 0.86, 0.7, 0.5, 0.3, 0.14, 0.08, 0.17, 0.32, 0.5,
  0.68, 0.83, 0.92, 0.86, 0.7, 0.5, 0.3, 0.14, 0.08, 0.17, 0.32, 0.5,
  0.5, 0.5, 0.68, 0.83, 0.92, 0.86, 0.7, 0.5,
];

const currentRamp = [
  0.04, 0.1, 0.16, 0.23, 0.3, 0.38, 0.47, 0.57, 0.67, 0.78, 0.9, 0.1, 0.06,
  0.05, 0.12, 0.2, 0.28, 0.37, 0.47, 0.58, 0.7, 0.84, 0.94, 0.12,
];

export const SIGNAL_LIBRARY_SEED_ENTRIES: SignalLibraryEntry[] = [
  {
    id: "kw-induktiv",
    slug: "kurbelwellensensor-induktiv",
    title: "Kurbelwellensensor induktiv",
    category: "Kurbel-/Nockenwellensensor",
    systemGroup: "Motordrehzahl / Synchronisation",
    signalType: "analoger Wechselspannungssensor",
    summary:
      "Induktiver Kurbelwellensensor mit sinusähnlichem Signal. Amplitude steigt mit Drehzahl; Zahnlücke dient häufig als Referenz.",
    whenToUse: [
      "Motor startet nicht, Drehzahlsignal fehlt oder springt.",
      "Fehler zu Kurbelwellensensor, Synchronisation oder Aussetzern.",
      "Verdacht auf falschen Sensorabstand, Kabelbruch oder beschädigtes Geberrad.",
    ],
    measurementSetup: [
      "Zweikanal oder Einkanal am Sensorsignal messen, möglichst ohne Leitung zu beschädigen.",
      "AC-Kopplung oder passende Spannungsauflösung wählen, beim Starten und im Leerlauf vergleichen.",
      "Massebezug und Schirmung prüfen, wenn das Signal stark verrauscht ist.",
    ],
    expectedPattern:
      "Gleichmäßige Sinusfolge mit klarer Zahnlücke. Beim Starten kleinere Amplitude, bei höherer Drehzahl deutlich größere Amplitude.",
    referenceValues: [
      {
        label: "Amplitude beim Starten",
        value: "oft grob ab ca. 0,5 V AC erkennbar",
        condition: "sensor- und drehzahlabhängig",
        confidence: "systemabhängig",
        note: "Kein Hersteller-Sollwert. Entscheidend sind saubere Form, Wiederholbarkeit und Steuergeräteerkennung.",
      },
      {
        label: "Widerstand",
        value: "nur nach Herstellerdaten bewerten",
        condition: "Sensor abgesteckt",
        confidence: "nur Vergleich",
        note: "Widerstand allein beweist den Sensor nicht sicher.",
      },
    ],
    commonFaults: [
      {
        title: "Kein Signal beim Starten",
        symptom: "Drehzahl im Tester bleibt 0, Motor startet nicht.",
        signalClue: "Linie bleibt flach oder nur Störungen sichtbar.",
        nextCheck: "Sensorversorgung je nach Bauart, Sensorabstand, Geberrad und Leitung prüfen.",
        severity: "warning",
      },
      {
        title: "Unregelmäßige Zahnlücke",
        symptom: "Startprobleme, Aussetzer oder Synchronisationsfehler.",
        signalClue: "Abstände oder Amplituden brechen an gleicher Stelle ein.",
        nextCheck: "Geberrad auf Schlag, Beschädigung, Verschmutzung und korrekten Sitz prüfen.",
        severity: "warning",
      },
    ],
    safetyNotes: [
      "Beim Starten auf rotierende Teile, Lüfter und Riemen achten.",
      "Keine Leitungen durchstechen, wenn ein Adapter oder Backprobing möglich ist.",
    ],
    nextChecks: [
      "Drehzahlanzeige im Diagnosetester mit Oszilloskopbild vergleichen.",
      "Kurbel- und Nockenwellensignal gemeinsam messen, wenn Synchronisation verdächtig ist.",
      "Sensorabstand und Geberrad mechanisch prüfen, bevor Teile getauscht werden.",
    ],
    channels: [
      {
        label: "KW-Signal",
        color: "#2563eb",
        unit: "V AC",
        scaleHint: "Amplitude drehzahlabhängig",
        points: sineWithGap,
      },
    ],
    tags: ["kurbelwellensensor", "kw-sensor", "drehzahl", "induktiv", "startet nicht"],
    sourceNote:
      "Allgemeines Referenzsignal. Exakte Pegel, Widerstände und Pinbelegung immer mit Herstellerdaten prüfen.",
    updatedAt: "2026-07-13",
  },
  {
    id: "kw-nw-hall",
    slug: "kurbel-nockenwellensensor-hall",
    title: "Hallgeber Kurbelwelle / Nockenwelle",
    category: "Kurbel-/Nockenwellensensor",
    systemGroup: "Motorsynchronisation",
    signalType: "digitales Rechtecksignal",
    summary:
      "Hallgeber liefern ein digitales Signal mit klaren Flanken. Je nach System liegt der Pegel bei etwa 0 bis 5 V oder 0 bis Batteriespannung.",
    whenToUse: [
      "Plausibilitätsfehler Kurbelwelle/Nockenwelle.",
      "Startet schlecht, geht aus oder Synchronisation verloren.",
      "Verdacht auf Versorgung, Masse, Signalunterbrechung oder Steuerzeitenproblem.",
    ],
    measurementSetup: [
      "Signal, Masse und Versorgung getrennt prüfen.",
      "Bei Synchronisationsfehlern Kurbelwelle und Nockenwelle gleichzeitig auf zwei Kanälen messen.",
      "Zeitbasis so wählen, dass mehrere Kurbelwellenumdrehungen sichtbar sind.",
    ],
    expectedPattern:
      "Sauberes Rechtecksignal mit stabilen High-/Low-Pegeln. Kurbel- und Nockenwellensignal müssen phasenstabil zueinander laufen.",
    referenceValues: [
      {
        label: "Signalpegel",
        value: "typisch 0/5 V oder 0/Batteriespannung",
        condition: "systemabhängig",
        confidence: "systemabhängig",
        note: "Versorgungsspannung und Signalpegel nicht verwechseln.",
      },
      {
        label: "Flanken",
        value: "klar und wiederholbar",
        condition: "Starten und Leerlauf",
        confidence: "allgemein",
        note: "Runde, verschliffene oder fehlende Flanken deuten auf Leitung, Sensor oder Pull-up-Problem hin.",
      },
    ],
    commonFaults: [
      {
        title: "High-Pegel zu niedrig",
        symptom: "Signal wird sporadisch nicht erkannt.",
        signalClue: "Rechteck erreicht den erwarteten High-Pegel nicht.",
        nextCheck: "Versorgung, Masse, Pull-up, Leitung und Steuergeräte-Eingang prüfen.",
        severity: "warning",
      },
      {
        title: "Phasenlage verschoben",
        symptom: "Synchronisationsfehler trotz vorhandener Signale.",
        signalClue: "KW/NW-Bezug passt nicht zum bekannten Gutbild.",
        nextCheck: "Steuerzeiten, Kette/Riemen, Versteller und Referenzsignal prüfen.",
        severity: "stop",
      },
    ],
    safetyNotes: [
      "Steuerzeiten nur nach Herstellervorgaben bewerten.",
      "Arbeiten an Steuertrieb und rotierenden Teilen nur mit passender Qualifikation.",
    ],
    nextChecks: [
      "Versorgung und Masse unter Last messen.",
      "Signal gegen Steuergeräte-Pin vergleichen, wenn am Sensor gut und am Steuergerät schlecht.",
      "Bei Phasenfehlern mechanische Steuerzeiten prüfen.",
    ],
    channels: [
      {
        label: "Kurbelwelle",
        color: "#2563eb",
        unit: "V",
        scaleHint: "0/5 V oder 0/12 V",
        points: digitalHighLow,
      },
      {
        label: "Nockenwelle",
        color: "#16a34a",
        unit: "V",
        scaleHint: "Phasenbezug beachten",
        points: [0.08, 0.08, 0.08, 0.86, 0.86, 0.86, 0.08, 0.08, 0.08, 0.08, 0.86, 0.86, 0.08, 0.08, 0.08, 0.86, 0.86],
      },
    ],
    tags: ["hallgeber", "nockenwellensensor", "synchronisation", "steuerzeiten"],
    sourceNote:
      "Allgemeines Referenzsignal. Für konkrete Phasenlage wird immer ein fahrzeugspezifisches Gutbild benötigt.",
    updatedAt: "2026-07-13",
  },
  {
    id: "can-high-low",
    slug: "can-bus-high-low",
    title: "CAN-Bus High / Low",
    category: "LIN/CAN",
    systemGroup: "Fahrzeugnetzwerk",
    signalType: "differenzielles Bussignal",
    summary:
      "CAN arbeitet differenziell. Rezessiv liegen CAN-H und CAN-L ungefähr nahe beieinander, dominant laufen beide Leitungen auseinander.",
    whenToUse: [
      "Mehrere Steuergeräte nicht erreichbar.",
      "U-Codes, Bus-Off, sporadische Kommunikationsabbrüche.",
      "Verdacht auf Kurzschluss, Terminierung, Störung oder falsches Nachrüstgerät.",
    ],
    measurementSetup: [
      "CAN-H und CAN-L zweikanalig gegen Masse oder differenziell messen.",
      "Masse am Fahrzeug sauber wählen und Tastkopf-Masse nicht falsch setzen.",
      "Bei ausgeschalteter Zündung Widerstandsmessung der Terminierung nur spannungsfrei durchführen.",
    ],
    expectedPattern:
      "CAN-H steigt bei dominantem Bit, CAN-L fällt. Beide Signale sollen sauber spiegelbildlich und ohne starke Reflexionen laufen.",
    referenceValues: [
      {
        label: "Rezessiver Pegel",
        value: "typisch ungefähr 2,5 V auf beiden Leitungen",
        condition: "High-Speed-CAN, allgemeiner Richtwert",
        confidence: "allgemein",
        note: "Netzwerk und Messpunkt können Abweichungen zeigen.",
      },
      {
        label: "Dominanter Pegel",
        value: "typisch CAN-H ca. 3,5 V, CAN-L ca. 1,5 V",
        condition: "High-Speed-CAN, allgemeiner Richtwert",
        confidence: "allgemein",
        note: "Wichtig ist auch die Differenz und die saubere Signalform.",
      },
      {
        label: "Terminierung",
        value: "oft ca. 60 Ohm gesamt",
        condition: "spannungsfrei zwischen CAN-H und CAN-L",
        confidence: "systemabhängig",
        note: "Nur messen, wenn das Netzwerk spannungsfrei ist und die Topologie dazu passt.",
      },
    ],
    commonFaults: [
      {
        title: "Kurzschluss gegen Masse oder Plus",
        symptom: "Viele Steuergeräte offline.",
        signalClue: "Eine Leitung klebt nahe 0 V oder Batteriespannung.",
        nextCheck: "Bussegmente trennen, Nachrüstgeräte und Leitungsstränge eingrenzen.",
        severity: "stop",
      },
      {
        title: "Reflexionen / Terminierung fehlerhaft",
        symptom: "Sporadische Kommunikationsfehler.",
        signalClue: "Überschwingen, starke Kantenreflexionen, unsaubere Pegel.",
        nextCheck: "Terminierung, Steckverbindungen, verdrillte Leitung und Abzweige prüfen.",
        severity: "warning",
      },
    ],
    safetyNotes: [
      "Busleitungen nicht mit Prüflampe belasten.",
      "Vor Widerstandsmessung Spannung abschalten und Restspannung beachten.",
    ],
    nextChecks: [
      "Fehlerspeicher aller erreichbaren Steuergeräte vergleichen.",
      "CAN-H/CAN-L Pegel und Terminierung prüfen.",
      "Auffällige Steuergeräte oder Nachrüstmodule abschnittsweise abtrennen.",
    ],
    channels: [
      {
        label: "CAN-H",
        color: "#2563eb",
        unit: "V",
        scaleHint: "ca. 2,5 bis 3,5 V",
        points: [0.5, 0.5, 0.8, 0.5, 0.8, 0.8, 0.5, 0.5, 0.8, 0.5, 0.8, 0.5, 0.5, 0.8, 0.8, 0.5],
      },
      {
        label: "CAN-L",
        color: "#dc2626",
        unit: "V",
        scaleHint: "ca. 2,5 bis 1,5 V",
        points: [0.5, 0.5, 0.2, 0.5, 0.2, 0.2, 0.5, 0.5, 0.2, 0.5, 0.2, 0.5, 0.5, 0.2, 0.2, 0.5],
      },
    ],
    tags: ["can", "can-high", "can-low", "u-code", "kommunikation", "gateway"],
    sourceNote:
      "Allgemeine High-Speed-CAN-Referenz. Exakte Topologie und Terminierung fahrzeugabhängig prüfen.",
    updatedAt: "2026-07-13",
  },
  {
    id: "lin-bus",
    slug: "lin-bus-signal",
    title: "LIN-Bus",
    category: "LIN/CAN",
    systemGroup: "Karosserie / Komfort / Sensorik",
    signalType: "eindrahtiges serielles Bussignal",
    summary:
      "LIN ist ein eindrahtiger Bus. In Ruhe liegt die Leitung meist nahe Batteriespannung, dominante Bits ziehen die Leitung gegen Masse.",
    whenToUse: [
      "Kommunikationsfehler mit Generator, Klimasensor, Türmodul, Lüfter oder Komfortbauteil.",
      "Ein einzelner LIN-Teilnehmer reagiert nicht.",
      "Verdacht auf Kurzschluss, fehlende Versorgung oder defekten Slave.",
    ],
    measurementSetup: [
      "LIN-Leitung gegen Masse messen.",
      "Ruhepegel, Aktivität beim Ansteuern und Versorgung des Teilnehmers prüfen.",
      "Zeitbasis so wählen, dass Telegrammblöcke sichtbar sind.",
    ],
    expectedPattern:
      "Ruhepegel nahe Batteriespannung, kurze Telegrammblöcke mit Pull-down-Impulsen nahe Masse. Signal soll klare Flanken haben.",
    referenceValues: [
      {
        label: "Ruhepegel",
        value: "typisch nahe Batteriespannung",
        condition: "LIN-Leitung unbelastet/rezessiv",
        confidence: "allgemein",
        note: "Je nach Fahrzeug und Messpunkt leicht abweichend.",
      },
      {
        label: "Dominanter Pegel",
        value: "typisch nahe 0 V",
        condition: "während Telegramm",
        confidence: "allgemein",
        note: "Bleibt die Leitung dauerhaft niedrig, Kurzschluss oder Teilnehmerfehler prüfen.",
      },
    ],
    commonFaults: [
      {
        title: "Leitung dauerhaft niedrig",
        symptom: "LIN-Kommunikation komplett ausgefallen.",
        signalClue: "Keine Rückkehr zum Ruhepegel.",
        nextCheck: "Teilnehmer nacheinander abstecken, Leitung auf Massekurzschluss prüfen.",
        severity: "warning",
      },
      {
        title: "Keine Aktivität trotz Ansteuerung",
        symptom: "Bauteil reagiert nicht, aber Versorgung liegt an.",
        signalClue: "LIN bleibt dauerhaft auf Ruhepegel.",
        nextCheck: "Master-Ansteuerung, Diagnoseanforderung und Leitung zum Steuergerät prüfen.",
        severity: "warning",
      },
    ],
    safetyNotes: ["LIN nicht mit Prüflampe belasten."],
    nextChecks: [
      "Versorgung und Masse des LIN-Teilnehmers messen.",
      "LIN-Aktivität beim Stellgliedtest prüfen.",
      "Bei Busblockade Teilnehmer abschnittsweise trennen.",
    ],
    channels: [
      {
        label: "LIN",
        color: "#7c3aed",
        unit: "V",
        scaleHint: "0 V bis Batteriespannung",
        points: [0.88, 0.88, 0.12, 0.88, 0.12, 0.12, 0.88, 0.88, 0.12, 0.88, 0.88, 0.12, 0.12, 0.88, 0.88, 0.88],
      },
    ],
    tags: ["lin", "generator lin", "komfort", "klima", "lüfter", "kommunikation"],
    sourceNote: "Allgemeines LIN-Referenzsignal. Baudrate und Telegrammaufbau sind systemabhängig.",
    updatedAt: "2026-07-13",
  },
  {
    id: "injector-solenoid",
    slug: "einspritzventil-magnetventil",
    title: "Einspritzventil Magnetventil",
    category: "Einspritzung",
    systemGroup: "Kraftstoff / Einspritzung",
    signalType: "Spannungs- und Stromsignal",
    summary:
      "Magnetische Einspritzventile zeigen eine Ansteuerphase, Stromrampe und beim Abschalten eine Induktionsspitze.",
    whenToUse: [
      "Zylinderaussetzer, Startprobleme oder Kraftstofffehler.",
      "Verdacht auf fehlende Ansteuerung, defekte Spule oder mechanisch klemmendes Ventil.",
      "Vergleich zwischen Zylindern nötig.",
    ],
    measurementSetup: [
      "Stromzange um die Versorgungs- oder Steuerleitung legen.",
      "Zusätzlich Spannung am Ventil oder Steuerleitung messen, wenn möglich mit Adapter.",
      "Zylinder unter gleichen Bedingungen miteinander vergleichen.",
    ],
    expectedPattern:
      "Strom steigt während der Ansteuerung rampenförmig an. Beim Abschalten entsteht eine deutliche Induktionsspitze im Spannungssignal.",
    referenceValues: [
      {
        label: "Stromrampe",
        value: "Form und Gleichmäßigkeit wichtiger als ein Pauschalwert",
        condition: "bauart- und steuergeräteabhängig",
        confidence: "nur Vergleich",
        note: "Zylindervergleich ist oft aussagekräftiger als ein generischer Einzelwert.",
      },
      {
        label: "Induktionsspitze",
        value: "deutlich sichtbar",
        condition: "beim Abschalten",
        confidence: "allgemein",
        note: "Fehlt sie, Spule, Freilaufpfad, Verkabelung oder Treiber prüfen.",
      },
    ],
    commonFaults: [
      {
        title: "Keine Stromrampe",
        symptom: "Zylinder arbeitet nicht.",
        signalClue: "Spannung vorhanden, aber kein Stromanstieg.",
        nextCheck: "Ventilspule, Steckkontakt, Leitung und Treiber prüfen.",
        severity: "warning",
      },
      {
        title: "Auffälliger Stromknick",
        symptom: "Unruhiger Lauf oder Aussetzer.",
        signalClue: "Rampenform weicht vom Zylindervergleich ab.",
        nextCheck: "Ventil mechanisch, Kraftstoffdruck und Steuergerät-Ausgang vergleichen.",
        severity: "warning",
      },
    ],
    safetyNotes: [
      "Kraftstoffsysteme stehen unter Druck.",
      "Bei Hochdruck-Diesel keine Leitungen bei laufendem Motor lösen.",
    ],
    nextChecks: [
      "Zylindervergleich mit gleicher Zeitbasis durchführen.",
      "Widerstand nur ergänzend und nach Herstellerdaten bewerten.",
      "Bei mechanischem Verdacht Rücklaufmenge, Kompression und Kraftstoffdruck prüfen.",
    ],
    channels: [
      {
        label: "Strom",
        color: "#16a34a",
        unit: "A",
        scaleHint: "stromzangenabhängig",
        points: currentRamp,
      },
      {
        label: "Spannung",
        color: "#2563eb",
        unit: "V",
        scaleHint: "Bordnetz plus Abschaltspitze",
        points: [0.82, 0.82, 0.18, 0.18, 0.18, 0.18, 0.98, 0.82, 0.82, 0.82, 0.18, 0.18, 0.18, 0.98, 0.82, 0.82],
      },
    ],
    tags: ["einspritzventil", "injektor", "stromrampe", "zylinderaussetzer"],
    sourceNote: "Allgemeines Magnetventil-Referenzsignal. Direkteinspritzung und Diesel-Injektoren können stark abweichen.",
    updatedAt: "2026-07-13",
  },
  {
    id: "ignition-coil-primary",
    slug: "zuendspule-primaersignal",
    title: "Zündspule Primärsignal",
    category: "Zündung",
    systemGroup: "Zündanlage",
    signalType: "Primärspannung und Primärstrom",
    summary:
      "Das Primärsignal zeigt Schließzeit, Stromaufbau und Abschaltvorgang. Es hilft bei Aussetzern, Spulenfehlern und Treiberproblemen.",
    whenToUse: [
      "Zylinderaussetzer bei Ottomotoren.",
      "Verdacht auf defekte Zündspule, Ansteuerung oder Versorgung.",
      "Vergleich einzelner Zylinder unter Last.",
    ],
    measurementSetup: [
      "Primärseite nur mit geeignetem Tastkopf und passender Spannungskategorie messen.",
      "Stromzange für Primärstrom verwenden, wenn Spannungsspitzen kritisch sind.",
      "Zylindervergleich durchführen und Messbereich vor Start hoch genug wählen.",
    ],
    expectedPattern:
      "Stromrampe während der Schließzeit, danach Abschaltspitze und Schwingung. Verlauf soll zylinderweise ähnlich sein.",
    referenceValues: [
      {
        label: "Schließzeit",
        value: "steuergeräte- und drehzahlabhängig",
        condition: "Leerlauf und Last vergleichen",
        confidence: "systemabhängig",
        note: "Nicht pauschal bewerten; Diagnose über Vergleich und Ansteuerlogik.",
      },
      {
        label: "Primärspannung",
        value: "hohe Abschaltspitzen möglich",
        condition: "beim Abschalten",
        confidence: "allgemein",
        note: "Nur mit geeignetem Messmittel messen.",
      },
    ],
    commonFaults: [
      {
        title: "Stromrampe bricht ab",
        symptom: "Aussetzer auf einem Zylinder.",
        signalClue: "Primärstrom erreicht nicht den Vergleichswert.",
        nextCheck: "Versorgung, Masse, Spule und Steuergerätetreiber prüfen.",
        severity: "warning",
      },
      {
        title: "Keine Abschaltspitze",
        symptom: "Kein Zündfunke.",
        signalClue: "Ansteuerung ohne induktive Reaktion.",
        nextCheck: "Spule, Primärkreis, Treiber und Steckverbindung prüfen.",
        severity: "warning",
      },
    ],
    safetyNotes: [
      "Zündanlagen erzeugen hohe Spannungen. Nur geeignete Messmittel verwenden.",
      "Nicht an Sekundärseite oder Zündleitungen arbeiten, wenn die Anlage aktiv ist.",
    ],
    nextChecks: [
      "Fehlzündungszähler je Zylinder prüfen.",
      "Spule testweise zylinderweise quer tauschen, wenn fachlich vertretbar.",
      "Versorgung und Masse unter Last prüfen.",
    ],
    channels: [
      {
        label: "Primärstrom",
        color: "#16a34a",
        unit: "A",
        scaleHint: "Spulenabhängig",
        points: currentRamp,
      },
      {
        label: "Primärspannung",
        color: "#dc2626",
        unit: "V",
        scaleHint: "Abschaltspitze beachten",
        points: [0.78, 0.18, 0.18, 0.18, 0.18, 0.95, 0.7, 0.84, 0.73, 0.78, 0.18, 0.18, 0.18, 0.95, 0.72, 0.8],
      },
    ],
    tags: ["zündspule", "zündung", "misfire", "aussetzer", "primärsignal"],
    sourceNote: "Allgemeines Primärsignal. Sekundärdiagnose und genaue Werte sind systemabhängig.",
    updatedAt: "2026-07-13",
  },
  {
    id: "lambda-narrowband",
    slug: "lambdasonde-sprungsonde",
    title: "Lambdasonde Sprungsonde",
    category: "Lambdasonde",
    systemGroup: "Gemischregelung",
    signalType: "Spannungssignal",
    summary:
      "Eine klassische Sprungsonde pendelt bei aktiver Regelung zwischen mager und fett. Das Signal ist nur im geschlossenen Regelkreis sinnvoll bewertbar.",
    whenToUse: [
      "Gemischfehler, erhöhter Verbrauch oder AU-Probleme.",
      "Verdacht auf träge Sonde, Falschluft oder Kraftstoffdruckproblem.",
      "Vergleich Sonde vor und nach Katalysator.",
    ],
    measurementSetup: [
      "Sondensignal hochohmig messen, Massebezug sauber wählen.",
      "Motor betriebswarm prüfen und Regelzustand im Tester beachten.",
      "Fuel Trims und Lambdaregelung parallel betrachten.",
    ],
    expectedPattern:
      "Vor Kat bei aktiver Regelung regelmäßiges Pendeln zwischen niedrigem und hohem Spannungsbereich. Nach Kat deutlich ruhiger.",
    referenceValues: [
      {
        label: "Sprungsonde vor Kat",
        value: "typisch grob ca. 0,1 bis 0,9 V pendelnd",
        condition: "betriebswarm, geschlossener Regelkreis",
        confidence: "allgemein",
        note: "Regelstrategie, Sondentyp und Fahrzeugzustand beachten.",
      },
      {
        label: "Trägheit",
        value: "nur im Vergleich sicher bewerten",
        condition: "gezielte Anfettung/Abmagerung",
        confidence: "nur Vergleich",
        note: "Eine scheinbar träge Sonde kann auch Folge eines Gemischproblems sein.",
      },
    ],
    commonFaults: [
      {
        title: "Signal bleibt mager",
        symptom: "Gemischfehler mager, Ruckeln, Fuel Trim positiv.",
        signalClue: "Sonde bleibt lange im niedrigen Bereich.",
        nextCheck: "Falschluft, Kraftstoffdruck, Abgasleck vor Sonde und Sondenheizung prüfen.",
        severity: "warning",
      },
      {
        title: "Sonde pendelt nicht",
        symptom: "Regelung inaktiv oder AU-Wert auffällig.",
        signalClue: "Signal flach trotz warmem Motor.",
        nextCheck: "Regelkreisstatus, Heizung, Signalmasse und Gemischreaktion prüfen.",
        severity: "warning",
      },
    ],
    safetyNotes: ["Abgasanlage ist heiß. Brand- und Verbrennungsgefahr beachten."],
    nextChecks: [
      "Regelkreisstatus und Fuel Trims prüfen.",
      "Gezielt Falschluft oder Anfettung simulieren, wenn fachlich zulässig.",
      "Abgasleck vor Sonde ausschließen.",
    ],
    channels: [
      {
        label: "Sondenspannung",
        color: "#ea580c",
        unit: "V",
        scaleHint: "ca. 0,1 bis 0,9 V",
        points: [0.18, 0.2, 0.82, 0.85, 0.22, 0.18, 0.8, 0.86, 0.2, 0.18, 0.82, 0.84, 0.25, 0.2, 0.78, 0.84],
      },
    ],
    tags: ["lambdasonde", "sprungsonde", "gemisch", "fuel trim", "kat"],
    sourceNote: "Allgemeines Sprungsondenbild. Breitbandsonden werden anders bewertet.",
    updatedAt: "2026-07-13",
  },
  {
    id: "pressure-sensor-5v",
    slug: "drucksensor-5v-signal",
    title: "Drucksensor 5-V-Signal",
    category: "Drucksensor",
    systemGroup: "Sensorik / Druckmessung",
    signalType: "analoges Sensorsignal",
    summary:
      "Viele Drucksensoren arbeiten mit 5-V-Referenz, Masse und analogem Signal. Das Signal liegt typischerweise innerhalb eines plausiblen Fensters.",
    whenToUse: [
      "Ladedruck-, Raildruck-, Klimadruck- oder Differenzdruckfehler.",
      "Signal unplausibel, Kurzschluss nach Plus/Masse oder Referenzspannungsfehler.",
      "Soll-/Ist-Abweichung im Tester.",
    ],
    measurementSetup: [
      "5-V-Referenz, Masse und Signal getrennt prüfen.",
      "Signal unter Zustandsänderung beobachten, nicht nur Standwert bewerten.",
      "Sensorstecker und Leitung am Steuergerät vergleichen, wenn Leitungsfehler möglich ist.",
    ],
    expectedPattern:
      "Signal bewegt sich gleichmäßig mit Druckänderung. Keine Sprünge, Aussetzer oder Festwerte am Anschlag.",
    referenceValues: [
      {
        label: "Signalbereich",
        value: "häufig grob ca. 0,5 bis 4,5 V",
        condition: "typischer 5-V-Analogdrucksensor",
        confidence: "systemabhängig",
        note: "Exakte Kennlinie ist sensorspezifisch.",
      },
      {
        label: "Referenzspannung",
        value: "typisch 5 V",
        condition: "Zündung ein",
        confidence: "allgemein",
        note: "Belastung, Masseversatz und gemeinsame 5-V-Schiene beachten.",
      },
    ],
    commonFaults: [
      {
        title: "Signal am Anschlag",
        symptom: "Plausibilitätsfehler oder Ersatzwert.",
        signalClue: "Signal klebt nahe 0 V oder nahe Referenzspannung.",
        nextCheck: "Kurzschluss, Leitungsunterbrechung, Masse und Sensor prüfen.",
        severity: "warning",
      },
      {
        title: "Signal springt",
        symptom: "Sporadischer Fehler, Regelung instabil.",
        signalClue: "Kurze Aussetzer oder harte Sprünge ohne reale Druckänderung.",
        nextCheck: "Stecker, Kabelzug, Masseversatz und Sensor mechanisch prüfen.",
        severity: "warning",
      },
    ],
    safetyNotes: [
      "Kraftstoff- und Klimasysteme können unter hohem Druck stehen.",
      "Kältemittelarbeiten nur mit zugelassener Ausrüstung.",
    ],
    nextChecks: [
      "Signalwert mit Diagnosetester-Live-Daten vergleichen.",
      "5-V-Schiene auf weitere Sensorfehler prüfen.",
      "Bei Drucksystemen mechanischen Istzustand mit Manometer oder Herstellervorgabe absichern.",
    ],
    channels: [
      {
        label: "Signal",
        color: "#2563eb",
        unit: "V",
        scaleHint: "typisch innerhalb 0,5 bis 4,5 V",
        points: [0.22, 0.25, 0.28, 0.34, 0.38, 0.44, 0.5, 0.58, 0.64, 0.72, 0.78, 0.74, 0.66, 0.55, 0.43, 0.32],
      },
      {
        label: "5-V-Referenz",
        color: "#16a34a",
        unit: "V",
        scaleHint: "stabil",
        points: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
      },
    ],
    tags: ["drucksensor", "5v", "ladedrucksensor", "raildrucksensor", "klimadruck"],
    sourceNote: "Allgemeines Analogsignal. Kennlinie und Druckwert immer systemspezifisch prüfen.",
    updatedAt: "2026-07-13",
  },
  {
    id: "pump-current",
    slug: "pumpe-stromaufnahme",
    title: "Stromaufnahme Pumpe / Stellmotor",
    category: "Stromaufnahme",
    systemGroup: "Aktoren / Elektromotoren",
    signalType: "Stromzangenmessung",
    summary:
      "Die Stromaufnahme zeigt Anlaufstrom, Lastzustand und Kommutatorwelligkeit. Sie hilft bei Pumpen, Lüftern und Stellmotoren.",
    whenToUse: [
      "Pumpe läuft nicht, läuft laut oder bringt zu wenig Leistung.",
      "Sicherung löst aus oder Motor zieht zu viel Strom.",
      "Verdacht auf mechanische Blockade, Verschleiß oder Spannungsabfall.",
    ],
    measurementSetup: [
      "Stromzange um eine einzelne Versorgungsleitung legen.",
      "Spannung am Verbraucher parallel messen, wenn Lastproblem möglich ist.",
      "Anlauf und stabilen Lauf getrennt beurteilen.",
    ],
    expectedPattern:
      "Kurzer Anlaufstrom, danach stabiler Strom mit regelmäßiger Welligkeit. Unregelmäßige Spitzen deuten auf Kommutator- oder Lastprobleme.",
    referenceValues: [
      {
        label: "Anlaufstrom",
        value: "kurzzeitig höher als Laufstrom",
        condition: "Start des Motors",
        confidence: "allgemein",
        note: "Höhe ist stark abhängig von Motor, Pumpe, Temperatur und Versorgung.",
      },
      {
        label: "Welligkeit",
        value: "regelmäßig und wiederholbar",
        condition: "stabiler Lauf",
        confidence: "nur Vergleich",
        note: "Vergleich mit bekannt gutem Bauteil oder mehreren Betriebszuständen ist wichtig.",
      },
    ],
    commonFaults: [
      {
        title: "Hoher Strom mit niedriger Drehzahl",
        symptom: "Pumpe brummt, Sicherung belastet, Stellmotor schwergängig.",
        signalClue: "Strom deutlich hoch, Welligkeit langsam oder unregelmäßig.",
        nextCheck: "Mechanische Blockade, Lager, Pumpe, Leitung und Versorgung prüfen.",
        severity: "warning",
      },
      {
        title: "Strom fällt immer wieder ab",
        symptom: "Motor setzt aus.",
        signalClue: "Aussetzer oder Lücken im Stromverlauf.",
        nextCheck: "Stecker, Relais, PWM-Ansteuerung, Versorgung und Masse unter Last prüfen.",
        severity: "warning",
      },
    ],
    safetyNotes: [
      "Lüfter und Pumpen können unerwartet anlaufen.",
      "Bei Kraftstoffpumpen Brandgefahr und Druck im System beachten.",
    ],
    nextChecks: [
      "Spannungsversorgung unter Last parallel prüfen.",
      "Strombild mit Geräusch, Druck/Förderleistung oder Stellweg vergleichen.",
      "Wenn der Strom auffällig ist, mechanische Last nicht nur elektrisch bewerten.",
    ],
    channels: [
      {
        label: "Stromaufnahme",
        color: "#0f766e",
        unit: "A",
        scaleHint: "Anlauf plus Laufstrom",
        points: [0.02, 0.78, 0.55, 0.5, 0.56, 0.48, 0.55, 0.49, 0.57, 0.47, 0.54, 0.5, 0.56, 0.48, 0.55, 0.49],
      },
    ],
    tags: ["stromaufnahme", "pumpe", "stellmotor", "stromzange", "lüfter", "kraftstoffpumpe"],
    sourceNote: "Allgemeines Strombild. Stromhöhe und Welligkeit müssen mit konkretem Verbraucher verglichen werden.",
    updatedAt: "2026-07-13",
  },
];

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSignalSearchText(entry: SignalLibraryEntry) {
  return [
    entry.title,
    entry.category,
    entry.systemGroup,
    entry.signalType,
    entry.summary,
    entry.expectedPattern,
    ...entry.whenToUse,
    ...entry.measurementSetup,
    ...entry.nextChecks,
    ...entry.tags,
    ...entry.commonFaults.flatMap((fault) => [
      fault.title,
      fault.symptom,
      fault.signalClue,
      fault.nextCheck,
    ]),
  ].join(" ");
}

export function findSignalLibraryEntries({
  query,
  category,
}: {
  query?: string;
  category?: string;
}) {
  const normalizedQuery = normalizeSearchText(query || "");
  const queryTerms = normalizedQuery.split(" ").filter((term) => term.length >= 2);

  return SIGNAL_LIBRARY_SEED_ENTRIES.filter((entry) => {
    if (category && category !== "Alle" && entry.category !== category) {
      return false;
    }

    if (queryTerms.length === 0) {
      return true;
    }

    const haystack = normalizeSearchText(buildSignalSearchText(entry));

    return queryTerms.every((term) => haystack.includes(term));
  }).sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
}

function scoreSignalMatch(entry: SignalLibraryEntry, normalizedText: string) {
  const searchableTerms = [
    entry.title,
    entry.category,
    entry.systemGroup,
    entry.signalType,
    ...entry.tags,
  ]
    .flatMap((term) => normalizeSearchText(term).split(" "))
    .filter((term) => term.length >= 3);
  const uniqueTerms = Array.from(new Set(searchableTerms));
  const matchedTerms = uniqueTerms.filter((term) => normalizedText.includes(term));
  const titleMatch = normalizeSearchText(entry.title)
    .split(" ")
    .filter((term) => term.length >= 3)
    .some((term) => normalizedText.includes(term));

  return {
    entry,
    score: matchedTerms.length + (titleMatch ? 3 : 0),
  };
}

export function detectSignalLibraryContext(text: string) {
  const normalizedText = normalizeSearchText(text);

  if (!normalizedText) {
    return {
      foundSignals: [] as SignalLibraryEntry[],
      summary: "",
    };
  }

  const foundSignals = SIGNAL_LIBRARY_SEED_ENTRIES.map((entry) =>
    scoreSignalMatch(entry, normalizedText),
  )
    .filter((match) => match.score >= 2)
    .sort((a, b) => b.score - a.score)
    .map((match) => match.entry)
    .slice(0, 3);

  return {
    foundSignals,
    summary:
      foundSignals.length > 0
        ? foundSignals.map((entry) => entry.title).join(", ")
        : "",
  };
}

export function formatSignalLibraryContextForPrompt(
  context: ReturnType<typeof detectSignalLibraryContext>,
) {
  if (context.foundSignals.length === 0) {
    return "";
  }

  return `Oszilloskop- und Signalbibliothek:
${context.foundSignals
  .map((entry) => {
    return `Signal: ${entry.title}
System: ${entry.systemGroup}
Signalart: ${entry.signalType}
Gutbild: ${entry.expectedPattern}
Messaufbau:
${entry.measurementSetup.slice(0, 4).map((item) => `- ${item}`).join("\n")}
Referenzwerte:
${entry.referenceValues
  .slice(0, 3)
  .map((value) => `- ${value.label}: ${value.value} (${value.condition}; ${value.confidence})`)
  .join("\n")}
Typische Fehlerbilder:
${entry.commonFaults
  .slice(0, 3)
  .map((fault) => `- ${fault.title}: ${fault.signalClue}; prüfen: ${fault.nextCheck}`)
  .join("\n")}
Sicherheit:
${entry.safetyNotes.slice(0, 3).map((item) => `- ${item}`).join("\n")}
Hinweis: ${entry.sourceNote}`;
  })
  .join("\n\n---\n\n")}

Regel: Diese Signalwerte sind allgemeine Referenzen. Fahrzeuggenaue Herstellerdaten, Pinbelegung und bekannte Gutbilder haben Vorrang. Keine herstellerspezifischen Werte erfinden.`;
}
