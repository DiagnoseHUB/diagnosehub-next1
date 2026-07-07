import type {
  LearningCategory,
  LearningContentBlock,
  LearningDifficulty,
  LearningLesson,
  LearningModule,
  LearningQuizQuestion,
} from "@/types/learning";

const CATALOG_DATE = "2026-01-01T00:00:00.000Z";

type ModuleSeed = {
  categoryId: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: LearningDifficulty;
  estimatedMinutes: number;
  sortOrder: number;
  tags: string[];
  relatedFaultCodes?: string[];
  relatedParts?: string[];
  relatedSystems?: string[];
};

type LessonSeed = {
  moduleSlug: string;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  difficulty: LearningDifficulty;
  estimatedMinutes: number;
  sortOrder: number;
  focus: string;
  checklist: string[];
  quiz: LearningQuizQuestion;
  tags?: string[];
  relatedFaultCodes?: string[];
  relatedParts?: string[];
  relatedSystems?: string[];
  contentBlocks?: LearningContentBlock[];
  warning?: string;
};

export const LOCAL_LEARNING_CATEGORIES: LearningCategory[] = [
  {
    id: "local-cat-diagnose",
    slug: "diagnose-grundlagen",
    title: "Diagnose-Grundlagen",
    description: "Prüfstrategie, Messlogik, Dokumentation und Fehlersuche.",
    icon: "stethoscope",
    sortOrder: 10,
    isActive: true,
    createdAt: CATALOG_DATE,
    updatedAt: CATALOG_DATE,
  },
  {
    id: "local-cat-elektrik",
    slug: "elektrik-elektronik",
    title: "Elektrik & Elektronik",
    description: "Spannung, Masse, Signale, Sensoren und Aktoren.",
    icon: "zap",
    sortOrder: 20,
    isActive: true,
    createdAt: CATALOG_DATE,
    updatedAt: CATALOG_DATE,
  },
  {
    id: "local-cat-motor",
    slug: "motor-diesel-abgas",
    title: "Motor, Diesel & Abgas",
    description: "Luftpfad, Einspritzung, AGR, DPF, Ladedruck und Gemischbildung.",
    icon: "engine",
    sortOrder: 30,
    isActive: true,
    createdAt: CATALOG_DATE,
    updatedAt: CATALOG_DATE,
  },
  {
    id: "local-cat-fahrwerk",
    slug: "bremse-fahrwerk",
    title: "Bremse & Fahrwerk",
    description: "ABS/ESP, Verschleißbilder, Fahrwerkdiagnose und Sicherheit.",
    icon: "disc",
    sortOrder: 40,
    isActive: true,
    createdAt: CATALOG_DATE,
    updatedAt: CATALOG_DATE,
  },
  {
    id: "local-cat-klima",
    slug: "klima-thermomanagement",
    title: "Klima & Thermomanagement",
    description: "Klimaanlage, Kühlung, Wärmepumpe und Temperaturmanagement.",
    icon: "snowflake",
    sortOrder: 50,
    isActive: true,
    createdAt: CATALOG_DATE,
    updatedAt: CATALOG_DATE,
  },
  {
    id: "local-cat-prüfung",
    slug: "pruefungsvorbereitung",
    title: "Prüfungsvorbereitung",
    description: "Gesellenprüfung, Kundenauftrag, Fachgespräch und Bewertung.",
    icon: "clipboard",
    sortOrder: 60,
    isActive: true,
    createdAt: CATALOG_DATE,
    updatedAt: CATALOG_DATE,
  },
];

const MODULE_SEEDS: ModuleSeed[] = [
  {
    categoryId: "local-cat-diagnose",
    slug: "diagnose-pruefstrategie-vom-symptom-zur-ursache",
    title: "Prüfstrategie: vom Symptom zur Ursache",
    subtitle: "Sauber diagnostizieren statt Teiletausch auf Verdacht",
    description:
      "Lerne, wie du Kundenbeanstandung, Sichtprüfung, Messwerte und Abschlussprüfung zu einem belastbaren Diagnoseweg verbindest.",
    difficulty: "basic",
    estimatedMinutes: 55,
    sortOrder: 10,
    tags: ["diagnose", "prüfplan", "kundenauftrag", "abschlussprüfung"],
    relatedSystems: ["Diagnose", "Werkstattprozess"],
  },
  {
    categoryId: "local-cat-diagnose",
    slug: "obd-fehlercodes-und-istwerte-richtig-deuten",
    title: "OBD, Fehlercodes und Istwerte richtig deuten",
    subtitle: "Warum ein Fehlercode nie automatisch das defekte Teil nennt",
    description:
      "Fehlerspeicher, Freeze-Frame, Istwerte und Plausibilitätsprüfung praxisnah auswerten.",
    difficulty: "intermediate",
    estimatedMinutes: 60,
    sortOrder: 20,
    tags: ["obd", "fehlerspeicher", "istwerte", "freeze-frame"],
    relatedFaultCodes: ["P0101", "P0171", "P0299", "P0300"],
    relatedSystems: ["OBD", "Motormanagement"],
  },
  {
    categoryId: "local-cat-elektrik",
    slug: "elektrik-messen-spannungsfall-masse",
    title: "Elektrik messen: Spannung, Masse, Spannungsfall",
    subtitle: "Die Messlogik für 12-V-Fehler sicher beherrschen",
    description:
      "Lerne Messpunkte, Lastprüfung, Spannungsfall und Masseprobleme in realistischen Werkstattfällen.",
    difficulty: "basic",
    estimatedMinutes: 70,
    sortOrder: 30,
    tags: ["elektrik", "multimeter", "spannungsfall", "masse"],
    relatedParts: ["Batterie", "Massepunkt", "Sicherung", "Relais"],
    relatedSystems: ["Bordnetz", "Beleuchtung"],
  },
  {
    categoryId: "local-cat-elektrik",
    slug: "sensoren-aktoren-signalversorgung-pruefen",
    title: "Sensoren & Aktoren: Signal und Versorgung prüfen",
    subtitle: "Von der Steckverbindung bis zum plausiblen Signal",
    description:
      "Verstehe, wie Sensorversorgung, Masse, Signalleitung, PWM und Stellglieder systematisch geprüft werden.",
    difficulty: "intermediate",
    estimatedMinutes: 75,
    sortOrder: 40,
    tags: ["sensor", "aktor", "pwm", "signal", "oszilloskop"],
    relatedParts: ["Luftmassenmesser", "Drucksensor", "Magnetventil"],
    relatedSystems: ["Motormanagement", "Bordnetz"],
  },
  {
    categoryId: "local-cat-elektrik",
    slug: "bauteile-verstehen-sensoren-relais-generator",
    title: "Bauteile verstehen: Sensor, Relais, Generator",
    subtitle: "NTC, Wechslerrelais und Drehstromgenerator konkret erklärt",
    description:
      "Kurze Bauteil-Lektionen für Azubis: Funktion, Klemmen, typische Messwerte, Fehlerbilder und Prüfweg.",
    difficulty: "basic",
    estimatedMinutes: 58,
    sortOrder: 45,
    tags: ["bauteilwissen", "ntc", "relais", "generator", "elektrik"],
    relatedParts: ["NTC-Sensor", "Wechslerrelais", "Drehstromgenerator"],
    relatedSystems: ["Bordnetz", "Sensorik", "Ladesystem"],
  },
  {
    categoryId: "local-cat-motor",
    slug: "diesel-ladedruck-agr-dpf-systemdiagnose",
    title: "Diesel-Systemdiagnose: Ladedruck, AGR und DPF",
    subtitle: "Luftpfad und Abgasnachbehandlung als Gesamtsystem verstehen",
    description:
      "Praxisnaher Diagnoseweg für Leistungsverlust, Notlauf, P0299, AGR-Probleme und DPF-Regeneration.",
    difficulty: "advanced",
    estimatedMinutes: 95,
    sortOrder: 50,
    tags: ["diesel", "ladedruck", "agr", "dpf", "notlauf"],
    relatedFaultCodes: ["P0299", "P0401", "P0402", "P2002", "P0101"],
    relatedParts: ["Turbolader", "AGR-Ventil", "DPF", "Ladedrucksensor"],
    relatedSystems: ["Diesel", "Abgas", "Ladeluft"],
  },
  {
    categoryId: "local-cat-motor",
    slug: "ottomotor-gemisch-zuendaussetzer-lambda",
    title: "Ottomotor: Gemisch, Zündaussetzer und Lambda",
    subtitle: "Magerlauf, Fehlzündung und Regelung sauber unterscheiden",
    description:
      "Lerne, wie Kraftstoffdruck, Falschluft, Zündung, Einspritzung und Lambda-Regelung zusammenhängen.",
    difficulty: "advanced",
    estimatedMinutes: 85,
    sortOrder: 60,
    tags: ["ottomotor", "lambda", "falschluft", "zündaussetzer"],
    relatedFaultCodes: ["P0171", "P0300", "P0301", "P0130"],
    relatedParts: ["Lambdasonde", "Zündspule", "Injektor", "Saugrohr"],
    relatedSystems: ["Motormanagement", "Abgas"],
  },
  {
    categoryId: "local-cat-fahrwerk",
    slug: "bremse-fahrwerk-abs-esp-diagnose",
    title: "Bremse, Fahrwerk, ABS/ESP",
    subtitle: "Sicherheitsrelevante Systeme fachgerecht prüfen",
    description:
      "Von Verschleißbildern über Raddrehzahlsensoren bis zur ABS/ESP-Diagnose mit Messwerten und Probefahrt.",
    difficulty: "intermediate",
    estimatedMinutes: 80,
    sortOrder: 70,
    tags: ["bremse", "fahrwerk", "abs", "esp", "raddrehzahlsensor"],
    relatedFaultCodes: ["C0035", "C0040", "C0110"],
    relatedParts: ["Raddrehzahlsensor", "Radlager", "Bremssattel", "Querlenker"],
    relatedSystems: ["Bremse", "Fahrwerk", "ABS"],
  },
  {
    categoryId: "local-cat-klima",
    slug: "klima-kuehlung-thermomanagement-pruefen",
    title: "Klima, Kühlung und Thermomanagement",
    subtitle: "Temperaturen, Drücke und Luftführung richtig bewerten",
    description:
      "Diagnose an Klimaanlage, Kühlkreislauf, Lüftersteuerung und Heizleistung mit klarer Prüfreihenfolge.",
    difficulty: "intermediate",
    estimatedMinutes: 75,
    sortOrder: 80,
    tags: ["klima", "kühlung", "thermomanagement", "druck"],
    relatedParts: ["Kompressor", "Kondensator", "Expansionsventil", "Thermostat"],
    relatedSystems: ["Klimaanlage", "Kühlung"],
  },
  {
    categoryId: "local-cat-prüfung",
    slug: "gesellenpruefung-werkstattfaelle-fachgespraech",
    title: "Gesellenprüfung: Werkstattfälle & Fachgespräch",
    subtitle: "Antworten wie in der Prüfung strukturieren",
    description:
      "Trainiere, wie du Kundenauftrag, Prüfplan, Messwerte, Reparaturentscheidung und Abschlussprüfung prüfungssicher erklärst.",
    difficulty: "advanced",
    estimatedMinutes: 90,
    sortOrder: 90,
    tags: ["gesellenprüfung", "fachgespräch", "kundenauftrag", "bewertung"],
    relatedSystems: ["Prüfung", "Werkstattprozess"],
  },
];

