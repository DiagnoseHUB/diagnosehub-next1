export type ExamPartId = "teil-1" | "teil-2";

export type ExamQuestionType = "single_choice" | "multiple_choice";

export type ExamQuestion = {
  id: string;
  type: ExamQuestionType;
  area: string;
  question: string;
  answers: string[];
  correctAnswerIndexes: number[];
  explanation: string;
  points: number;
};

export type ExamCaseTask = {
  id: string;
  title: string;
  prompt: string;
  expectedPoints: string[];
  points: number;
};

export type JourneymanExam = {
  id: ExamPartId;
  title: string;
  subtitle: string;
  durationMinutes: number;
  maxPoints: number;
  weighting: string;
  scenario: string;
  competenceAreas: string[];
  questionPickCount: number;
  caseTaskPickCount: number;
  questions: ExamQuestion[];
  caseTasks: ExamCaseTask[];
};

export const JOURNEYMAN_EXAMS: JourneymanExam[] = [
  {
    id: "teil-1",
    title: "Gesellenprüfung Teil 1",
    subtitle: "Grundlagen, Wartung, einfache Diagnose und Arbeitsplanung",
    durationMinutes: 150,
    maxPoints: 100,
    weighting: "Trainingsmodus: orientiert an frühen Ausbildungsinhalten",
    scenario:
      "Kundenauftrag: Fahrzeug kommt zur Inspektion. Beanstandet werden flackerndes Abblendlicht, schwache Batterie nach Standzeit und ungleichmäßiger Reifenverschleiss vorne.",
    competenceAreas: [
      "Arbeitsauftrag erfassen",
      "Sicher prüfen und messen",
      "Wartung fachgerecht planen",
      "Einfache elektrische Fehler eingrenzen",
      "Ergebnisse dokumentieren",
    ],
    questionPickCount: 6,
    caseTaskPickCount: 2,
    questions: [
      {
        id: "t1-q1",
        type: "single_choice",
        area: "Arbeitsplanung",
        question:
          "Welche erste Massnahme passt am besten, bevor am Fahrzeug gemessen oder demontiert wird?",
        answers: [
          "Batterie sofort ersetzen, weil Standzeit immer zu Sulfatierung führt.",
          "Kundenbeanstandung aufnehmen, Sichtprüfung durchführen und technische Unterlagen/Arbeitsanweisung prüfen.",
          "Fehlerspeicher löschen und eine Probefahrt ohne weitere Prüfung machen.",
          "Alle Leuchtmittel pauschal tauschen.",
        ],
        correctAnswerIndexes: [1],
        explanation:
          "Vor der Arbeit wird der Auftrag geklärt, das Fahrzeug gesichert, eine Sichtprüfung gemacht und die passende Unterlage genutzt.",
        points: 6,
      },
      {
        id: "t1-q2",
        type: "multiple_choice",
        area: "Arbeitssicherheit",
        question:
          "Welche Punkte gehören zur sicheren Vorbereitung bei Arbeiten an der 12-V-Bordnetzanlage?",
        answers: [
          "Zündungszustand beachten und Verbraucher ausschalten.",
          "Geeignetes Messgerät und richtigen Messbereich wählen.",
          "Kurzschluss gezielt erzeugen, um Sicherungen schneller zu finden.",
          "Lose Kleidung, Schmuck und ungeeignetes Werkzeug vermeiden.",
        ],
        correctAnswerIndexes: [0, 1, 3],
        explanation:
          "Sicheres Messen vermeidet Kurzschluss, Fehlmessung und Verletzung. Ein absichtlicher Kurzschluss ist keine Prüfmethode.",
        points: 8,
      },
      {
        id: "t1-q3",
        type: "single_choice",
        area: "Elektrik",
        question:
          "Bei eingeschaltetem Abblendlicht misst du an der Lampe 10,8 V, direkt an der Batterie 12,4 V. Was ist am wahrscheinlichsten?",
        answers: [
          "Die Batterie ist vollständig defekt.",
          "Es liegt ein Spannungsabfall in Plus- oder Masseleitung vor.",
          "Die Lampe hat zu wenig Widerstand.",
          "Der Generator lädt zu stark.",
        ],
        correctAnswerIndexes: [1],
        explanation:
          "Die Differenz zwischen Batterie und Verbraucher deutet auf Übergangswiderstand oder Leitungs-/Masseproblem unter Last hin.",
        points: 8,
      },
      {
        id: "t1-q4",
        type: "single_choice",
        area: "Fahrwerk",
        question:
          "Ein Reifen ist innen deutlich staerker abgefahren als aussen. Welche Prüfung ist sinnvoll?",
        answers: [
          "Nur den Reifendruck hinten prüfen.",
          "Achsgeometrie, Gelenke, Lager und Luftdruck prüfen.",
          "Motorsteuergerät auslesen.",
          "Kühlmittelstand prüfen.",
        ],
        correctAnswerIndexes: [1],
        explanation:
          "Einseitiger Verschleiss passt zu Spur/Sturz, ausgeschlagenen Bauteilen oder falschem Luftdruck.",
        points: 6,
      },
      {
        id: "t1-q5",
        type: "single_choice",
        area: "Batterie",
        question:
          "Welche Aussage zur Ruhestrommessung ist fachlich richtig?",
        answers: [
          "Direkt nach dem Abschliessen messen, alle Steuergeräte sind dann sicher eingeschlafen.",
          "Messgerät in Reihe anschliessen, Einschlafzeit beachten und Messbereich passend absichern.",
          "Ruhestrom wird immer parallel zur Batterie gemessen.",
          "Ein Ruhestrom von 5 A ist bei modernen Fahrzeugen normal.",
        ],
        correctAnswerIndexes: [1],
        explanation:
          "Ruhestrom wird in Reihe gemessen. Steuergeräte brauchen Zeit zum Einschlafen, sonst ist das Ergebnis unbrauchbar.",
        points: 8,
      },
      {
        id: "t1-q6",
        type: "multiple_choice",
        area: "Wartung",
        question:
          "Welche Angaben gehören in eine saubere Wartungsdokumentation?",
        answers: [
          "Durchgeführte Arbeiten und verwendete Betriebsstoffe.",
          "Gemessene Werte wie Reifenprofil, Bremsbelagstaerke oder Batteriespannung.",
          "Nur der Name des Kunden, technische Angaben sind unwichtig.",
          "Auffällige Mängel und empfohlene Folgearbeiten.",
        ],
        correctAnswerIndexes: [0, 1, 3],
        explanation:
          "Dokumentation muss nachvollziehbar sein: Arbeit, Werte, Mängel und Empfehlungen.",
        points: 8,
      },
      {
        id: "t1-q7",
        type: "single_choice",
        area: "Beleuchtung",
        question:
          "Ein Abblendlicht ist deutlich dunkler, das Leuchtmittel ist in Ordnung. Welche Prüfung ist sinnvoll?",
        answers: [
          "Spannungsfall an Plus- und Massepfad unter Last prüfen.",
          "Motoröl ablassen.",
          "Reifendruck auf 4 bar erhöhen.",
          "Fehler ignorieren, solange Standlicht funktioniert.",
        ],
        correctAnswerIndexes: [0],
        explanation:
          "Wenn der Verbraucher intakt ist, müssen Versorgung und Masse unter Last geprüft werden.",
        points: 7,
      },
      {
        id: "t1-q8",
        type: "multiple_choice",
        area: "Wartung",
        question:
          "Welche Punkte gehören zu einer fachgerechten Bremsensichtprüfung?",
        answers: [
          "Belagstärke und Scheibenzustand beurteilen.",
          "Bremsschläuche und Leitungen auf Schäden prüfen.",
          "Führungen, Manschetten und Undichtigkeiten beachten.",
          "Kraftstofffilter pauschal ersetzen.",
        ],
        correctAnswerIndexes: [0, 1, 2],
        explanation:
          "Bremsprüfung umfasst Verschleiß, Dichtheit, Führung und Zustand der Leitungen.",
        points: 8,
      },
      {
        id: "t1-q9",
        type: "single_choice",
        area: "Arbeitsmittel",
        question:
          "Warum werden Herstellerunterlagen vor Wartungs- und Prüfarbeiten genutzt?",
        answers: [
          "Weil Füllmengen, Prüfpunkte, Freigaben und Arbeitsschritte fahrzeugabhängig sind.",
          "Weil eigene Messwerte dadurch unnötig werden.",
          "Weil Sicherheitsregeln dann nicht gelten.",
          "Weil Fehlercodes dadurch automatisch gelöscht werden.",
        ],
        correctAnswerIndexes: [0],
        explanation:
          "Fahrzeugspezifische Vorgaben verhindern falsche Betriebsstoffe, falsche Reihenfolge und Sicherheitsfehler.",
        points: 6,
      },
      {
        id: "t1-q10",
        type: "single_choice",
        area: "Kühlung",
        question:
          "Der Motor wird schlecht warm. Welche Ursache passt am besten?",
        answers: [
          "Thermostat hängt offen.",
          "Abblendlicht ist falsch eingestellt.",
          "Reifenprofil ist zu tief.",
          "Wischerblatt ist verschlissen.",
        ],
        correctAnswerIndexes: [0],
        explanation:
          "Ein offen hängendes Thermostat gibt den großen Kühlkreislauf zu früh frei.",
        points: 6,
      },
      {
        id: "t1-q11",
        type: "multiple_choice",
        area: "Dokumentation",
        question:
          "Welche Aussagen machen eine Diagnose nachvollziehbar?",
        answers: [
          "Beanstandung, Prüfbedingungen und Messwerte notieren.",
          "Getauschte Teile und Ursache dokumentieren.",
          "Nur schreiben: erledigt.",
          "Abschlussprüfung und Ergebnis festhalten.",
        ],
        correctAnswerIndexes: [0, 1, 3],
        explanation:
          "Nachvollziehbarkeit entsteht durch Auftrag, Messweg, Befund, Reparatur und Abschlussprüfung.",
        points: 8,
      },
      {
        id: "t1-q12",
        type: "single_choice",
        area: "Sicherheit",
        question:
          "Was ist vor Arbeiten unter dem angehobenen Fahrzeug entscheidend?",
        answers: [
          "Fahrzeug korrekt aufnehmen, sichern und Hebebühne/Tragpunkte beachten.",
          "Motor immer bei Höchstdrehzahl laufen lassen.",
          "Batterie grundsätzlich kurzschließen.",
          "Nur auf einem Wagenheber ohne Sicherung arbeiten.",
        ],
        correctAnswerIndexes: [0],
        explanation:
          "Sicheres Aufnehmen und Sichern ist Grundvoraussetzung für Arbeiten am angehobenen Fahrzeug.",
        points: 6,
      },
    ],
    caseTasks: [
      {
        id: "t1-c1",
        title: "Arbeitsplan: flackerndes Abblendlicht",
        prompt:
          "Beschreibe eine sinnvolle Prüfreihenfolge für das flackernde Abblendlicht. Berücksichtige Sichtprüfung, Messung und Dokumentation.",
        expectedPoints: [
          "Kundenbeanstandung reproduzieren und Lichtfunktion prüfen.",
          "Stecker, Leuchtmittel, Sicherung, Leitung und Massepunkt sichtprüfen.",
          "Spannung unter Last an Batterie und Lampe vergleichen.",
          "Masse-Spannungsabfall und Plus-Spannungsabfall messen.",
          "Ergebnis mit Messwerten dokumentieren und Reparaturvorschlag ableiten.",
        ],
        points: 20,
      },
      {
        id: "t1-c2",
        title: "Batterie nach Standzeit schwach",
        prompt:
          "Nenne einen praxisnahen Ablauf, um Batterie, Generator und Ruhestrom als Ursachen einzugrenzen.",
        expectedPoints: [
          "Batteriezustand und Ladezustand prüfen.",
          "Generator-Ladespannung mit Verbrauchern beurteilen.",
          "Ruhestrommessung mit Einschlafzeit vorbereiten.",
          "Auffällige Verbraucher/Stromkreise systematisch eingrenzen.",
          "Kundenhinweis und Messwerte dokumentieren.",
        ],
        points: 14,
      },
    ],
  },
  {
    id: "teil-2",
    title: "Gesellenprüfung Teil 2",
    subtitle: "Diagnose, Systemanalyse, Instandsetzung und Kundenauftrag",
    durationMinutes: 210,
    maxPoints: 100,
    weighting: "Trainingsmodus: Schwerpunkt Personenkraftwagentechnik",
    scenario:
      "Kundenauftrag: Diesel-Pkw hat Leistungsverlust, Motorkontrollleuchte, sporadisch Notlauf. Fehlercodes: P0299 Ladedruck zu niedrig, P0101 Luftmassenmesser Signal unplausibel. Nach kurzer Standzeit tritt der Fehler häufiger auf.",
    competenceAreas: [
      "Fehlerspeicher und Istwerte interpretieren",
      "Prüfplan mit Prioritaeten erstellen",
      "Mechanik, Sensorik und Aktorik unterscheiden",
      "Messwerte plausibilisieren",
      "Reparaturentscheidung begründen",
    ],
    questionPickCount: 6,
    caseTaskPickCount: 2,
    questions: [
      {
        id: "t2-q1",
        type: "single_choice",
        area: "Diagnosestrategie",
        question:
          "Welcher erste Diagnoseweg ist bei P0299 und P0101 am sinnvollsten?",
        answers: [
          "Turbolader sofort ersetzen.",
          "Fehler löschen, Fahrzeug ausliefern und abwarten.",
          "Sichtprüfung Ansaug-/Ladeluftstrecke, Istwerte vergleichen und Stellglied-/Dichtheitsprüfung planen.",
          "Luftmassenmesser abstecken und dauerhaft weiterfahren.",
        ],
        correctAnswerIndexes: [2],
        explanation:
          "Bei Ladedruck- und Luftmassenfehlern zuerst Plausibilität, Dichtheit, Steckverbindungen und Istwerte prüfen.",
        points: 8,
      },
      {
        id: "t2-q2",
        type: "multiple_choice",
        area: "Ladedrucksystem",
        question:
          "Welche Ursachen passen technisch zu Ladedruck zu niedrig?",
        answers: [
          "Undichte Ladeluftstrecke oder lose Schlauchschelle.",
          "Unterdruck-/Drucksteller wird nicht korrekt angesteuert.",
          "Mechanisch klemmende VTG-Verstellung oder Wastegate.",
          "Zu hoher Reifendruck hinten.",
        ],
        correctAnswerIndexes: [0, 1, 2],
        explanation:
          "Ladedruck entsteht nur bei dichter Luftstrecke und funktionierender Ansteuerung/Mechanik.",
        points: 8,
      },
      {
        id: "t2-q3",
        type: "single_choice",
        area: "Messwerte",
        question:
          "Der Soll-Ladedruck steigt bei Last deutlich, der Ist-Ladedruck bleibt niedrig. Gleichzeitig ist die Luftmasse niedriger als erwartet. Was passt am besten?",
        answers: [
          "Das Steuergerät fordert Leistung an, aber Luftmasse/Ladedruck werden nicht erreicht.",
          "Der Fahrer bremst zu stark.",
          "Die Klimaanlage ist überfüllt.",
          "Der Generator lädt nicht.",
        ],
        correctAnswerIndexes: [0],
        explanation:
          "Soll/Ist-Abweichung mit niedriger Luftmasse zeigt, dass der Motor die geforderte Luftmenge nicht bekommt.",
        points: 8,
      },
      {
        id: "t2-q4",
        type: "multiple_choice",
        area: "Elektrische Prüfung",
        question:
          "Welche Prüfungen sind bei unplausiblem Luftmassenmesser-Signal sinnvoll?",
        answers: [
          "Versorgungsspannung und Masse am Sensor prüfen.",
          "Steckerpins auf Korrosion, Sitz und Zugentlastung prüfen.",
          "Signal/Istwert mit Diagnosegerät und ggf. Oszilloskop plausibilisieren.",
          "Radlager hinten ersetzen.",
        ],
        correctAnswerIndexes: [0, 1, 2],
        explanation:
          "Sensorfehler können durch Sensor, Versorgung, Masse, Kontakt oder Leitung entstehen.",
        points: 8,
      },
      {
        id: "t2-q5",
        type: "single_choice",
        area: "Kundenkommunikation",
        question:
          "Welche Aussage an den Kunden ist fachlich und kaufmaennisch am saubersten?",
        answers: [
          "Wir tauschen zuerst den teuersten Verdachtsbauteil, dann sehen wir weiter.",
          "Die Diagnose zeigt mehrere mögliche Ursachen. Wir prüfen zuerst Dichtheit und Ansteuerung, bevor Bauteile ersetzt werden.",
          "Ladedruckfehler sind immer Softwarefehler.",
          "Der Fehler ist nicht wichtig, solange das Fahrzeug noch fährt.",
        ],
        correctAnswerIndexes: [1],
        explanation:
          "Saubere Kommunikation erklärt Diagnoseweg, Kostenkontrolle und vermeidet Teiletausch auf Verdacht.",
        points: 6,
      },
      {
        id: "t2-q6",
        type: "multiple_choice",
        area: "Abschlussprüfung",
        question:
          "Was gehört nach der Instandsetzung zu einer belastbaren Abschlussprüfung?",
        answers: [
          "Fehlerspeicher löschen und Readiness/Istwerte prüfen, wenn relevant.",
          "Probefahrt unter ähnlichen Lastbedingungen wie bei der Beanstandung.",
          "Reparatur- und Messwerte dokumentieren.",
          "Keine Prüfung, wenn die Motorkontrollleuchte aus ist.",
        ],
        correctAnswerIndexes: [0, 1, 2],
        explanation:
          "Die Abschlussprüfung muss zeigen, dass die Beanstandung unter passenden Bedingungen behoben ist.",
        points: 8,
      },
      {
        id: "t2-q7",
        type: "single_choice",
        area: "DPF",
        question:
          "Ein DPF-Differenzdruckwert ist auffällig hoch. Was ist vor einer Reparaturentscheidung wichtig?",
        answers: [
          "Sensor, Schläuche, Betriebszustand und Beladungswerte plausibilisieren.",
          "DPF immer sofort ausbauen.",
          "Klimakompressor prüfen.",
          "Reifendruck erhöhen.",
        ],
        correctAnswerIndexes: [0],
        explanation:
          "Ein Differenzdruckwert ist nur mit Messkette, Drehzahl/Last und Beladungsdaten belastbar.",
        points: 8,
      },
      {
        id: "t2-q8",
        type: "multiple_choice",
        area: "Zündaussetzer",
        question:
          "Welche Prüfungen passen zu zylinderbezogenen Zündaussetzern?",
        answers: [
          "Aussetzerzähler je Zylinder beobachten.",
          "Zündspule oder Kerze kontrolliert quer tauschen.",
          "Kompression oder Druckverlust bei Verdacht prüfen.",
          "Ladeluftkühler blind ersetzen.",
        ],
        correctAnswerIndexes: [0, 1, 2],
        explanation:
          "Zündaussetzer werden über Zündung, Einspritzung, Kompression und Gemisch eingegrenzt.",
        points: 8,
      },
      {
        id: "t2-q9",
        type: "single_choice",
        area: "Gemischbildung",
        question:
          "Positive Kraftstoffkorrekturwerte bei warmem Ottomotor deuten häufig worauf hin?",
        answers: [
          "Das Steuergerät fettet nach, etwa wegen Falschluft oder zu wenig Kraftstoff.",
          "Das Gemisch ist sicher zu fett.",
          "Die ABS-Leuchte ist defekt.",
          "Der Katalysator wird mechanisch gebremst.",
        ],
        correctAnswerIndexes: [0],
        explanation:
          "Positive Trims bedeuten Nachfetten. Ursache kann Luftleck, Kraftstoffmangel oder Messfehler sein.",
        points: 8,
      },
      {
        id: "t2-q10",
        type: "multiple_choice",
        area: "Hochvolt-Grundsatz",
        question:
          "Welche Aussagen zu Hochvoltfahrzeugen sind fachlich richtig?",
        answers: [
          "Nur entsprechend qualifizierte Personen dürfen HV-Arbeiten ausführen.",
          "HV-Systeme müssen nach Herstellervorgabe spannungsfrei geschaltet und geprüft werden.",
          "Orange Leitungen dürfen zur Fehlersuche beliebig getrennt werden.",
          "Sicherheitsregeln und persönliche Schutzausrüstung sind zu beachten.",
        ],
        correctAnswerIndexes: [0, 1, 3],
        explanation:
          "HV-Arbeiten erfordern Qualifikation, Herstellervorgaben, Spannungsfreiheit und Schutzmaßnahmen.",
        points: 8,
      },
      {
        id: "t2-q11",
        type: "single_choice",
        area: "ABS/ESP",
        question:
          "Ein Raddrehzahlsensor zeigt sporadisch 0 km/h, die anderen Räder plausibel. Was ist sinnvoll?",
        answers: [
          "Sensor, Leitung, Stecker, Magnetring/Radlager und Istwertsignal prüfen.",
          "Alle Reifen ersetzen.",
          "Motorölqualität prüfen.",
          "AGR-Ventil reinigen.",
        ],
        correctAnswerIndexes: [0],
        explanation:
          "Raddrehzahlsignale hängen von Sensor, Leitung, Geberring und Einbausituation ab.",
        points: 7,
      },
      {
        id: "t2-q12",
        type: "single_choice",
        area: "Reparaturentscheidung",
        question:
          "Wann ist ein Bauteiltausch fachlich gut begründet?",
        answers: [
          "Wenn Symptom, Messwerte, Prüfergebnis und Ausschluss anderer Ursachen zusammenpassen.",
          "Wenn der Fehlercode den Bauteilnamen enthält.",
          "Wenn das Bauteil teuer aussieht.",
          "Wenn keine Probefahrt möglich war.",
        ],
        correctAnswerIndexes: [0],
        explanation:
          "Eine belastbare Entscheidung entsteht aus Befundkette und Plausibilität, nicht aus Vermutung.",
        points: 7,
      },
    ],
    caseTasks: [
      {
        id: "t2-c1",
        title: "Prüfplan P0299/P0101",
        prompt:
          "Erstelle einen priorisierten Prüfplan für den Diagnosefall. Ziel: Ursache eingrenzen, bevor Teile ersetzt werden.",
        expectedPoints: [
          "Fehlerspeicher mit Freeze-Frame und Umgebungsbedingungen sichern.",
          "Ansaug- und Ladeluftstrecke inklusive Schellen, Dichtungen, LLK und Schläuchen sicht- und dichtprüfen.",
          "Soll-/Istwerte für Ladedruck, Luftmasse, AGR, Ansteuerung und Motordrehzahl vergleichen.",
          "Sensorversorgung, Masse und Signal des Luftmassenmessers prüfen.",
          "Ladedrucksteller/VTG/Wastegate auf Ansteuerung und mechanische Beweglichkeit prüfen.",
          "Nach Reparatur Probefahrt mit Lastprofil, Fehlerspeicher und Messwerte dokumentieren.",
        ],
        points: 22,
      },
      {
        id: "t2-c2",
        title: "Reparaturentscheidung begründen",
        prompt:
          "Nach Rauchtest zeigt sich eine Undichtigkeit am Ladeluftschlauch nach dem Ladeluftkühler. Erkläre, warum dies beide Fehlercodes erklären kann und welche Abschlussprüfung folgt.",
        expectedPoints: [
          "Undichtigkeit senkt den erreichten Ladedruck unter Last.",
          "Luftmasse/Ladedruck werden unplausibel, weil gemessene und tatsaechlich genutzte Luftmenge nicht zusammenpassen.",
          "Schlauch/Dichtung/Schelle fachgerecht ersetzen oder befestigen.",
          "Istwerte nach Reparatur unter Last vergleichen.",
          "Fehlerspeicher löschen, Probefahrt und Dokumentation durchführen.",
        ],
        points: 18,
      },
    ],
  },
];

export function getJourneymanExam(partId: ExamPartId) {
  return JOURNEYMAN_EXAMS.find((exam) => exam.id === partId) || JOURNEYMAN_EXAMS[0];
}
