import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(import.meta.dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_DIAGNOSES = process.argv.includes("--skip-diagnoses");
const SKIP_INSTRUCTIONS = process.argv.includes("--skip-instructions");
const TODAY = new Date().toISOString().slice(0, 10);
const totalArg = process.argv.find((arg) => arg.startsWith("--total="));
const requestedTotal = Number(
  totalArg?.split("=")[1] || process.env.SEED_LIBRARY_TOTAL || 20000
);
const TARGET_TOTAL = Number.isFinite(requestedTotal)
  ? Math.min(Math.max(Math.floor(requestedTotal), 1000), 20000)
  : 20000;
const DIAGNOSIS_TARGET = Math.floor(TARGET_TOTAL / 2);
const INSTRUCTION_TARGET = TARGET_TOTAL - DIAGNOSIS_TARGET;

function loadEnvFile(fileName) {
  try {
    const content = readFileSync(resolve(ROOT, fileName), "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=").replace(/^["']|["']$/g, "");

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional in local dry runs.
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

function normalizeQuery(value) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

const vehicleProfiles = [
  { label: "VW Golf Diesel", terms: ["VW", "Golf", "Diesel", "TDI"] },
  { label: "VW Passat Diesel", terms: ["VW", "Passat", "Diesel", "TDI"] },
  { label: "Audi A4 Diesel", terms: ["Audi", "A4", "Diesel", "TDI"] },
  { label: "BMW 3er Diesel", terms: ["BMW", "3er", "Diesel"] },
  { label: "Mercedes C-Klasse Diesel", terms: ["Mercedes", "C-Klasse", "Diesel"] },
  { label: "Opel Astra Benzin", terms: ["Opel", "Astra", "Benzin"] },
  { label: "Ford Focus Diesel", terms: ["Ford", "Focus", "Diesel"] },
  { label: "Renault Megane Diesel", terms: ["Renault", "Megane", "Diesel"] },
  { label: "Peugeot 308 Diesel", terms: ["Peugeot", "308", "Diesel"] },
  { label: "Toyota Corolla Hybrid", terms: ["Toyota", "Corolla", "Hybrid"] },
  { label: "Hyundai i30 Benzin", terms: ["Hyundai", "i30", "Benzin"] },
  { label: "Kia Ceed Benzin", terms: ["Kia", "Ceed", "Benzin"] },
  { label: "Skoda Octavia Diesel", terms: ["Skoda", "Octavia", "Diesel", "TDI"] },
  { label: "Seat Leon Benzin", terms: ["Seat", "Leon", "Benzin", "TSI"] },
  { label: "Volvo V60 Diesel", terms: ["Volvo", "V60", "Diesel"] },
  { label: "Nissan Qashqai Diesel", terms: ["Nissan", "Qashqai", "Diesel"] },
  { label: "Fiat Ducato Diesel", terms: ["Fiat", "Ducato", "Diesel"] },
  { label: "VW Transporter Diesel", terms: ["VW", "Transporter", "Diesel", "TDI"] },
  { label: "Mazda 3 Benzin", terms: ["Mazda", "3", "Benzin"] },
  { label: "Dacia Duster Diesel", terms: ["Dacia", "Duster", "Diesel"] },
];

vehicleProfiles.push(
  { label: "VW Polo Benzin", terms: ["VW", "Polo", "Benzin", "TSI"] },
  { label: "VW Tiguan Diesel", terms: ["VW", "Tiguan", "Diesel", "TDI"] },
  { label: "Audi A3 Benzin", terms: ["Audi", "A3", "Benzin", "TFSI"] },
  { label: "Audi Q5 Diesel", terms: ["Audi", "Q5", "Diesel", "TDI"] },
  { label: "BMW 1er Benzin", terms: ["BMW", "1er", "Benzin"] },
  { label: "BMW 5er Diesel", terms: ["BMW", "5er", "Diesel"] },
  { label: "Mercedes A-Klasse Benzin", terms: ["Mercedes", "A-Klasse", "Benzin"] },
  { label: "Mercedes Sprinter Diesel", terms: ["Mercedes", "Sprinter", "Diesel"] },
  { label: "Opel Corsa Benzin", terms: ["Opel", "Corsa", "Benzin"] },
  { label: "Opel Insignia Diesel", terms: ["Opel", "Insignia", "Diesel"] },
  { label: "Ford Fiesta Benzin", terms: ["Ford", "Fiesta", "Benzin"] },
  { label: "Ford Transit Diesel", terms: ["Ford", "Transit", "Diesel"] },
  { label: "Renault Clio Benzin", terms: ["Renault", "Clio", "Benzin"] },
  { label: "Renault Master Diesel", terms: ["Renault", "Master", "Diesel"] },
  { label: "Peugeot 208 Benzin", terms: ["Peugeot", "208", "Benzin"] },
  { label: "Peugeot Boxer Diesel", terms: ["Peugeot", "Boxer", "Diesel"] },
  { label: "Citroen Berlingo Diesel", terms: ["Citroen", "Berlingo", "Diesel"] },
  { label: "Citroen C3 Benzin", terms: ["Citroen", "C3", "Benzin"] },
  { label: "Toyota Yaris Hybrid", terms: ["Toyota", "Yaris", "Hybrid"] },
  { label: "Toyota RAV4 Hybrid", terms: ["Toyota", "RAV4", "Hybrid"] },
  { label: "Hyundai Tucson Diesel", terms: ["Hyundai", "Tucson", "Diesel"] },
  { label: "Hyundai Kona Elektro", terms: ["Hyundai", "Kona", "Elektro"] },
  { label: "Kia Sportage Diesel", terms: ["Kia", "Sportage", "Diesel"] },
  { label: "Kia Niro Hybrid", terms: ["Kia", "Niro", "Hybrid"] },
  { label: "Skoda Fabia Benzin", terms: ["Skoda", "Fabia", "Benzin", "TSI"] },
  { label: "Skoda Superb Diesel", terms: ["Skoda", "Superb", "Diesel", "TDI"] },
  { label: "Seat Ibiza Benzin", terms: ["Seat", "Ibiza", "Benzin", "TSI"] },
  { label: "Volvo XC60 Diesel", terms: ["Volvo", "XC60", "Diesel"] },
  { label: "Nissan Micra Benzin", terms: ["Nissan", "Micra", "Benzin"] },
  { label: "Fiat 500 Benzin", terms: ["Fiat", "500", "Benzin"] },
  { label: "Mazda CX-5 Diesel", terms: ["Mazda", "CX-5", "Diesel"] },
  { label: "Dacia Sandero Benzin", terms: ["Dacia", "Sandero", "Benzin"] },
);

const faultTopics = [
  {
    code: "P0299",
    title: "Ladedruck zu gering",
    category: "Motor",
    system: "Ladedruck / Aufladung",
    symptom: "Leistungsverlust oder Notlauf unter Last",
    causes: ["Undichte Ladeluftstrecke", "Unterdruck-/Druckregelproblem", "VTG/Wastegate schwergängig", "Ladedrucksensor unplausibel"],
    checks: ["Fehlerspeicher und Freeze-Frame sichern", "Ladedruck Soll/Ist unter Last vergleichen", "Ladeluftstrecke mit Druck oder Rauch prüfen", "Ansteuerung von VTG/Wastegate plausibilisieren"],
    tools: ["Diagnosetester", "Rauchgerät oder Druckprüfadapter", "Unterdruck-/Druckpumpe", "Multimeter bei elektrischer Ansteuerung"],
    risk: "Bei starkem Leistungsverlust nicht weiter unter hoher Last fahren.",
  },
  {
    code: "P0234",
    title: "Ladedruck zu hoch",
    category: "Motor",
    system: "Ladedruck / Aufladung",
    symptom: "Notlauf bei Beschleunigung oder hoher Last",
    causes: ["VTG/Wastegate klemmt", "Druckwandler regelt falsch", "Ladedrucksensor unplausibel", "Software-/Tuning-Einfluss"],
    checks: ["Ladedruck Soll/Ist loggen", "Stellgliedtest der Ladedruckregelung durchführen", "Mechanische Verstellung auf freien Weg prüfen", "Drucksensor plausibilisieren"],
    tools: ["Diagnosetester", "Unterdruck-/Druckpumpe", "Multimeter", "Herstellerdaten für Ansteuerlogik"],
    risk: "Überhöhter Ladedruck kann Motor und Turbolader beschädigen.",
  },
  {
    code: "P0401",
    title: "AGR-Durchsatz zu gering",
    category: "Motor",
    system: "AGR / Abgasrückführung",
    symptom: "Motorkontrollleuchte, Ruckeln oder Regeneration gestört",
    causes: ["AGR-Ventil verkokt", "AGR-Strecke zugesetzt", "Luftmassenmesser unplausibel", "Unterdruck-/Stellgliedproblem"],
    checks: ["AGR Soll/Ist prüfen", "LMM-Reaktion bei AGR-Ansteuerung beobachten", "AGR-Stellgliedtest durchführen", "AGR-Strecke auf Verkokung prüfen"],
    tools: ["Diagnosetester", "Grundwerkzeug", "Endoskop bei Bedarf", "Multimeter bei elektrischer Ansteuerung"],
    risk: "Nicht blind reinigen oder ersetzen; zuerst Durchsatz und Ansteuerung beweisen.",
  },
  {
    code: "P0402",
    title: "AGR-Durchsatz zu hoch",
    category: "Motor",
    system: "AGR / Abgasrückführung",
    symptom: "Ruckeln, Absterben oder Rauchentwicklung",
    causes: ["AGR-Ventil hängt offen", "AGR-Ansteuerung fehlerhaft", "Luftmassenmesser unplausibel", "Ansaugsystem verschmutzt"],
    checks: ["AGR-Position und Sollwert vergleichen", "LMM-Wert bei geschlossenem AGR plausibilisieren", "Stellgliedtest ausführen", "Mechanische Rückstellung prüfen"],
    tools: ["Diagnosetester", "Grundwerkzeug", "Multimeter", "Herstellerdaten für Stellgliedtest"],
    risk: "Bei starkem Ruckeln oder Absterben Probefahrt abbrechen.",
  },
  {
    code: "P0087",
    title: "Kraftstoffdruck zu niedrig",
    category: "Motor",
    system: "Kraftstoffdruck / Raildruck",
    symptom: "Startprobleme, Notlauf oder Aussetzer unter Last",
    causes: ["Kraftstofffilter zugesetzt", "Niederdruckversorgung zu schwach", "Hochdruckpumpe verschlissen", "Injektor-Rücklaufmenge zu hoch"],
    checks: ["Raildruck Soll/Ist beim Starten und unter Last prüfen", "Niederdruckversorgung messen", "Kraftstofffilterzustand prüfen", "Rücklaufmenge der Injektoren prüfen"],
    tools: ["Diagnosetester", "Kraftstoffdruck-Prüfmittel", "Rücklaufmengen-Prüfset", "Herstellerdaten"],
    risk: "Arbeiten am Kraftstoffsystem nur drucklos und mit passender Schutzausrüstung.",
  },
  {
    code: "P0088",
    title: "Kraftstoffdruck zu hoch",
    category: "Motor",
    system: "Kraftstoffdruck / Raildruck",
    symptom: "Notlauf, schlechter Motorlauf oder harte Verbrennung",
    causes: ["Druckregelventil klemmt", "Mengenregelventil fehlerhaft", "Raildrucksensor unplausibel", "Rücklauf blockiert"],
    checks: ["Raildruck Soll/Ist vergleichen", "Regelventile per Stellgliedtest prüfen", "Raildrucksensor plausibilisieren", "Rücklauf auf Blockade prüfen"],
    tools: ["Diagnosetester", "Multimeter", "Kraftstoffdruck-Prüfmittel", "Herstellerdaten"],
    risk: "Hochdruck-Kraftstoffsystem nicht bei laufendem Motor öffnen.",
  },
  {
    code: "P0101",
    title: "Luftmassenmesser unplausibel",
    category: "Motor",
    system: "Luftmasse / Ansaugsystem",
    symptom: "Ruckeln, Leistungsverlust oder Gemisch-/AGR-Folgefehler",
    causes: ["LMM verschmutzt oder fehlerhaft", "Falschluft nach LMM", "AGR beeinflusst Luftmasse", "Luftfilter stark verschmutzt"],
    checks: ["LMM-Wert im Leerlauf und unter Last plausibilisieren", "Ansaugsystem auf Undichtigkeit prüfen", "Luftfilter prüfen", "AGR-Ansteuerung und LMM-Reaktion vergleichen"],
    tools: ["Diagnosetester", "Rauchgerät", "Multimeter bei Bedarf", "Grundwerkzeug"],
    risk: "LMM nicht nur wegen Fehlercode ersetzen; erst Luftweg und AGR-Einfluss prüfen.",
  },
  {
    code: "P0171",
    title: "Gemisch zu mager",
    category: "Motor",
    system: "Gemischbildung / Benziner",
    symptom: "Unruhiger Leerlauf, MKL oder schlechte Gasannahme",
    causes: ["Falschluft im Ansaugsystem", "Kurbelgehäuseentlüftung undicht", "Kraftstoffdruck zu niedrig", "Lambdasonde unplausibel"],
    checks: ["Fuel Trims prüfen", "Ansaugsystem abnebeln", "Kurbelgehäuseentlüftung prüfen", "Kraftstoffdruck nach Herstellerdaten prüfen"],
    tools: ["Diagnosetester", "Rauchgerät", "Kraftstoffdruck-Prüfmittel", "Multimeter"],
    risk: "Längeres Fahren mit magerem Gemisch kann Folgeschäden verursachen.",
  },
  {
    code: "P0172",
    title: "Gemisch zu fett",
    category: "Motor",
    system: "Gemischbildung / Benziner",
    symptom: "Hoher Verbrauch, schwarzer Rauch oder unruhiger Lauf",
    causes: ["Injektor undicht", "Kraftstoffdruck zu hoch", "LMM unplausibel", "Lambdasonde unplausibel"],
    checks: ["Fuel Trims prüfen", "Kraftstoffdruck und Haltedruck prüfen", "Injektoren auf Nachtropfen prüfen", "LMM- und Lambdawerte plausibilisieren"],
    tools: ["Diagnosetester", "Kraftstoffdruck-Prüfmittel", "Multimeter", "Abgastester bei Bedarf"],
    risk: "Unverbrannter Kraftstoff kann Katalysator und Ölqualität belasten.",
  },
  {
    code: "P0300",
    title: "Zufällige Zündaussetzer",
    category: "Motor",
    system: "Verbrennung / Zündung / Einspritzung",
    symptom: "Ruckeln, blinkende MKL oder Aussetzerzähler auf mehreren Zylindern",
    causes: ["Zündanlage oder Glüheinfluss je nach Motortyp", "Einspritzproblem", "Falschluft/Gemischfehler", "Kompressionsproblem"],
    checks: ["Aussetzerzähler beobachten", "Zylinderzuordnung prüfen", "Zündung/Einspritzung/Kompression trennen", "Gemisch- und Luftsystem plausibilisieren"],
    tools: ["Diagnosetester", "Kompressions-/Druckverlusttester", "Zünd-/Einspritzprüfmittel passend zum Motortyp", "Rauchgerät"],
    risk: "Bei blinkender MKL Last vermeiden; Katalysator- oder Motorschäden möglich.",
  },
  {
    code: "P0301",
    title: "Zündaussetzer Zylinder 1",
    category: "Motor",
    system: "Verbrennung / Zylinder 1",
    symptom: "Ruckeln, Aussetzer auf Zylinder 1 oder blinkende MKL",
    causes: ["Zünd-/Einspritzbauteil zylinderbezogen", "Falschluft am Ansaugkanal", "Kompression auffällig", "Kabel-/Steckerproblem"],
    checks: ["Aussetzerzähler Zylinder 1 prüfen", "Bauteil quer tauschen, wenn technisch sinnvoll", "Einspritzsignal prüfen", "Kompression/Druckverlust prüfen"],
    tools: ["Diagnosetester", "Kompressions-/Druckverlusttester", "Multimeter/Oszilloskop bei Bedarf", "Grundwerkzeug"],
    risk: "Bei starkem Aussetzer nicht weiterfahren, bis Katalysatorrisiko bewertet ist.",
  },
  {
    code: "P0302",
    title: "Zündaussetzer Zylinder 2",
    category: "Motor",
    system: "Verbrennung / Zylinder 2",
    symptom: "Ruckeln, Aussetzer auf Zylinder 2 oder blinkende MKL",
    causes: ["Zünd-/Einspritzbauteil zylinderbezogen", "Falschluft am Ansaugkanal", "Kompression auffällig", "Kabel-/Steckerproblem"],
    checks: ["Aussetzerzähler Zylinder 2 prüfen", "Bauteil quer tauschen, wenn technisch sinnvoll", "Einspritzsignal prüfen", "Kompression/Druckverlust prüfen"],
    tools: ["Diagnosetester", "Kompressions-/Druckverlusttester", "Multimeter/Oszilloskop bei Bedarf", "Grundwerkzeug"],
    risk: "Bei starkem Aussetzer nicht weiterfahren, bis Katalysatorrisiko bewertet ist.",
  },
  {
    code: "P0303",
    title: "Zündaussetzer Zylinder 3",
    category: "Motor",
    system: "Verbrennung / Zylinder 3",
    symptom: "Ruckeln, Aussetzer auf Zylinder 3 oder blinkende MKL",
    causes: ["Zünd-/Einspritzbauteil zylinderbezogen", "Falschluft am Ansaugkanal", "Kompression auffällig", "Kabel-/Steckerproblem"],
    checks: ["Aussetzerzähler Zylinder 3 prüfen", "Bauteil quer tauschen, wenn technisch sinnvoll", "Einspritzsignal prüfen", "Kompression/Druckverlust prüfen"],
    tools: ["Diagnosetester", "Kompressions-/Druckverlusttester", "Multimeter/Oszilloskop bei Bedarf", "Grundwerkzeug"],
    risk: "Bei starkem Aussetzer nicht weiterfahren, bis Katalysatorrisiko bewertet ist.",
  },
  {
    code: "P0304",
    title: "Zündaussetzer Zylinder 4",
    category: "Motor",
    system: "Verbrennung / Zylinder 4",
    symptom: "Ruckeln, Aussetzer auf Zylinder 4 oder blinkende MKL",
    causes: ["Zünd-/Einspritzbauteil zylinderbezogen", "Falschluft am Ansaugkanal", "Kompression auffällig", "Kabel-/Steckerproblem"],
    checks: ["Aussetzerzähler Zylinder 4 prüfen", "Bauteil quer tauschen, wenn technisch sinnvoll", "Einspritzsignal prüfen", "Kompression/Druckverlust prüfen"],
    tools: ["Diagnosetester", "Kompressions-/Druckverlusttester", "Multimeter/Oszilloskop bei Bedarf", "Grundwerkzeug"],
    risk: "Bei starkem Aussetzer nicht weiterfahren, bis Katalysatorrisiko bewertet ist.",
  },
  {
    code: "P2002",
    title: "DPF Wirkungsgrad zu gering",
    category: "Motor",
    system: "DPF / Abgasnachbehandlung",
    symptom: "DPF-Warnung, Notlauf oder häufige Regeneration",
    causes: ["DPF mit Ruß oder Asche beladen", "Differenzdrucksensor/Schläuche fehlerhaft", "Temperatursensor unplausibel", "Regeneration wird verhindert"],
    checks: ["Differenzdruck im Leerlauf und bei erhöhter Drehzahl prüfen", "Ruß- und Aschemasse bewerten", "Schläuche zum Differenzdrucksensor prüfen", "Regenerationsbedingungen prüfen"],
    tools: ["Diagnosetester", "Sichtprüfung der Druckschläuche", "Herstellerdaten", "Grundwerkzeug"],
    risk: "Keine Zwangsregeneration ohne Herstellerfreigabe und Brandrisiko-Bewertung.",
  },
  {
    code: "P2453",
    title: "Differenzdrucksensor Signal unplausibel",
    category: "Motor",
    system: "DPF / Differenzdruck",
    symptom: "DPF-Fehler, Regeneration bricht ab oder unplausible Druckwerte",
    causes: ["Differenzdrucksensor fehlerhaft", "Schläuche verstopft oder vertauscht", "Kondensat in Leitungen", "Kabel-/Steckerproblem"],
    checks: ["Sensorwert bei stehendem Motor plausibilisieren", "Druckschläuche prüfen", "Stecker/Kabel prüfen", "DPF-Beladung getrennt bewerten"],
    tools: ["Diagnosetester", "Multimeter", "Grundwerkzeug", "Herstellerdaten"],
    risk: "DPF nicht ersetzen, bevor Sensorik und Schlauchführung bewiesen sind.",
  },
];

const diagnosisScenarios = [
  {
    label: "unter Last",
    symptom: "Fehler tritt vor allem beim Beschleunigen oder am Berg auf",
    terms: ["unter Last", "Beschleunigung", "Bergfahrt", "Probefahrt"],
    focus:
      "Lastzustand sauber reproduzieren, Live-Daten aufzeichnen und nicht im Stand entscheiden.",
  },
  {
    label: "sporadisch",
    symptom: "Fehler tritt unregelmäßig auf und ist nicht immer reproduzierbar",
    terms: ["sporadisch", "zeitweise", "kommt und geht", "Freeze-Frame"],
    focus:
      "Freeze-Frame, Randbedingungen und Wackel-/Temperaturtest priorisieren.",
  },
  {
    label: "kalt",
    symptom: "Fehler tritt vor allem nach Kaltstart oder in der Warmlaufphase auf",
    terms: ["Kaltstart", "kalt", "Warmlauf", "morgens"],
    focus:
      "Temperaturwerte, Startbedingungen und Gemisch-/Regelverhalten kalt bewerten.",
  },
  {
    label: "warm",
    symptom: "Fehler tritt erst bei warmem Motor oder nach längerer Fahrt auf",
    terms: ["warm", "heiß", "nach längerer Fahrt", "Temperatur"],
    focus:
      "Wärmefehler, Sensorplausibilität und elektrische Kontakte warm prüfen.",
  },
  {
    label: "nach Reparatur",
    symptom: "Fehler ist nach einer Reparatur oder Teileerneuerung aufgetreten",
    terms: ["nach Reparatur", "nach Tausch", "nach Montage", "neu aufgetreten"],
    focus:
      "Montagezustand, Steckverbindungen, Grundeinstellung und Folgefehler prüfen.",
  },
  {
    label: "bei Nässe",
    symptom: "Fehler tritt bei Regen, Feuchtigkeit oder nach Fahrzeugwäsche auf",
    terms: ["Nässe", "Regen", "Feuchtigkeit", "Wasser"],
    focus:
      "Stecker, Kabelweg, Massepunkte und Wassereintritt gezielt prüfen.",
  },
  {
    label: "im Leerlauf",
    symptom: "Fehler zeigt sich im Leerlauf, beim Rangieren oder im Stand",
    terms: ["Leerlauf", "Stand", "Rangieren", "Ampel"],
    focus:
      "Leerlaufregelung, Lastsprünge, Nebenluft und Verbraucherzuschaltung prüfen.",
  },
  {
    label: "ohne Fehlerlampe",
    symptom: "Symptom ist vorhanden, aber die Warnlampe ist aus oder der Fehler ist nicht dauerhaft gespeichert",
    terms: ["ohne Fehlerlampe", "kein Fehler gespeichert", "keine MKL", "Symptomdiagnose"],
    focus:
      "Symptomdiagnose über Istwerte, Sichtprüfung und reproduzierbare Bedingungen führen.",
  },
];

function getTopicLabel(topic) {
  return topic.code ? `${topic.code} ${topic.title}` : topic.title;
}

function buildWorkshopDiagnosis(topic, vehicle, scenario) {
  const causes = topic.causes
    .map((cause, index) => {
      const priority = index === 0 ? "hoch" : index === 1 ? "mittel" : "niedrig";
      return `- [${priority}] Ursache: ${cause} | Typischer Fehler: Teiletausch ohne Messbeweis | Prüfbeweis: ${topic.checks[index % topic.checks.length]}.`;
    })
    .join("\n");
  const checks = topic.checks.map((check) => `- ${check}.`).join("\n");
  const tools = topic.tools.map((tool) => `- ${tool}`).join("\n");
  const topicLabel = getTopicLabel(topic);

  return `# Diagnosepfad
${topicLabel} bei ${vehicle.label}, Randbedingung ${scenario.label}: Symptom -> ${topic.system} eingrenzen -> einfache Sichtprüfung -> Messwerte/Istwerte -> Entscheidung. Fahrzeugdaten, Motorcode und Systemvariante zuerst sichern.
Sonderfokus: ${scenario.focus}

# Ursachen / typische Fehler
${causes}

# Soll-/Richtwerte
- Keine fahrzeugspezifischen Sollwerte in diesem Seed hinterlegt.
- Exakte Sollwerte, Druckwerte, Spannungswerte und Grenzwerte nach Herstellerdaten, VIN und Motorcode prüfen.
- Bewertbar sind hier nur Plausibilität, Richtung der Abweichung und die Reihenfolge der Prüfungen.

# Prüfungen und Messwerte
${checks}
- Kontextprüfung: ${scenario.symptom}. Randbedingung aktiv reproduzieren oder dokumentieren.
- Messbedingungen dokumentieren: Motor warm/kalt, Lastzustand, Drehzahlbereich, Fehler aktiv/sporadisch.
- Nur nach bestätigter Abweichung zum nächsten Prüfpfad wechseln.

# Entscheidung
- Befund eindeutig: Ursache dokumentieren und Reparatur gezielt planen.
- Befund unklar: zweiten Messweg wählen, Stecker/Kabel/Sichtprüfung wiederholen, dann erst Bauteil verdächtigen.
- Fahrzeugabhängige Werte, Einbauvorgaben und Freigaben immer aus Herstellerdaten übernehmen.

# Benötigte Werkzeuge
${tools}

# Benötigte Ersatzteile / Material
- Vorher bereitlegen: Reinigungsmaterial, Dokumentationsmöglichkeit, passende Prüfadapter nur bei Bedarf.
- Nur bei Befund ersetzen: verdächtiges Bauteil erst nach Messbeweis.
- Einmalteile, Dichtungen, Schrauben und Betriebsstoffe nach Herstellerdaten und Demontageumfang festlegen.

# Speicherung / Notizen
- Fehlercode, Freeze-Frame, Istwerte und Messbedingungen speichern.
- Prüfbeweis, ersetztes Teil und Abschlussprüfung dokumentieren.
- Nach Reparatur Fehlerspeicher löschen, Probefahrt unter passenden Bedingungen durchführen und erneut auslesen.`;
}

function buildHobbyDiagnosis(topic, vehicle, scenario) {
  const checks = topic.checks
    .slice(0, 5)
    .map((check, index) => `${index + 1}. ${check}.`)
    .join("\n");
  const topicLabel = getTopicLabel(topic);

  return `# Fehlercode
${topicLabel} bedeutet vereinfacht: ${topic.title}. Betroffen ist vor allem ${topic.system}. Der Code oder das Symptom beweist noch nicht automatisch ein defektes Teil, sondern zeigt den Bereich, der geprüft werden muss.
Wichtig in diesem Fall: ${scenario.symptom}.

# Soll-/Richtwerte
Für ${vehicle.label} sind in diesem gespeicherten Fall keine exakten Herstellerwerte hinterlegt. Genaue Werte werden über Modell, Baujahr, Motorcode und Herstellerdaten bestimmt.

# Selbst machbar?
Eingeschränkt. Sichtprüfung, Steckerprüfung und Fehler auslesen sind oft machbar. Messungen, Druckprüfungen, Kraftstoffsystem, DPF-Regeneration oder Arbeiten an heißen/gefährlichen Bauteilen gehören in erfahrene Hände.

# Schwierigkeit
Mittel bis schwer, je nach Zugang, Messmitteln und Fahrzeugvariante.

# Werkzeug
- Grundwerkzeug: Lampe, Sichtprüfung, einfache Demontage nur wenn sicher.
- Diagnosegerät / Messmittel: OBD-Tester und passende Live-Daten.
- Spezialwerkzeug: fahrzeugabhängig, nicht raten.
- Hebebühne / Arbeitsplatz: nötig, wenn Unterboden, Abgas, Kraftstoff oder Ladeluftstrecke unten geprüft werden müssen.

# Benötigte Ersatzteile / Material
- Vorher nichts auf Verdacht kaufen.
- Nur bei Befund ersetzen: ${topic.causes.slice(0, 2).join(" oder ")}.
- Dichtungen, Schrauben und Betriebsstoffe erst nach Herstellerdaten festlegen.

# Risiko
${topic.risk}

# Prüfreihenfolge
${checks}
6. Randbedingung beachten: ${scenario.focus}

# Werkstattkosten grob
Nur als Schätzung möglich: einfache Diagnose oft unter einer Stunde, aufwendige Messungen oder schwerer Zugang deutlich mehr. Teilekosten hängen vom bestätigten Befund ab.

# Nächste Schritte
- Fahrzeugdaten ergänzen: Modell, Baujahr, Motorcode, Kilometerstand, Symptome, Freeze-Frame.
- Wenn der Fehler unter Last auftritt, Live-Daten nicht im Stand bewerten.
- Reparatur erst starten, wenn die Ursache bewiesen ist.`;
}

function buildDiagnosisRows() {
  const rows = [];
  const combinations = [];

  for (const topic of faultTopics) {
    for (const vehicle of vehicleProfiles) {
      for (const scenario of diagnosisScenarios) {
        combinations.push({ topic, vehicle, scenario });
      }
    }
  }

  for (const { topic, vehicle, scenario } of combinations.slice(
    0,
    Math.ceil(DIAGNOSIS_TARGET / 2)
  )) {
    for (const audienceMode of ["workshop", "hobby"]) {
      const topicLabel = getTopicLabel(topic);
      const title = `${topicLabel} - ${vehicle.label} - ${scenario.label}`;
      const sourceQuery = `${vehicle.label} ${topicLabel} ${topic.symptom} ${scenario.label} ${scenario.symptom}`;

      rows.push({
        slug: slugify(`${audienceMode}-${title}`),
        source_query: sourceQuery,
        normalized_query: normalizeQuery(sourceQuery),
        audience_mode: audienceMode,
        title,
        category: topic.category,
        system_group: topic.system,
        fault_codes: topic.code ? [topic.code] : [],
        symptoms: unique([topic.symptom, scenario.symptom]),
        vehicle_terms: vehicle.terms,
        tags: unique([
          topic.code,
          topic.title,
          topic.system,
          ...topic.causes,
          ...vehicle.terms,
          ...scenario.terms,
        ]),
        answer:
          audienceMode === "workshop"
            ? buildWorkshopDiagnosis(topic, vehicle, scenario)
            : buildHobbyDiagnosis(topic, vehicle, scenario),
        quality_note:
          "Seed-Diagnose ohne erfundene Herstellerwerte. Exakte Sollwerte und Reparaturdaten über VIN, Motorcode und Herstellerdaten prüfen.",
        source: "seed",
        status: "approved",
      });
    }
  }

  return rows.slice(0, DIAGNOSIS_TARGET);
}

const instructionTopics = [
  ["Ölservice vorbereiten", "Motor", "leicht", "Motoröl / Filter", "Service fachgerecht vorbereiten und Abschluss prüfen"],
  ["Bremsbeläge vorne prüfen", "Bremse", "mittel", "Bremse", "Belagverschleiß, Führung und Sicherheitsprüfung bewerten"],
  ["Batterie entlädt sich", "Elektrik", "mittel", "Ruhestrom / Batterie", "Ruhestromdiagnose ohne Teiletausch auf Verdacht"],
  ["Drehstromgenerator prüfen", "Elektrik", "mittel", "Generator / Ladesystem", "Ladespannung, Leitung und Verbraucherlast prüfen"],
  ["Anlasser dreht nicht", "Elektrik", "mittel", "Starter / Startfreigabe", "Startsignal, Spannungsfall und Masse prüfen"],
  ["Kühlmittelverlust suchen", "Motor", "mittel", "Kühlsystem", "Dichtheit, Druckprüfung und Folgeschäden bewerten"],
  ["Thermostat prüfen", "Motor", "mittel", "Kühlmittelregelung", "Aufwärmverhalten und Temperaturführung prüfen"],
  ["Kühlerlüfter läuft nicht", "Elektrik", "mittel", "Lüftersteuerung", "Freigabe, Sicherung, Relais und Ansteuerung prüfen"],
  ["Klimaanlage kühlt nicht", "Klima", "mittel", "Klimasystem", "Freigabe, Druckwerte und Luftklappen eingrenzen"],
  ["Gebläsemotor ohne Funktion", "Elektrik", "mittel", "Innenraumgebläse", "Versorgung, Masse, Regler und Bedienteil prüfen"],
  ["ABS-Sensor prüfen", "Fahrwerk", "mittel", "ABS / Raddrehzahl", "Raddrehzahlsignal und Kabelweg prüfen"],
  ["Radlagergeräusch eingrenzen", "Fahrwerk", "mittel", "Radlager", "Geräusch, Spiel und Fahrzustand trennen"],
  ["Ladeluftleck suchen", "Motor", "mittel", "Ladeluftstrecke", "Druckverlust und Ölspuren systematisch prüfen"],
  ["AGR-Ventil prüfen", "Motor", "mittel", "AGR", "Durchsatz und Stellgliedlogik prüfen"],
  ["DPF-Regeneration prüfen", "Motor", "schwer", "DPF", "Regenerationsbedingungen und Differenzdruck bewerten"],
  ["Luftmassenmesser prüfen", "Motor", "mittel", "Luftmasse", "LMM-Wert, Luftweg und AGR-Einfluss trennen"],
  ["Lambdasonde plausibilisieren", "Motor", "mittel", "Gemisch / Lambda", "Regelung, Adaption und Falschluft prüfen"],
  ["Zündaussetzer eingrenzen", "Motor", "mittel", "Verbrennung", "Zündung, Einspritzung und Kompression trennen"],
  ["Injektor-Rücklauf prüfen", "Motor", "schwer", "Kraftstoffsystem", "Rücklaufmenge und Raildrucklogik bewerten"],
  ["Kraftstoffdruck zu niedrig", "Motor", "schwer", "Kraftstoffdruck", "Niederdruck und Hochdruck getrennt prüfen"],
  ["Wechslerrelais prüfen", "Elektrik", "leicht", "Relais / Klemmen", "Klemmenlogik, Schaltkontakt und Ansteuerung prüfen"],
  ["NTC-Sensor prüfen", "Elektrik", "leicht", "Temperatursensor", "Widerstandsänderung und Plausibilität prüfen"],
  ["CAN-Kommunikation gestört", "Elektrik", "schwer", "Bordnetz / CAN", "Versorgung, Abschluss und Teilnehmer eingrenzen"],
  ["Kupplung trennt schlecht", "Fahrwerk", "mittel", "Kupplung / Hydraulik", "Hydraulik, Mechanik und Bedienweg prüfen"],
  ["Lenkung poltert", "Fahrwerk", "mittel", "Lenkung / Vorderachse", "Spiel, Lagerung und Befestigung prüfen"],
];

const instructionScenarios = [
  {
    label: "Diagnoseablauf",
    searchTerms: ["Diagnose", "Prüfplan", "Fehler eingrenzen"],
    focus: "Prüfpfad von Symptom zu Befund",
  },
  {
    label: "Schritt-für-Schritt",
    searchTerms: ["Anleitung", "Schritte", "Arbeitsablauf"],
    focus: "klare Reihenfolge ohne grobe Sammelschritte",
  },
  {
    label: "Messplan",
    searchTerms: ["Messwerte", "Messplan", "Soll Ist"],
    focus: "Messort, Betriebszustand und Entscheidung",
  },
  {
    label: "Sichtprüfung",
    searchTerms: ["Sichtprüfung", "Stecker", "Undichtigkeit"],
    focus: "schnelle Prüfungen vor Teiletausch",
  },
  {
    label: "Ausbau vorbereiten",
    searchTerms: ["Ausbau", "Demontage", "Zugang"],
    focus: "Zugang, Einmalteile und Herstellerdaten vor Zerlegung",
  },
  {
    label: "Einbau und Abschluss",
    searchTerms: ["Einbau", "Montage", "Abschlussprüfung"],
    focus: "Montagevorgaben, Funktionstest und Probefahrt",
  },
  {
    label: "sporadischer Fehler",
    searchTerms: ["sporadisch", "zeitweise", "Freeze-Frame"],
    focus: "Randbedingungen, Wackeltest und reproduzierbare Prüfung",
  },
  {
    label: "ohne Fehlercode",
    searchTerms: ["ohne Fehlercode", "Symptom", "kein Fehler gespeichert"],
    focus: "Symptomdiagnose über Istwerte und Sichtbefund",
  },
  {
    label: "nach Reparatur",
    searchTerms: ["nach Reparatur", "nach Tausch", "nach Montage"],
    focus: "Montagezustand, Steckverbindungen und Folgefehler prüfen",
  },
  {
    label: "Kundenbeanstandung",
    searchTerms: ["Kundenbeanstandung", "Probefahrt", "Dokumentation"],
    focus: "Beanstandung nachvollziehen und beweisbar dokumentieren",
  },
];

function buildInstructionSteps(topicTitle, systemGroup, scenario) {
  return [
    ["Fahrzeugdaten sichern", "Hersteller, Modell, Baujahr, Motorcode/Systemvariante und Kundenbeanstandung notieren.", "Fehlen Daten, Anleitung nur als allgemeinen Ablauf verwenden."],
    ["Fokus festlegen", `${scenario.focus}. Ziel und Abbruchkriterien vor der Arbeit festlegen.`, "Wenn der Fokus nicht passt, Anleitung nur als Grundstruktur verwenden."],
    ["Fehlerbild bestätigen", "Beanstandung unter passenden Bedingungen nachvollziehen und nicht direkt Teile ersetzen.", "Wenn Fehler nicht reproduzierbar ist, Randbedingungen dokumentieren."],
    ["Fehlerspeicher und Istwerte prüfen", "Relevante Steuergeräte auslesen, Freeze-Frame sichern und Istwerte plausibilisieren.", "Nur Werte aus Herstellerdaten als exakte Sollwerte verwenden."],
    ["Sichtprüfung durchführen", `${systemGroup} auf offensichtliche Schäden, lose Stecker, Undichtigkeiten, Korrosion oder mechanische Auffälligkeiten prüfen.`, "Erst einfache Befunde abarbeiten."],
    ["Versorgung und Masse prüfen", "Bei elektrischer Beteiligung Spannungsversorgung, Massepunkt und Steckverbindung unter Last prüfen.", "Spannungsfall ist oft aussagekräftiger als eine Leerlaufmessung."],
    ["Mechanische Funktion prüfen", "Bewegliche Teile, Lagerung, Freigängigkeit, Dichtflächen und Montagezustand prüfen.", "Bei sicherheitsrelevanten Bauteilen Arbeit abbrechen, wenn Qualifikation fehlt."],
    ["Messung mit Entscheidung verknüpfen", "Jede Messung mit einer klaren Gut/Schlecht-Entscheidung dokumentieren.", "Abweichung vor Teiletausch über zweite Prüfung bestätigen."],
    ["Reparatur nur bei Befund planen", "Ersatzteile, Einmalteile, Dichtungen und Betriebsstoffe erst nach bestätigter Ursache festlegen.", "Keine Teile auf Verdacht bestellen."],
    ["Montagevorgaben prüfen", "Drehmomente, Drehwinkel, Spezialwerkzeug und Reihenfolgen aus Herstellerdaten übernehmen.", "Keine Werte schätzen."],
    ["Abschlussprüfung durchführen", "Funktionstest, Fehlerspeicher, Live-Daten, Dichtheit, Geräusch und Probefahrt je nach System prüfen.", "Ergebnis im Fall dokumentieren."],
  ].map(([title, description, decision], index) => ({
    title,
    description,
    check: index < 4 ? "Befund mit Foto, Messwert oder Testerwert dokumentieren." : "",
    warning: index === 6 ? "Bei Bremse, Lenkung, Airbag, Hochvolt, Kraftstoff oder Steuerzeiten nur mit passender Qualifikation arbeiten." : "",
    measurement: index === 7 ? "Messort, Betriebszustand und Istwert notieren." : "",
    expectedResult: "Fahrzeugabhängigen Sollzustand aus Herstellerdaten oder plausibler Systemfunktion ableiten.",
    decision,
    qualityCheck: index === 10 ? "Nach Reparatur erneute Prüfung unter denselben Bedingungen durchführen." : "",
    imageHint: `Bild/Skizze zu ${topicTitle}: Schritt ${index + 1} mit markiertem Prüfpunkt.`,
    imageAlt: `${topicTitle} Schritt ${index + 1}`,
  }));
}

function buildInstructionRows() {
  const rows = [];

  for (const [topicTitle, category, difficulty, systemGroup, goal] of instructionTopics) {
    for (const vehicle of vehicleProfiles) {
      for (const scenario of instructionScenarios) {
        const title = `${topicTitle} - ${vehicle.label} - ${scenario.label}`;
        const sourceQuery = `${vehicle.label} ${topicTitle} ${systemGroup} ${scenario.label} ${scenario.searchTerms.join(" ")}`;

        rows.push({
          slug: slugify(`seed-${title}`),
          source_query: sourceQuery,
          source_type: "manual",
          title,
          subtitle: `${goal}. Fokus: ${scenario.focus}. Wiederverwendbare DiagnoseHUB-Anleitung ohne erfundene Herstellerwerte.`,
          category,
          difficulty,
          estimated_time: "Fahrzeugabhängig",
          vehicle_applicability:
            "Allgemeiner Ablauf. Exakte Werte, Zugang, Teile und Spezialwerkzeug nach VIN, Motorcode/Systemvariante und Herstellerdaten festlegen.",
          tags: unique([
            topicTitle,
            systemGroup,
            category,
            ...vehicle.terms,
            ...scenario.searchTerms,
          ]),
          diagnosis_goal: `${goal}. Fokus: ${scenario.focus}.`,
          missing_vehicle_data: [
            "Hersteller, Modell, Baujahr, Motorcode und Systemvariante angeben.",
            "VIN oder HSN/TSN ergänzen, wenn Werte, Teile oder Spezialwerkzeug eindeutig bestimmt werden sollen.",
            "Fehlercode, Istwerte, Randbedingungen und bereits geprüfte Punkte ergänzen.",
          ],
          required_skill:
            difficulty === "schwer" ? "Werkstatt/Profi, je nach System." : "Hobby eingeschränkt bis Werkstatt, je nach Zugang und Risiko.",
          escalation_criteria: [
            "Bei Bremse, Lenkung, Airbag, Hochvolt, Kraftstoff, Steuerzeiten oder Kältemittelkreis ohne Qualifikation abbrechen.",
            "Wenn Herstellerdaten oder Spezialwerkzeug fehlen, nicht weiter zerlegen.",
          ],
          symptoms: [
            "Kundenbeanstandung passend zum Thema bestätigen.",
            "Fehler tritt dauerhaft oder sporadisch auf.",
            `Fokus dieses Ablaufs: ${scenario.focus}.`,
            "Istwerte oder Sichtbefund weichen plausibel ab.",
          ],
          tools: [
            "Pflicht: geeignetes Grundwerkzeug und gute Beleuchtung",
            "Diagnose: Diagnosetester mit passenden Steuergeräten",
            "Messung: Multimeter, Druck-/Unterdruckprüfung oder Sichtprüfmittel je nach Fall",
            "Spezial: fahrzeugabhängiges Spezialwerkzeug nach Herstellerdaten",
            "Arbeitsplatz: Hebebühne oder sichere Abstützung nur wenn nötig",
          ],
          parts_and_materials: [
            "Bereitlegen: Reinigungsmaterial und Dokumentation",
            "Nur bei Befund: defektes Bauteil erst nach Prüfbeweis ersetzen",
            "Einmalteil: Schrauben, Muttern, Clips oder Dichtungen nach Herstellerdaten",
            "Betriebsstoff: nur passend zum bestätigten Arbeitsumfang",
          ],
          safety_notes: [
            "Exakte Herstellerwerte nicht schätzen.",
            "Sicherheitsrelevante Systeme nur mit passender Qualifikation bearbeiten.",
          ],
          initial_checks: [
            "Fahrzeugdaten und Systemvariante prüfen.",
            "Fehlerspeicher, Freeze-Frame und Istwerte sichern.",
            `Fokus festlegen: ${scenario.focus}.`,
            "Sichtprüfung vor Messung und Teiletausch durchführen.",
          ],
          measurement_plan: [
            "Messwerte nur unter definiertem Betriebszustand bewerten.",
            "Sollwerte nur aus Herstellerdaten oder geprüfter Datenquelle übernehmen.",
            "Abweichung vor Teiletausch durch zweite Prüfung bestätigen.",
          ],
          steps: buildInstructionSteps(topicTitle, systemGroup, scenario),
          common_causes: [
            "[hoch] Ursache: einfacher Sicht-/Stecker-/Dichtheitsbefund | Typischer Fehler: direktes Ersetzen | Prüfbeweis: Befund dokumentieren.",
            "[mittel] Ursache: Sensorik oder Ansteuerung unplausibel | Typischer Fehler: Istwerte ohne Betriebszustand bewerten | Prüfbeweis: Messung wiederholen.",
            "[niedrig] Ursache: fahrzeugspezifische Variante | Typischer Fehler: falsche Anleitung anwenden | Prüfbeweis: VIN/Motorcode abgleichen.",
          ],
          next_actions: [
            "Befund sichern und Reparaturumfang festlegen.",
            "Herstellerdaten für Werte, Spezialwerkzeug und Einmalteile prüfen.",
            "Nach Abschluss Funktionstest, Fehlerspeicher und Probefahrt durchführen.",
          ],
          final_checks: [
            "Fehlerspeicher löschen und erneut auslesen.",
            "Live-Daten oder Funktion unter gleichen Bedingungen prüfen.",
            "Dichtheit, Geräusch, Befestigung und Kundenbeanstandung kontrollieren.",
          ],
          pro_hint:
            "Diese Seed-Anleitung spart den Grundaufbau. Präzise Werte und fahrzeugspezifische Demontage bleiben an VIN, Motorcode und Herstellerdaten gebunden.",
          last_updated: TODAY,
        });
      }
    }
  }

  return rows.slice(0, INSTRUCTION_TARGET);
}

async function upsertInBatches(supabase, table, rows, conflictColumn) {
  const batchSize = 100;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { error } = await supabase.from(table).upsert(batch, {
      onConflict: conflictColumn,
    });

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
  }
}

async function main() {
  const diagnosisRows = buildDiagnosisRows();
  const instructionRows = buildInstructionRows();

  if (
    diagnosisRows.length !== DIAGNOSIS_TARGET ||
    instructionRows.length !== INSTRUCTION_TARGET
  ) {
    throw new Error(
      `Seed-Zahl stimmt nicht: ${diagnosisRows.length}/${DIAGNOSIS_TARGET} Diagnosen, ${instructionRows.length}/${INSTRUCTION_TARGET} Anleitungen.`
    );
  }

  if (DRY_RUN) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          requestedTotal: TARGET_TOTAL,
          skipDiagnoses: SKIP_DIAGNOSES,
          skipInstructions: SKIP_INSTRUCTIONS,
          diagnosisRows: diagnosisRows.length,
          instructionRows: instructionRows.length,
          total: diagnosisRows.length + instructionRows.length,
          firstDiagnosis: diagnosisRows[0]?.title,
          firstInstruction: instructionRows[0]?.title,
        },
        null,
        2
      )
    );
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt. .env.local prüfen."
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  if (!SKIP_DIAGNOSES) {
    await upsertInBatches(supabase, "diagnosis_library", diagnosisRows, "slug");
  }

  if (!SKIP_INSTRUCTIONS) {
    await upsertInBatches(supabase, "instruction_guides", instructionRows, "slug");
  }

  console.log(
    JSON.stringify(
      {
        saved: true,
        requestedTotal: TARGET_TOTAL,
        skippedDiagnoses: SKIP_DIAGNOSES,
        skippedInstructions: SKIP_INSTRUCTIONS,
        diagnosisRows: diagnosisRows.length,
        instructionRows: instructionRows.length,
        total: diagnosisRows.length + instructionRows.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