function makeModule(seed: ModuleSeed): LearningModule {
  return {
    id: `local-module-${seed.slug}`,
    categoryId: seed.categoryId,
    slug: seed.slug,
    title: seed.title,
    subtitle: seed.subtitle,
    description: seed.description,
    difficulty: seed.difficulty,
    requiredPlan: "free",
    estimatedMinutes: seed.estimatedMinutes,
    sortOrder: seed.sortOrder,
    tags: seed.tags,
    relatedFaultCodes: seed.relatedFaultCodes || [],
    relatedParts: seed.relatedParts || [],
    relatedSystems: seed.relatedSystems || [],
    isPublished: true,
    publishedAt: CATALOG_DATE,
    createdAt: CATALOG_DATE,
    updatedAt: CATALOG_DATE,
  };
}

function blockLessonContent(seed: LessonSeed): LearningContentBlock[] {
  return [
    {
      type: "text",
      title: "Werkstattziel",
      content: seed.focus,
    },
    ...(seed.contentBlocks || []),
    {
      type: "list",
      title: "Prüflogik",
      items: [
        "Beanstandung reproduzieren und Randbedingungen notieren.",
        "Sichtprüfung vor Messung: Stecker, Leitung, Dichtung, Befestigung und offensichtliche Schäden.",
        "Mit Soll-/Ist-Vergleich arbeiten, nicht mit Vermutungen.",
        "Unter Last prüfen, wenn der Fehler nur unter Last auftreten kann.",
        "Ergebnis so dokumentieren, dass ein anderer Techniker den Weg nachvollziehen kann.",
      ],
    },
    {
      type: "text",
      title: "Typischer Fehler in der Praxis",
      content:
        "Viele Diagnosen scheitern nicht am fehlenden Spezialwerkzeug, sondern an einer falschen Reihenfolge: Bauteil ersetzen, bevor Versorgung, Masse, Mechanik und Plausibilität geprüft wurden.",
    },
    {
      type: "warning",
      title: "Merke",
      content:
        seed.warning ||
        "Ein einzelner Messwert ist selten genug. Entscheidend ist, ob Symptom, Fehlercode, Istwert und Prüfergebnis zusammenpassen.",
    },
  ];
}

function makeLesson(seed: LessonSeed): LearningLesson {
  const learningModule = LOCAL_LEARNING_MODULES.find(
    (entry) => entry.slug === seed.moduleSlug,
  );

  if (!learningModule) {
    throw new Error(`Lokales Lernmodul fehlt: ${seed.moduleSlug}`);
  }

  return {
    id: `local-lesson-${seed.slug}`,
    moduleId: learningModule.id,
    slug: seed.slug,
    title: seed.title,
    subtitle: seed.subtitle,
    summary: seed.summary,
    difficulty: seed.difficulty,
    requiredPlan: "free",
    estimatedMinutes: seed.estimatedMinutes,
    sortOrder: seed.sortOrder,
    contentBlocks: blockLessonContent(seed),
    checklist: seed.checklist,
    quizQuestions: [seed.quiz],
    tags: seed.tags || learningModule.tags,
    relatedFaultCodes: seed.relatedFaultCodes || learningModule.relatedFaultCodes,
    relatedParts: seed.relatedParts || learningModule.relatedParts,
    relatedSystems: seed.relatedSystems || learningModule.relatedSystems,
    isPublished: true,
    publishedAt: CATALOG_DATE,
    createdAt: CATALOG_DATE,
    updatedAt: CATALOG_DATE,
  };
}

export const LOCAL_LEARNING_MODULES: LearningModule[] = MODULE_SEEDS.map(makeModule);

const LESSON_SEEDS: LessonSeed[] = [
  {
    moduleSlug: "diagnose-pruefstrategie-vom-symptom-zur-ursache",
    slug: "kundenbeanstandung-und-pruefziel-formulieren",
    title: "Kundenbeanstandung in ein Prüfziel übersetzen",
    subtitle: "Aus vagen Aussagen eine prüfbare Aufgabe machen",
    summary:
      "Du lernst, wie aus 'macht manchmal Probleme' ein klares Symptom mit Bedingungen, Prüfziel und Diagnosegrenze wird.",
    difficulty: "basic",
    estimatedMinutes: 18,
    sortOrder: 10,
    focus:
      "Nach dieser Lektion kannst du Kundenangaben, Probefahrt und Sichtprüfung so verbinden, dass der weitere Diagnoseweg klar wird.",
    checklist: [
      "Symptom mit Kundenwortlaut notieren.",
      "Bedingungen klären: kalt, warm, Last, Standzeit, Geschwindigkeit, Wetter.",
      "Fehler reproduzieren oder Nicht-Reproduzierbarkeit dokumentieren.",
      "Prüfziel als Frage formulieren: Was muss ich beweisen oder ausschließen?",
    ],
    quiz: {
      question: "Welche Formulierung ist als Prüfziel am besten?",
      answers: [
        "Irgendwas mit Motor prüfen.",
        "Prüfen, ob Ladedruck unter Last den Sollwert erreicht und ob die Ladeluftstrecke dicht ist.",
        "Turbolader tauschen.",
        "Fehler löschen.",
      ],
      correctIndex: 1,
      explanation:
        "Ein gutes Prüfziel ist konkret, messbar und lässt mehrere Ursachen offen.",
    },
  },
  {
    moduleSlug: "diagnose-pruefstrategie-vom-symptom-zur-ursache",
    slug: "pruefreihenfolge-p1-bis-p5",
    title: "Prüfreihenfolge P1 bis P5",
    subtitle: "Vom einfachen Ausschluss zur belastbaren Ursache",
    summary:
      "Du strukturierst Diagnosefälle in Sichtprüfung, Versorgung, Signal/Istwert, Funktionsprüfung und Abschlussprüfung.",
    difficulty: "basic",
    estimatedMinutes: 20,
    sortOrder: 20,
    focus:
      "Du lernst eine stabile Reihenfolge, die in Elektrik, Motor, Fahrwerk und Klimaanlage funktioniert.",
    checklist: [
      "P1 Sichtprüfung: offensichtliche Mängel suchen.",
      "P2 Versorgung: Plus, Masse, Stecker, Sicherung, Leitung prüfen.",
      "P3 Signal/Istwert: Sensor- und Steuergerätedaten plausibilisieren.",
      "P4 Funktion: Druck, Dichtheit, Bewegung oder Stellglied prüfen.",
      "P5 Abschluss: Reparatur bestätigen und dokumentieren.",
    ],
    quiz: {
      question: "Warum kommt die Sichtprüfung vor der Messung?",
      answers: [
        "Weil sie Fehler wie lose Stecker, Risse oder Lecks schnell sichtbar machen kann.",
        "Weil Messgeräte im Fahrzeug nicht erlaubt sind.",
        "Weil Fehlercodes danach verschwinden.",
        "Weil Sichtprüfung immer die Reparatur ersetzt.",
      ],
      correctIndex: 0,
      explanation:
        "Viele Fehler sind mechanisch oder kontaktbedingt sichtbar. Das spart Zeit und verhindert falsche Messinterpretation.",
    },
  },
  {
    moduleSlug: "diagnose-pruefstrategie-vom-symptom-zur-ursache",
    slug: "abschlusspruefung-und-dokumentation",
    title: "Abschlussprüfung & Dokumentation",
    subtitle: "Beweisen, dass der Fehler wirklich behoben ist",
    summary:
      "Du lernst, wie Probefahrt, Istwerte, Fehlerspeicher und Kundendokumentation eine Diagnose abschliessen.",
    difficulty: "basic",
    estimatedMinutes: 17,
    sortOrder: 30,
    focus:
      "Die Reparatur ist erst fertig, wenn der ursprüngliche Fehler unter passenden Bedingungen nicht mehr auftritt.",
    checklist: [
      "Fehlerspeicher vor und nach Reparatur dokumentieren.",
      "Reparierte Stelle und Ursache notieren.",
      "Probefahrt oder Funktionsprüfung passend zur Beanstandung durchführen.",
      "Istwerte nach Reparatur mit Ausgangswerten vergleichen.",
    ],
    quiz: {
      question: "Was ist eine belastbare Abschlussprüfung nach einem Ladedruckleck?",
      answers: [
        "Nur Motor starten.",
        "Fehler löschen, Lastfahrt machen, Soll-/Ist-Ladedruck vergleichen und Speicher erneut prüfen.",
        "Batterie abklemmen.",
        "Kunden sagen, die Leuchte sei aus.",
      ],
      correctIndex: 1,
      explanation:
        "Die Prüfung muss den ursprünglichen Fehlerzustand nachstellen und Messwerte bestätigen.",
    },
  },
  {
    moduleSlug: "obd-fehlercodes-und-istwerte-richtig-deuten",
    slug: "fehlercode-ist-nicht-bauteilname",
    title: "Fehlercode ist nicht Bauteilname",
    subtitle: "P0101 bedeutet nicht automatisch LMM defekt",
    summary:
      "Du lernst, wie Fehlercodes entstehen und warum Ursache, Symptom und erkannter Fehler unterschieden werden müssen.",
    difficulty: "intermediate",
    estimatedMinutes: 20,
    sortOrder: 10,
    focus:
      "Ein Steuergerät meldet eine Abweichung. Die Ursache kann Sensor, Leitung, Mechanik, Undichtigkeit oder Betriebszustand sein.",
    checklist: [
      "Fehlertext und Bedingungen lesen.",
      "Freeze-Frame sichern.",
      "Technische Funktion des betroffenen Systems klären.",
      "Mögliche Ursachen nach Wahrscheinlichkeit sortieren.",
    ],
    quiz: {
      question: "Was ist bei P0101 fachlich korrekt?",
      answers: [
        "Der Luftmassenmesser ist immer defekt.",
        "Das Luftmassensignal ist unplausibel; Ursache muss geprüft werden.",
        "Der Fehler betrifft nur Reifen.",
        "Der Code darf ignoriert werden.",
      ],
      correctIndex: 1,
      explanation:
        "P0101 beschreibt eine Plausibilitätsabweichung, nicht automatisch ein defektes Bauteil.",
    },
  },
  {
    moduleSlug: "obd-fehlercodes-und-istwerte-richtig-deuten",
    slug: "freeze-frame-und-randbedingungen",
    title: "Freeze-Frame & Randbedingungen nutzen",
    subtitle: "Den Fehlerzustand verstehen",
    summary:
      "Du interpretierst Drehzahl, Last, Temperatur und Geschwindigkeit zum Zeitpunkt der Fehlererkennung.",
    difficulty: "intermediate",
    estimatedMinutes: 20,
    sortOrder: 20,
    focus:
      "Freeze-Frame-Daten helfen, die Prüfung unter den Bedingungen zu wiederholen, bei denen der Fehler wirklich auftrat.",
    checklist: [
      "Motortemperatur und Lastzustand notieren.",
      "Standzeit, Geschwindigkeit und Drehzahl bewerten.",
      "Fehler nach Möglichkeit unter ähnlichen Bedingungen reproduzieren.",
      "Nicht passende Prüfbedingungen vermeiden.",
    ],
    quiz: {
      question: "Warum sind Freeze-Frame-Daten bei sporadischen Fehlern wichtig?",
      answers: [
        "Sie zeigen Randbedingungen beim Fehler.",
        "Sie ersetzen jede Messung.",
        "Sie löschen den Fehler.",
        "Sie zeigen immer die defekte Teilenummer.",
      ],
      correctIndex: 0,
      explanation:
        "Sie zeigen, wann das Steuergerät die Abweichung erkannt hat, und helfen bei der Reproduktion.",
    },
  },
  {
    moduleSlug: "obd-fehlercodes-und-istwerte-richtig-deuten",
    slug: "istwerte-plausibilisieren",
    title: "Istwerte plausibilisieren",
    subtitle: "Messwerte im Systemzusammenhang lesen",
    summary:
      "Du vergleichst Luftmasse, Ladedruck, Temperatur, Lambda und Stellgrößen statt einzelne Werte isoliert zu betrachten.",
    difficulty: "intermediate",
    estimatedMinutes: 20,
    sortOrder: 30,
    focus:
      "Plausibilität entsteht aus mehreren Werten: Sollwert, Istwert, Ansteuerung, Betriebszustand und Symptom.",
    checklist: [
      "Soll- und Istwert vergleichen.",
      "Ansteuerung oder Stellgröße dazunehmen.",
      "Betriebszustand beachten.",
      "Unplausible Einzelwerte mit zweiter Messmethode prüfen.",
    ],
    quiz: {
      question: "Was spricht für ein Ladedruckproblem unter Last?",
      answers: [
        "Soll-Ladedruck hoch, Ist-Ladedruck niedrig, Luftmasse niedrig.",
        "Kühlmitteltemperatur 90 Grad bei warmem Motor.",
        "Batteriespannung 12,5 V bei Motor aus.",
        "Innenraumlicht funktioniert.",
      ],
      correctIndex: 0,
      explanation:
        "Die Kombination aus Soll-/Ist-Abweichung und niedriger Luftmasse passt zum Luftpfad.",
    },
  },
  {
    moduleSlug: "elektrik-messen-spannungsfall-masse",
    slug: "multimeter-richtig-einsetzen",
    title: "Multimeter richtig einsetzen",
    subtitle: "Messbereich, Bezugspunkt und Last verstehen",
    summary:
      "Du lernst, warum eine Messung nur dann wertvoll ist, wenn Messart, Bezugspunkt und Betriebszustand stimmen.",
    difficulty: "basic",
    estimatedMinutes: 22,
    sortOrder: 10,
    focus:
      "Das Multimeter zeigt nur, was zwischen zwei Messpunkten in diesem Moment passiert. Ohne Last kann ein Fehler unsichtbar bleiben.",
    checklist: [
      "Messart wählen: Spannung, Widerstand, Strom.",
      "Richtigen Bezugspunkt setzen.",
      "Schaltzustand und Last herstellen.",
      "Messwert mit erwarteter Funktion vergleichen.",
    ],
    quiz: {
      question: "Warum kann eine Leitung ohne Last gut aussehen, aber unter Last ausfallen?",
      answers: [
        "Übergangswiderstand fällt erst bei Stromfluss deutlich auf.",
        "Spannung ist immer gleich Strom.",
        "Ein Multimeter kann keine Spannung messen.",
        "Massepunkte sind nie relevant.",
      ],
      correctIndex: 0,
      explanation:
        "Unter Last entsteht am Widerstand ein Spannungsabfall, der den Verbraucher stören kann.",
    },
  },
  {
    moduleSlug: "elektrik-messen-spannungsfall-masse",
    slug: "spannungsfall-plus-und-masse",
    title: "Spannungsfall an Plus und Masse",
    subtitle: "Übergangswiderstand sicher finden",
    summary:
      "Du prüfst Plus- und Massepfad unter Last und erkennst, warum Verbraucher trotz Spannung nicht richtig arbeiten.",
    difficulty: "basic",
    estimatedMinutes: 24,
    sortOrder: 20,
    focus:
      "Beim Spannungsfall misst du den Verlust auf einem Leitungsabschnitt, nicht die Versorgung gegen Masse.",
    checklist: [
      "Verbraucher einschalten.",
      "Pluspfad von Batterie Plus bis Verbraucher Plus prüfen.",
      "Massepfad von Verbraucher Masse bis Batterie Minus prüfen.",
      "Auffälligen Abschnitt eingrenzen.",
    ],
    quiz: {
      question: "Was zeigt ein hoher Spannungsfall auf der Masseseite?",
      answers: [
        "Im Massepfad liegt ein Widerstand oder Kontaktproblem.",
        "Der Tank ist leer.",
        "Der Reifen ist abgefahren.",
        "Der Sensor ist zwingend mechanisch defekt.",
      ],
      correctIndex: 0,
      explanation:
        "Masseprobleme zeigen sich oft erst unter Last als Spannungsabfall.",
    },
  },
  {
    moduleSlug: "elektrik-messen-spannungsfall-masse",
    slug: "ruhestrom-und-batterie-diagnose",
    title: "Ruhestrom & Batterie-Diagnose",
    subtitle: "Standzeitprobleme systematisch eingrenzen",
    summary:
      "Du unterscheidest schwache Batterie, Ladeproblem und zu hohen Ruhestrom.",
    difficulty: "basic",
    estimatedMinutes: 24,
    sortOrder: 30,
    focus:
      "Eine leere Batterie nach Standzeit kann Ursache oder Folge sein. Entscheidend ist die Reihenfolge: Zustand, Ladung, Ruhestrom.",
    checklist: [
      "Batteriezustand und Ladezustand prüfen.",
      "Generatorladespannung unter Last bewerten.",
      "Ruhestrommessung mit Einschlafzeit vorbereiten.",
      "Stromkreis bei zu hohem Ruhestrom eingrenzen.",
    ],
    quiz: {
      question: "Wie wird Ruhestrom grundsätzlich gemessen?",
      answers: [
        "In Reihe zur Batterie nach Beachtung der Einschlafzeit.",
        "Parallel zur Batterie wie Spannung.",
        "Nur am Reifenventil.",
        "Mit abgezogenem Messgerät.",
      ],
      correctIndex: 0,
      explanation:
        "Strommessung erfolgt in Reihe; Steuergeräte dürfen die Messung nicht durch Aufwachen verfalschen.",
    },
  },
  {
    moduleSlug: "sensoren-aktoren-signalversorgung-pruefen",
    slug: "sensorversorgung-5v-masse-signal",
    title: "Sensorversorgung: 5 V, Masse, Signal",
    subtitle: "Drei Leitungen, viele Fehlerquellen",
    summary:
      "Du prüfst Sensoren nicht nur am Bauteil, sondern über Versorgung, Masse, Signal und Plausibilität.",
    difficulty: "intermediate",
    estimatedMinutes: 25,
    sortOrder: 10,
    focus:
      "Ein Sensorsignal kann nur plausibel sein, wenn Versorgung, Masse, Leitung und mechanische Messgröße stimmen.",
    checklist: [
      "Stecker und Pins sichtprüfen.",
      "Referenzspannung gegen Sensormasse messen.",
      "Massequalität unter Last bewerten.",
      "Signalverlauf mit Istwert vergleichen.",
    ],
    quiz: {
      question: "Welche Prüfung kommt vor dem Sensortausch?",
      answers: [
        "Versorgung, Masse und Signal am Sensor prüfen.",
        "Immer Steuergerät ersetzen.",
        "Fehler ignorieren.",
        "Nur Reifenluftdruck messen.",
      ],
      correctIndex: 0,
      explanation:
        "Viele Sensorfehler entstehen durch Leitung, Kontakt, Masse oder Versorgung.",
    },
  },
  {
    moduleSlug: "sensoren-aktoren-signalversorgung-pruefen",
    slug: "pwm-und-stellglieder-verstehen",
    title: "PWM & Stellglieder verstehen",
    subtitle: "Warum ein Aktor nicht einfach nur Ein/Aus ist",
    summary:
      "Du lernst Tastverhältnis, Ansteuerung, mechanische Reaktion und Rückmeldung zu unterscheiden.",
    difficulty: "intermediate",
    estimatedMinutes: 25,
    sortOrder: 20,
    focus:
      "Bei Stellgliedern muss die elektrische Ansteuerung zur mechanischen Wirkung passen.",
    checklist: [
      "Stellgliedtest auslösen, wenn verfügbar.",
      "Ansteuerung messen oder Istwert beobachten.",
      "Mechanische Bewegung oder Druckänderung prüfen.",
      "Versorgung und Masse unter Last bewerten.",
    ],
    quiz: {
      question: "Was beschreibt PWM?",
      answers: [
        "Eine Ansteuerung über ein Tastverhältnis.",
        "Eine Reifengröße.",
        "Immer eine konstante Gleichspannung von 12 V.",
        "Einen Kühlmitteltyp.",
      ],
      correctIndex: 0,
      explanation:
        "PWM steuert Leistung oder Stellung über Ein-/Aus-Zeiten in schneller Folge.",
    },
  },
  {
    moduleSlug: "sensoren-aktoren-signalversorgung-pruefen",
    slug: "stecker-pins-korrosion-kontaktfehler",
    title: "Stecker, Pins und Kontaktfehler",
    subtitle: "Sporadische Fehler sauber nachweisen",
    summary:
      "Du erkennst Kontaktprobleme, ohne Pins aufzubiegen oder Fehler durch falsches Prüfen zu erzeugen.",
    difficulty: "intermediate",
    estimatedMinutes: 25,
    sortOrder: 30,
    focus:
      "Kontaktfehler sind oft temperatur-, vibrations- oder feuchtigkeitsabhängig. Sichtprüfung und Wackeltest müssen kontrolliert erfolgen.",
    checklist: [
      "Steckverriegelung und Zugentlastung prüfen.",
      "Korrosion, Feuchtigkeit und Pinrückstand suchen.",
      "Wackeltest mit Live-Istwerten durchführen.",
      "Keine Pins mit ungeeigneten Spitzen beschädigen.",
    ],
    quiz: {
      question: "Was ist bei Pin-Prüfungen wichtig?",
      answers: [
        "Geeignete Prüfspitzen nutzen, damit Kontakte nicht aufgeweitet werden.",
        "Pins immer mit Gewalt reinigen.",
        "Stecker nie ansehen.",
        "Kontaktfehler können nicht sporadisch sein.",
      ],
      correctIndex: 0,
      explanation:
        "Ungeeignete Prüfung kann den Fehler verschlimmern oder neue Kontaktprobleme erzeugen.",
    },
  },
  {
    moduleSlug: "bauteile-verstehen-sensoren-relais-generator",
    slug: "ntc-temperatursensor-verstehen",
    title: "NTC-Temperatursensor verstehen",
    subtitle: "Warum der Widerstand bei Wärme sinkt",
    summary:
      "Du lernst, was ein NTC ist, wie das Steuergerät daraus Temperatur macht und wie du Sensor, Leitung und Plausibilität prüfst.",
    difficulty: "basic",
    estimatedMinutes: 18,
    sortOrder: 10,
    focus:
      "Nach dieser Lektion kannst du einen NTC normal erklären: kalt hoher Widerstand, warm niedriger Widerstand, Steuergerät bewertet daraus eine Spannung.",
    contentBlocks: [
      {
        type: "text",
        title: "Was bedeutet NTC?",
        content:
          "NTC steht für Negative Temperature Coefficient. Das heißt: Wenn die Temperatur steigt, sinkt der Widerstand. Bei Kälte ist der Widerstand hoch, bei Wärme niedrig.",
      },
      {
        type: "text",
        title: "Wie liest das Steuergerät den Sensor?",
        content:
          "Typisch arbeitet der NTC in einem Spannungsteiler. Das Steuergerät legt eine Referenzspannung an und misst die Signalspannung. Bei vielen Schaltungen bedeutet kalt: hohe Signalspannung. Warm bedeutet: niedrigere Signalspannung. Die genaue Kennlinie ist herstellerabhängig.",
      },
      {
        type: "list",
        title: "Typische Fehlerbilder",
        items: [
          "Leitungsunterbrechung oder Stecker ab: Istwert oft sehr kalt, zum Beispiel etwa -40 Grad Celsius.",
          "Kurzschluss gegen Masse: Istwert oft sehr heiß oder unplausibel hoch.",
          "Sensor driftet: Wert ist nicht komplett falsch, aber passt nicht zu Motorzustand oder Umgebung.",
          "Kontaktproblem: Wert springt bei Wackeltest oder Temperaturänderung.",
        ],
      },
      {
        type: "list",
        title: "Konkrete Prüfung",
        items: [
          "Istwert kalt mit Außentemperatur vergleichen.",
          "Istwert bei Erwärmung beobachten: Der Wert muss gleichmäßig steigen.",
          "Widerstand bei zwei Temperaturen messen und mit Herstellerkennlinie vergleichen.",
          "Stecker, Pins, Masse und Signalleitung prüfen, bevor der Sensor ersetzt wird.",
        ],
      },
    ],
    checklist: [
      "Sensorfunktion in einem Satz erklären.",
      "Istwert kalt und warm plausibilisieren.",
      "Unterbrechung und Kurzschluss als Fehlerbild unterscheiden.",
      "Sensor nicht ohne Leitungs- und Steckprüfung ersetzen.",
    ],
    quiz: {
      question: "Was passiert beim NTC, wenn die Temperatur steigt?",
      answers: [
        "Der Widerstand sinkt.",
        "Der Widerstand steigt immer stark an.",
        "Der Sensor wird zu einem Relais.",
        "Die Versorgungsspannung der Batterie verschwindet.",
      ],
      correctIndex: 0,
      explanation:
        "NTC bedeutet negativer Temperaturkoeffizient: mehr Temperatur, weniger Widerstand.",
    },
    tags: ["ntc", "temperatursensor", "widerstand", "spannungsteiler"],
    relatedParts: ["NTC-Sensor", "Kühlmitteltemperatursensor", "Ansauglufttemperatursensor"],
    relatedSystems: ["Sensorik", "Motormanagement", "Thermomanagement"],
  },
  {
    moduleSlug: "bauteile-verstehen-sensoren-relais-generator",
    slug: "wechslerrelais-klemmen-und-funktion",
    title: "Wechslerrelais: Klemmen und Funktion",
    subtitle: "30, 85, 86, 87 und 87a sicher zuordnen",
    summary:
      "Du lernst die Klemmen eines Wechslerrelais, den Unterschied zwischen Ruhe- und Arbeitskontakt und die einfache Prüfung mit Multimeter.",
    difficulty: "basic",
    estimatedMinutes: 18,
    sortOrder: 20,
    focus:
      "Du kannst ein Wechslerrelais erklären: Die Spule schaltet einen gemeinsamen Kontakt zwischen 87a und 87 um.",
    contentBlocks: [
      {
        type: "list",
        title: "Klemmen am Wechslerrelais",
        items: [
          "85 und 86: Relaisspule. Hier wird das Relais angesteuert.",
          "30: gemeinsamer Eingang oder gemeinsamer Kontakt.",
          "87a: Ruhekontakt. Mit 30 verbunden, solange die Spule nicht bestromt ist.",
          "87: Arbeitskontakt. Mit 30 verbunden, wenn die Spule bestromt ist.",
          "87b, falls vorhanden: zweiter Arbeitsausgang. Nicht mit 87a verwechseln.",
        ],
      },
      {
        type: "text",
        title: "Was passiert beim Schalten?",
        content:
          "Ohne Ansteuerung liegt 30 auf 87a. Sobald an 85/86 die Spule bestromt wird, zieht der Anker an. Dann trennt 30 von 87a und verbindet 30 mit 87.",
      },
      {
        type: "list",
        title: "Prüfung in der Werkstatt",
        items: [
          "Widerstand der Spule zwischen 85 und 86 messen.",
          "Mit Durchgangsprüfung kontrollieren: 30 zu 87a in Ruhe, 30 zu 87 bei Ansteuerung.",
          "Ansteuerung und Lastkreis getrennt prüfen: Spule kann klicken, obwohl Kontakt verbrannt ist.",
          "Bei Relais mit Diode oder Elektronik Polung beachten.",
        ],
      },
    ],
    checklist: [
      "Spule und Lastkontakt nicht verwechseln.",
      "Ruhekontakt 87a und Arbeitskontakt 87 erklären.",
      "Durchgang in Ruhe und bei Ansteuerung prüfen.",
      "Relais mit Diode nur korrekt gepolt bestromen.",
    ],
    quiz: {
      question: "Welche Klemme ist beim Wechslerrelais der Ruhekontakt?",
      answers: ["87a", "85", "86", "Klemme 31"],
      correctIndex: 0,
      explanation:
        "87a ist mit 30 verbunden, solange die Spule nicht bestromt wird.",
    },
    tags: ["relais", "wechslerrelais", "klemme 30", "klemme 87", "klemme 87a"],
    relatedParts: ["Wechslerrelais", "Sicherung", "Schalter"],
    relatedSystems: ["Bordnetz", "Beleuchtung", "Lüftersteuerung"],
  },
  {
    moduleSlug: "bauteile-verstehen-sensoren-relais-generator",
    slug: "drehstromgenerator-ladesystem-konkret",
    title: "Drehstromgenerator konkret erklärt",
    subtitle: "Erregerfeld, Stator, Dioden und Regler verstehen",
    summary:
      "Du lernst, wie der Generator aus Bewegung elektrische Energie macht, warum Gleichrichtung nötig ist und welche Prüfungen bei Ladeproblemen zuerst kommen.",
    difficulty: "basic",
    estimatedMinutes: 22,
    sortOrder: 30,
    focus:
      "Du kannst den Drehstromgenerator als System erklären: Rotor erzeugt ein Magnetfeld, Stator erzeugt Drehstrom, Dioden machen Gleichstrom, Regler steuert die Spannung.",
    contentBlocks: [
      {
        type: "list",
        title: "Bauteile und Aufgabe",
        items: [
          "Rotor: erzeugt mit Erregerstrom ein drehendes Magnetfeld.",
          "Stator: in den Wicklungen entsteht dreiphasiger Wechselstrom.",
          "Gleichrichterdioden: wandeln den Wechselstrom in Gleichstrom für das Bordnetz.",
          "Regler: steuert den Erregerstrom und hält die Ladespannung passend.",
          "Riemenantrieb und Freilauf: übertragen die mechanische Leistung vom Motor.",
        ],
      },
      {
        type: "list",
        title: "Typische Anschlüsse",
        items: [
          "B+: Ladeleitung zur Batterie und zum Bordnetz.",
          "Masse: über Gehäuse oder separate Masseverbindung.",
          "D+ oder L: Ladekontrollleuchte beziehungsweise Erregung, je nach System.",
          "LIN, COM oder BSD: digitale Generatoransteuerung bei modernen Fahrzeugen.",
          "W, falls vorhanden: Drehzahlsignal bei bestimmten Anwendungen.",
        ],
      },
      {
        type: "list",
        title: "Prüfung bei Ladeproblemen",
        items: [
          "Batteriezustand zuerst bewerten, sonst wirkt der Generator schnell falsch.",
          "Ladespannung im Leerlauf und unter Last messen.",
          "Spannungsfall auf Plusleitung und Massepfad prüfen.",
          "Riemen, Freilauf, Stecker und Generatoransteuerung prüfen.",
          "Bei Wechselspannungsanteil oder Flackern Gleichrichterdioden mitdenken.",
        ],
      },
    ],
    checklist: [
      "Mechanik, Batterie und Leitungen vor Generatortausch prüfen.",
      "B+ und Masse unter Last messen.",
      "Ladespannung nicht ohne Betriebszustand bewerten.",
      "Bei modernem Generator Kommunikationsleitung und Steuergerätedaten beachten.",
    ],
    quiz: {
      question: "Welche Aufgabe haben die Dioden im Drehstromgenerator?",
      answers: [
        "Sie richten den erzeugten Wechselstrom zu Gleichstrom für das Bordnetz gleich.",
        "Sie speichern Kraftstoffdruck.",
        "Sie messen Raddrehzahl.",
        "Sie ersetzen den Keilrippenriemen.",
      ],
      correctIndex: 0,
      explanation:
        "Der Stator erzeugt Wechselstrom. Das Fahrzeugbordnetz braucht Gleichstrom, deshalb übernimmt der Gleichrichter diese Aufgabe.",
    },
    tags: ["generator", "drehstromgenerator", "ladesystem", "regler", "dioden"],
    relatedParts: ["Drehstromgenerator", "Batterie", "Regler", "Keilrippenriemen"],
    relatedSystems: ["Bordnetz", "Ladesystem"],
  },
  {
    moduleSlug: "diesel-ladedruck-agr-dpf-systemdiagnose",
    slug: "ladedruck-p0299-diagnoseweg",
    title: "Ladedruck P0299: Diagnoseweg",
    subtitle: "Dichtheit, Ansteuerung und Mechanik trennen",
    summary:
      "Du lernst, wie du bei Ladedruck zu niedrig Undichtigkeit, Sensorik, Ansteuerung und Turboladermechanik unterscheidest.",
    difficulty: "advanced",
    estimatedMinutes: 30,
    sortOrder: 10,
    focus:
      "P0299 ist ein Systemfehler. Der Weg führt über Luftstrecke, Istwerte, Ansteuerung und mechanische Verstellung.",
    checklist: [
      "Freeze-Frame und Lastzustand sichern.",
      "Ladeluftstrecke mit Rauch oder Druck prüfen.",
      "Soll-/Ist-Ladedruck und Luftmasse vergleichen.",
      "Steller, Unterdruck oder elektrische Ansteuerung prüfen.",
      "Mechanische Verstellung auf Klemmen prüfen.",
    ],
    quiz: {
      question: "Was ist bei P0299 zuerst oft sinnvoll?",
      answers: [
        "Dichtheit und sichtbare Schäden der Ladeluftstrecke prüfen.",
        "Turbolader ohne Prüfung ersetzen.",
        "Bremsflüssigkeit wechseln.",
        "Klimaanlage entleeren.",
      ],
      correctIndex: 0,
      explanation:
        "Undichte Schläuche und Schellen sind häufig und müssen vor teurem Teiletausch ausgeschlossen werden.",
    },
  },
  {
    moduleSlug: "diesel-ladedruck-agr-dpf-systemdiagnose",
    slug: "agr-plausibilitaet-luftmasse",
    title: "AGR & Luftmasse plausibilisieren",
    subtitle: "Warum AGR die Luftmasse verändert",
    summary:
      "Du verstehst, wie AGR-Rate, Luftmasse und Motorlauf zusammenhängen und wie Plausibilitätsfehler entstehen.",
    difficulty: "advanced",
    estimatedMinutes: 30,
    sortOrder: 20,
    focus:
      "Wenn Abgas zurückgeführt wird, sinkt die Frischluftmasse. Klemmt AGR offen oder geschlossen, passen Werte und Symptom nicht mehr.",
    checklist: [
      "AGR-Soll und AGR-Ist vergleichen.",
      "Luftmasse bei Stellgliedtest beobachten.",
      "Verkokung, Klemmen und Dichtheit prüfen.",
      "Fehler nicht isoliert vom Luftpfad bewerten.",
    ],
    quiz: {
      question: "Was passiert typischerweise mit der Frischluftmasse, wenn AGR öffnet?",
      answers: [
        "Sie sinkt.",
        "Sie wird immer exakt null.",
        "Sie hat nichts mit AGR zu tun.",
        "Sie steigt immer auf Maximum.",
      ],
      correctIndex: 0,
      explanation:
        "AGR ersetzt einen Teil der Frischluft durch Abgas, daher verändert sich die gemessene Luftmasse.",
    },
  },
  {
    moduleSlug: "diesel-ladedruck-agr-dpf-systemdiagnose",
    slug: "dpf-differenzdruck-regeneration",
    title: "DPF, Differenzdruck und Regeneration",
    subtitle: "Beladung, Sensorik und Fahrprofil unterscheiden",
    summary:
      "Du bewertest Differenzdruck, Beladung, Temperatur und Regenerationsbedingungen realistisch.",
    difficulty: "advanced",
    estimatedMinutes: 35,
    sortOrder: 30,
    focus:
      "Ein DPF-Fehler kann vom Filter, Sensor, Schlauch, Temperatur, Fahrprofil oder Motorproblem kommen.",
    checklist: [
      "Differenzdruck bei Leerlauf und Last vergleichen.",
      "Schläuche zum Sensor auf Risse und Verstopfung prüfen.",
      "Temperatursensoren und Regenerationsbedingungen beachten.",
      "Ursache für hohe Russbildung suchen.",
    ],
    quiz: {
      question: "Warum reicht ein hoher Differenzdruck allein nicht für eine Reparaturentscheidung?",
      answers: [
        "Sensor, Schläuche, Betriebszustand und Filterbeladung müssen plausibel sein.",
        "Differenzdruck ist immer falsch.",
        "DPF hat keinen Druck.",
        "Der Wert betrifft nur die Klimaanlage.",
      ],
      correctIndex: 0,
      explanation:
        "Erst Plausibilität der Messkette und Betriebsbedingungen machen den Wert belastbar.",
    },
  },
  {
    moduleSlug: "ottomotor-gemisch-zuendaussetzer-lambda",
    slug: "magerlauf-p0171-falschluft",
    title: "Magerlauf P0171 & Falschluft",
    subtitle: "Fuel Trims und Undichtigkeiten verstehen",
    summary:
      "Du erkennst, wann Kraftstoffkorrektur, Falschluft, Kraftstoffdruck oder Sensorik zusammenpassen.",
    difficulty: "advanced",
    estimatedMinutes: 28,
    sortOrder: 10,
    focus:
      "Magerlauf bedeutet nicht automatisch Lambdasonde defekt. Entscheidend ist, warum das Steuergerät anfetten muss.",
    checklist: [
      "Short- und Long-Term-Fuel-Trim bewerten.",
      "Ansaugtrakt auf Falschluft prüfen.",
      "Kraftstoffdruck und Luftmasse plausibilisieren.",
      "Lambdasignal nicht isoliert bewerten.",
    ],
    quiz: {
      question: "Was kann positive Kraftstoffkorrektur verursachen?",
      answers: [
        "Falschluft oder zu wenig Kraftstoff.",
        "Immer zu fettes Gemisch.",
        "Defekte Bremsscheibe.",
        "Zu hoher Reifenluftdruck.",
      ],
      correctIndex: 0,
      explanation:
        "Positive Korrektur bedeutet, dass das Steuergerät Kraftstoff nachlegt.",
    },
  },
  {
    moduleSlug: "ottomotor-gemisch-zuendaussetzer-lambda",
    slug: "zuendaussetzer-p0300-eingrenzen",
    title: "Zündaussetzer P0300 eingrenzen",
    subtitle: "Zündung, Einspritzung, Kompression und Gemisch trennen",
    summary:
      "Du lernst, wie du zufällige und zylinderbezogene Aussetzer sinnvoll prüfst.",
    difficulty: "advanced",
    estimatedMinutes: 28,
    sortOrder: 20,
    focus:
      "Zündaussetzer können elektrisch, mechanisch, kraftstoffseitig oder gemischbedingt entstehen.",
    checklist: [
      "Aussetzerzähller je Zylinder beobachten.",
      "Zündspule/Kerze testweise zylinderweise vergleichen.",
      "Kompression oder Druckverlust bei Verdacht prüfen.",
      "Einspritzung und Falschluft bewerten.",
    ],
    quiz: {
      question: "Was hilft beim Eingrenzen eines zylinderbezogenen Aussetzers?",
      answers: [
        "Bauteile wie Zündspule kontrolliert zwischen Zylindern tauschen und Aussetzerzähller beobachten.",
        "Alle Steuergeräte ersetzen.",
        "Nur Fehlerspeicher löschen.",
        "Kühlwasser auffüllen ohne Prüfung.",
      ],
      correctIndex: 0,
      explanation:
        "Wandert der Fehler mit, ist das getauschte Bauteil verdächtig.",
    },
  },
  {
    moduleSlug: "ottomotor-gemisch-zuendaussetzer-lambda",
    slug: "lambda-regelung-vor-nach-kat",
    title: "Lambda-Regelung vor und nach Kat",
    subtitle: "Regelsonde, Monitorsonde und Katalysator unterscheiden",
    summary:
      "Du interpretierst Lambdasonden nicht nur als Spannung, sondern im Regelkreis mit Gemisch und Kat-Wirkung.",
    difficulty: "advanced",
    estimatedMinutes: 29,
    sortOrder: 30,
    focus:
      "Die vordere Sonde regelt das Gemisch, die hintere bewertet die Kat-Wirkung. Beide Signale haben unterschiedliche Aufgaben.",
    checklist: [
      "Sondenposition klären.",
      "Signalverhalten bei warmem Motor beobachten.",
      "Fuel Trims einbeziehen.",
      "Abgasanlage auf Undichtheit prüfen.",
    ],
    quiz: {
      question: "Welche Aufgabe hat die Sonde nach dem Katalysator meist?",
      answers: [
        "Kat-Wirkung überwachen.",
        "Reifendruck messen.",
        "Generator laden.",
        "Bremsdruck regeln.",
      ],
      correctIndex: 0,
      explanation:
        "Die Nach-Kat-Sonde dient vor allem der Überwachung der Katalysatorwirkung.",
    },
  },
  {
    moduleSlug: "bremse-fahrwerk-abs-esp-diagnose",
    slug: "verschleissbild-reifen-bremse-fahrwerk",
    title: "Verschleißbilder richtig lesen",
    subtitle: "Reifen, Bremse und Fahrwerk als Hinweise nutzen",
    summary:
      "Du verbindest ungleichmäßigen Verschleiß mit Spur, Sturz, Lager, Bremse und Fahrprofil.",
    difficulty: "intermediate",
    estimatedMinutes: 25,
    sortOrder: 10,
    focus:
      "Verschleißbilder sind Diagnosehinweise. Sie zeigen, wo du messen und prüfen musst.",
    checklist: [
      "Reifenbild innen/außen/mittig bewerten.",
      "Luftdruck und Achsgeometrie beachten.",
      "Gelenke, Lager und Daempfer sichtprüfen.",
      "Bremse auf Schleifen oder ungleiche Wirkung prüfen.",
    ],
    quiz: {
      question: "Was passt zu innen stark abgefahrenem Reifen?",
      answers: [
        "Achsgeometrie, Lager/Gelenke oder Luftdruck prüfen.",
        "Nur Innenraumfilter wechseln.",
        "Lambdasonde ersetzen.",
        "Kraftstoffdruck messen.",
      ],
      correctIndex: 0,
      explanation:
        "Einseitiger Reifenverschleiss hängt oft mit Geometrie oder Fahrwerkspiel zusammen.",
    },
  },
  {
    moduleSlug: "bremse-fahrwerk-abs-esp-diagnose",
    slug: "raddrehzahlsensor-abs-pruefen",
    title: "Raddrehzahlsensor & ABS prüfen",
    subtitle: "Signal, Ring, Lager und Leitung unterscheiden",
    summary:
      "Du prüfst Raddrehzahlsensoren mit Istwerten, Sichtprüfung und Signalvergleich.",
    difficulty: "intermediate",
    estimatedMinutes: 28,
    sortOrder: 20,
    focus:
      "ABS-Fehler entstehen nicht nur am Sensor. Magnetring, Radlager, Abstand, Leitung und Steuergerätdaten gehören dazu.",
    checklist: [
      "Fehlercode und betroffene Radecke identifizieren.",
      "Istwerte beim Drehen der Räder vergleichen.",
      "Sensor, Leitung, Stecker und Ring sichtprüfen.",
      "Signal und Versorgung nach Systemart prüfen.",
    ],
    quiz: {
      question: "Warum kann ein ABS-Sensorfehler vom Radlager kommen?",
      answers: [
        "Bei integrierten Magnetringen kann der Signalgeber im Lager liegen.",
        "Radlager erzeugen Kraftstoffdruck.",
        "ABS hat keine Sensoren.",
        "Der Fehler kommt immer vom Bremspedal.",
      ],
      correctIndex: 0,
      explanation:
        "Viele Systeme nutzen Magnetringe im Lager als Signalgeber.",
    },
  },
  {
    moduleSlug: "bremse-fahrwerk-abs-esp-diagnose",
    slug: "bremsen-service-sicherheitspruefung",
    title: "Bremsenservice & Sicherheitsprüfung",
    subtitle: "Nicht nur Belag tauschen",
    summary:
      "Du lernst, was bei Bremsenarbeiten fachlich und sicherheitsrelevant dokumentiert werden muss.",
    difficulty: "intermediate",
    estimatedMinutes: 27,
    sortOrder: 30,
    focus:
      "Bremsarbeiten brauchen Sauberkeit, Sichtprüfung, richtige Montage und Funktionskontrolle.",
    checklist: [
      "Scheiben, Beläge, Führungen, Manschetten und Leitungen prüfen.",
      "Auflageflächen reinigen und passende Montagehinweise beachten.",
      "Bremsflüssigkeit und Pedalgefühl bewerten.",
      "Probefahrt und Einbrems-/Kundenhinweise dokumentieren.",
    ],
    quiz: {
      question: "Was gehört nach Bremsarbeiten zwingend dazu?",
      answers: [
        "Pedal vor Fahrtbeginn aufbauen und Funktion prüfen.",
        "Sofort Vollbremsung im Kundenfahrzeug ohne Kontrolle.",
        "Fehlerspeicher Motor löschen statt Bremse prüfen.",
        "Alle Sensoren abstecken.",
      ],
      correctIndex: 0,
      explanation:
        "Nach Montage muss Bremsdruck aufgebaut und die Funktion sicher geprüft werden.",
    },
  },
  {
    moduleSlug: "klima-kuehlung-thermomanagement-pruefen",
    slug: "klimakreis-druck-temperatur",
    title: "Klimakreis: Druck und Temperatur",
    subtitle: "Warum Drücke nur mit Bedingungen Sinn ergeben",
    summary:
      "Du bewertest Klimaleistung über Druck, Temperatur, Lüfter, Luftführung und Füllmenge.",
    difficulty: "intermediate",
    estimatedMinutes: 25,
    sortOrder: 10,
    focus:
      "Klimadiagnose braucht Umgebungsbedingungen: Außentemperatur, Motordrehzahl, Lüfterstatus und Luftaustritt.",
    checklist: [
      "Kundenbeanstandung und Bedingungen klären.",
      "Austrittstemperatur und Lüfterfunktion prüfen.",
      "Hoch-/Niederdruck im Systemzusammenhang bewerten.",
      "Sichtprüfung auf Undichtigkeiten und Kondensatorschäden.",
    ],
    quiz: {
      question: "Warum sind Klimadruckwerte ohne Bedingungen wenig aussagekraeftig?",
      answers: [
        "Druck hängt stark von Temperatur, Lüfter und Betriebszustand ab.",
        "Druck ist bei Klima egal.",
        "Klimaanlagen haben keinen Kompressor.",
        "Der Reifenluftdruck ersetzt Klimadruck.",
      ],
      correctIndex: 0,
      explanation:
        "Ohne Randbedingungen lassen sich Druckwerte kaum fachlich bewerten.",
    },
  },
  {
    moduleSlug: "klima-kuehlung-thermomanagement-pruefen",
    slug: "kuehlkreislauf-thermostat-luefter",
    title: "Kühlkreislauf, Thermostat und Lüfter",
    subtitle: "Überhitzung und zu langsames Warmwerden trennen",
    summary:
      "Du diagnostizierst Temperaturprobleme über Kühlmittelfluss, Thermostat, Sensorik und Lüftersteuerung.",
    difficulty: "intermediate",
    estimatedMinutes: 25,
    sortOrder: 20,
    focus:
      "Temperaturprobleme können mechanisch, elektrisch oder durch Luft im System entstehen.",
    checklist: [
      "Kühlmittelstand und Dichtheit prüfen.",
      "Temperaturverlauf im Diagnosegerät beobachten.",
      "Thermostat-Oeffnung und Schlauchtemperaturen bewerten.",
      "Lüfteransteuerung und Sensorwerte prüfen.",
    ],
    quiz: {
      question: "Was kann zu langsames Warmwerden verursachen?",
      answers: [
        "Thermostat hängt offen.",
        "Raddrehzahlsensor verschmutzt.",
        "Bremsbelag neu.",
        "Scheibenwischer defekt.",
      ],
      correctIndex: 0,
      explanation:
        "Ein offen hängendes Thermostat kann den großen Kreislauf zu früh freigeben.",
    },
  },
  {
    moduleSlug: "klima-kuehlung-thermomanagement-pruefen",
    slug: "heizung-luftklappen-innenraum",
    title: "Heizung, Luftklappen und Innenraum",
    subtitle: "Wenn die Temperatur im Innenraum nicht passt",
    summary:
      "Du prüfst Heizleistung, Mischklappen, Stellmotoren, Innenraumfilter und Sensorik.",
    difficulty: "intermediate",
    estimatedMinutes: 25,
    sortOrder: 30,
    focus:
      "Schlechte Heiz- oder Kühlleistung kann vom Kühlmittel, Luftstrom, Stellmotor oder Sensorwert kommen.",
    checklist: [
      "Luftmenge und Innenraumfilter prüfen.",
      "Ausblastemperaturen links/rechts vergleichen.",
      "Stellmotoren und Klappenpositionen testen.",
      "Kühlmitteltemperatur und Wärmetauscher beurteilen.",
    ],
    quiz: {
      question: "Was ist bei links/rechts unterschiedlicher Ausblastemperatur naheliegend?",
      answers: [
        "Mischklappe, Stellmotor oder Luftführung prüfen.",
        "Nur Reifen wechseln.",
        "Immer Kompressor ersetzen.",
        "Motorsteuergerät ausbauen.",
      ],
      correctIndex: 0,
      explanation:
        "Zonenunterschiede weisen oft auf Luftklappen oder deren Ansteuerung hin.",
    },
  },
  {
    moduleSlug: "gesellenpruefung-werkstattfaelle-fachgespraech",
    slug: "pruefungsantwort-strukturieren",
    title: "Prüfungsantwort strukturieren",
    subtitle: "So klingt eine gute Antwort im Fachgespräch",
    summary:
      "Du lernst, Antworten in Auftrag, Sicherheit, Prüfplan, Messwert, Entscheidung und Abschluss zu gliedern.",
    difficulty: "advanced",
    estimatedMinutes: 30,
    sortOrder: 10,
    focus:
      "Eine gute Prüfungsantwort zeigt nicht nur Fachwissen, sondern Reihenfolge, Begruendung und Sicherheit.",
    checklist: [
      "Auftrag und Symptom kurz wiederholen.",
      "Sicherheitsmaßnahmen nennen.",
      "Prüfreihenfolge begründen.",
      "Messwerte und Entscheidung erklären.",
      "Abschlussprüfung nennen.",
    ],
    quiz: {
      question: "Welche Antwort wirkt im Fachgespräch am staerksten?",
      answers: [
        "Ich tausche das Teil, weil es oft kaputt ist.",
        "Ich prüfe erst Sicht, Versorgung, Signal und Funktion, damit ich die Ursache belegen kann.",
        "Ich weiß nicht.",
        "Ich lösche den Fehler.",
      ],
      correctIndex: 1,
      explanation:
        "Prüfer wollen einen begründeten Diagnoseweg sehen, nicht Teiletausch auf Verdacht.",
    },
  },
  {
    moduleSlug: "gesellenpruefung-werkstattfaelle-fachgespraech",
    slug: "kundenauftrag-pruefung-teil-1",
    title: "Kundenauftrag für Teil 1 bearbeiten",
    subtitle: "Wartung, einfache Diagnose und Dokumentation",
    summary:
      "Du trainierst einen typischen Teil-1-Auftrag mit Licht, Batterie, Reifen und Wartungsdokumentation.",
    difficulty: "advanced",
    estimatedMinutes: 30,
    sortOrder: 20,
    focus:
      "Teil 1 verlangt sauberes Arbeiten an Grundlagen: Auftrag verstehen, sicher prüfen, Ergebnis dokumentieren.",
    checklist: [
      "Arbeitsauftrag und Herstellerunterlagen beachten.",
      "Sichtprüfung und einfache Messungen durchführen.",
      "Wartungspunkte mit Messwerten dokumentieren.",
      "Mängel fachlich formulieren.",
    ],
    quiz: {
      question: "Was ist für Teil 1 besonders wichtig?",
      answers: [
        "Grundlagen sicher und dokumentiert ausführen.",
        "Möglichst ohne Unterlagen arbeiten.",
        "Nur raten.",
        "Keine Sicherheitsregeln beachten.",
      ],
      correctIndex: 0,
      explanation:
        "Teil 1 prüft frühe berufliche Handlungsfähigkeit und saubere Grundlagenarbeit.",
    },
  },
  {
    moduleSlug: "gesellenpruefung-werkstattfaelle-fachgespraech",
    slug: "kundenauftrag-pruefung-teil-2",
    title: "Kundenauftrag für Teil 2 bearbeiten",
    subtitle: "Komplexe Diagnose und Reparaturentscheidung",
    summary:
      "Du trainierst einen Teil-2-Fall mit Fehlercodes, Istwerten, Prüfplan, Instandsetzung und Abschlussprüfung.",
    difficulty: "advanced",
    estimatedMinutes: 30,
    sortOrder: 30,
    focus:
      "Teil 2 verlangt Systemverständnis: Du musst Ursachen eingrenzen, Entscheidungen begründen und Ergebnisse bewerten.",
    checklist: [
      "Fehlerspeicher und Freeze-Frame sichern.",
      "Systemfunktion erklären.",
      "Prüfplan priorisieren.",
      "Reparaturentscheidung anhand von Befunden begründen.",
      "Abschlussprüfung mit passenden Bedingungen durchführen.",
    ],
    quiz: {
      question: "Was unterscheidet eine starke Teil-2-Diagnose?",
      answers: [
        "Sie verbindet Fehlercode, Systemfunktion, Messwerte und Prüfergebnis.",
        "Sie ersetzt blind das teuerste Teil.",
        "Sie ignoriert Kundenangaben.",
        "Sie prüft nie unter Last.",
      ],
      correctIndex: 0,
      explanation:
        "Teil 2 bewertet komplexes Denken im Systemzusammenhang.",
    },
  },
];

export const LOCAL_LEARNING_LESSONS: LearningLesson[] = LESSON_SEEDS.map(makeLesson);

export function getLocalLessonsForModule(moduleId: string) {
  return LOCAL_LEARNING_LESSONS.filter((lesson) => lesson.moduleId === moduleId).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
  );
}

export function getLocalModuleBySlug(slug: string) {
  return LOCAL_LEARNING_MODULES.find((module) => module.slug === slug) || null;
}

export function getLocalLessonBySlug(slug: string) {
  return LOCAL_LEARNING_LESSONS.find((lesson) => lesson.slug === slug) || null;
}

export function getLocalCategoryById(categoryId: string) {
  return LOCAL_LEARNING_CATEGORIES.find((category) => category.id === categoryId) || null;
}
