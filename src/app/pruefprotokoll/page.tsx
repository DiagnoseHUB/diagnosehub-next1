"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type EngineContext = {
  engineType: string;
  source: string;
  label: string;
  code: string | null;
  notes?: string;
};

type FaultCodeInfo = {
  code: string;
  title: string;
  system: string;
  description: string;
  typicalCauses: string[];
  suggestedChecks: string[];
};

type FaultCodeContext = {
  foundCodes: FaultCodeInfo[];
  summary: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type CurrentDiagnosisCase = {
  messages: ChatMessage[];
  engineContext: EngineContext | null;
  faultCodeContext: FaultCodeContext | null;
  qualityCheck: string;
  openedCaseId?: string | null;
};

type UserPlan = "free" | "werkstatt" | "pro";

type DemoAccount = {
  name: string;
  workshop: string;
  email: string;
  role: string;
  plan: UserPlan;
  updatedAt: string;
};

type ProtocolProfile = {
  title: string;
  subtitle: string;
  focus: string;
  measurementRows: string[];
  visualChecks: string[];
  diagnosticChecks: string[];
  specialHints: string[];
};

const CURRENT_CASE_STORAGE_KEY = "diagnosehub-current-case";
const USER_PLAN_STORAGE_KEY = "diagnosehub-user-plan";
const DEMO_ACCOUNT_STORAGE_KEY = "diagnosehub-demo-account";

const planLabels: Record<UserPlan, string> = {
  free: "Free",
  werkstatt: "Werkstatt Demo",
  pro: "Werkstatt Pro Demo",
};

const baseMeasurementRows = [
  "Batteriespannung Motor aus",
  "Batteriespannung beim Starten",
  "Kühlmitteltemperatur plausibel",
  "Ansauglufttemperatur plausibel",
  "Spannungsversorgung Sensorik",
  "Masseverbindung Steuergerät / Motor",
];

const baseVisualChecks = [
  "Stecker und Kabelbaum auf Beschädigung geprüft",
  "Massepunkte und Spannungsversorgung geprüft",
  "Sicherungen und Relais geprüft",
  "Steuergerät auf Wassereintritt / Korrosion geprüft",
  "Motorraum auf Marder-/Scheuerstellen geprüft",
];

const baseDiagnosticChecks = [
  "Fehlerspeicher komplett ausgelesen",
  "Freeze-Frame / Umgebungsbedingungen dokumentiert",
  "Fehler gelöscht und Reproduzierbarkeit geprüft",
  "Live-Daten im Leerlauf geprüft",
  "Live-Daten unter Last / Probefahrt geprüft",
  "Sensorwerte auf Plausibilität geprüft",
  "Bauteil mechanisch geprüft",
  "Verkabelung nach Schaltplan geprüft",
  "Nach Reparatur Probefahrt durchgeführt",
];

const defaultProfile: ProtocolProfile = {
  title: "Standard-Diagnoseprotokoll",
  subtitle: "Allgemeiner Prüfplan für Free-Nutzer oder unbekannte Fehler",
  focus:
    "Allgemeine Eingrenzung über Fehlerspeicher, Spannungsversorgung, Sichtprüfung, Live-Daten und Probefahrt.",
  measurementRows: [
    "Relevanter Sensor Soll / Ist",
    "Relevanter Aktor Ansteuerung",
    "Betriebszustand bei Fehlerauftritt",
    "Temperaturwerte Motor / Umgebung",
    "Lastsignal / Gaspedalwert",
    "Drehzahl beim Fehlerauftritt",
  ],
  visualChecks: [
    "Bauteilumfeld auf Undichtigkeiten geprüft",
    "Steckverbindungen mehrfach gesteckt und verriegelt",
    "Kabelbaum unter Last / Bewegung geprüft",
  ],
  diagnosticChecks: [
    "Fehlerbild reproduziert",
    "Messwerte vor und nach Fehlerauftritt verglichen",
    "Technische Serviceinformationen / bekannte Probleme geprüft",
  ],
  specialHints: [
    "Im Free-Plan wird ein allgemeines Standardprotokoll erstellt. Fehlercode-spezifische Prüfprofile sind für Werkstatt/Premium vorbereitet.",
  ],
};

const protocolProfiles: Record<string, ProtocolProfile> = {
  boostPressure: {
    title: "Ladedruck / Aufladung",
    subtitle: "Premium-Prüfprotokoll für P0299, P0234 und Ladedruckabweichungen",
    focus:
      "Fokus auf Ladedruck Soll/Ist, Ladeluftstrecke, VTG/Wastegate, Unterdruck-/Druckansteuerung, Sensorik und Abgasgegendruck.",
    measurementRows: [
      "Ladedruck Sollwert",
      "Ladedruck Istwert",
      "Ladedruckabweichung unter Last",
      "Atmosphärendruck / Umgebungsdruck",
      "Ladedrucksensor Signalspannung",
      "Luftmasse Soll / Ist",
      "Ansteuerung Ladedruckregelventil / Druckwandler",
      "Unterdruckversorgung",
      "VTG-/Wastegate-Stellweg",
      "DPF Differenzdruck als Folgeursache",
      "Abgasgegendruck",
      "Ansauglufttemperatur unter Last",
    ],
    visualChecks: [
      "Ladeluftstrecke abgedrückt",
      "Ladeluftschläuche auf Risse / Ölspuren geprüft",
      "Ladeluftkühler auf Undichtigkeit geprüft",
      "Schellen und Steckverbindungen der Ladeluftstrecke geprüft",
      "Unterdruckleitungen geprüft",
      "Druckwandler / Ladedruckregelventil geprüft",
      "VTG-/Wastegate-Gestänge auf Spiel / Klemmen geprüft",
      "Abgasseite Turbolader auf Undichtigkeit geprüft",
    ],
    diagnosticChecks: [
      "Ladedruck Soll/Ist unter Last geloggt",
      "Ladedruckaufbau bei Beschleunigung geprüft",
      "VTG/Wastegate per Stellgliedtest geprüft",
      "Unterdruck mit Handpumpe geprüft",
      "Druckwandler elektrisch und pneumatisch geprüft",
      "Ladedrucksensor gegen Umgebungsdruck plausibilisiert",
      "LMM-Wert unter Last plausibilisiert",
      "DPF-Differenzdruck als Ursache für Ladedruckproblem geprüft",
    ],
    specialHints: [
      "Bei P0299 zuerst Ladeluftstrecke abdrücken, dann Unterdruck-/VTG-/Wastegate-Ansteuerung prüfen.",
      "Bei P0234 besonders auf klemmende VTG, nicht öffnendes Wastegate oder falsche Ansteuerung achten.",
      "Ladedruckfehler nie nur nach Fehlerspeicher beurteilen. Entscheidend ist Soll/Ist unter Last.",
    ],
  },

  fuelPressure: {
    title: "Kraftstoffdruck / Raildruck",
    subtitle: "Premium-Prüfprotokoll für P0087, P0088 und Kraftstoffdruckabweichungen",
    focus:
      "Fokus auf Raildruck Soll/Ist, Niederdruckversorgung, Filter, Mengenregelventil, Druckregelventil, Injektor-Rücklaufmenge und Hochdruckpumpe.",
    measurementRows: [
      "Raildruck Sollwert beim Starten",
      "Raildruck Istwert beim Starten",
      "Raildruck Sollwert unter Last",
      "Raildruck Istwert unter Last",
      "Niederdruck Kraftstoff vor Hochdruckpumpe",
      "Kraftstofffilter Differenz / Zustand",
      "Tankpumpenförderdruck",
      "Ansteuerung Vorförderpumpe",
      "Mengenregelventil Ansteuerung",
      "Druckregelventil Ansteuerung",
      "Injektor-Rücklaufmenge je Zylinder",
      "Kraftstofftemperatur",
    ],
    visualChecks: [
      "Kraftstofffilter geprüft / Alter dokumentiert",
      "Kraftstoffleitungen auf Luftblasen geprüft",
      "Kraftstoffsystem auf Undichtigkeiten geprüft",
      "Stecker Hochdruckpumpe / Regelventile geprüft",
      "Tankentlüftung / Tankversorgung geprüft",
      "Rücklaufleitung auf Blockade geprüft",
      "Kraftstoffqualität geprüft",
    ],
    diagnosticChecks: [
      "Raildruck beim Startvorgang geloggt",
      "Raildruck unter Last geloggt",
      "Niederdruckversorgung gemessen",
      "Injektor-Rücklaufmengentest durchgeführt",
      "Mengenregelventil geprüft",
      "Druckregelventil geprüft",
      "Hochdruckpumpe mechanisch beurteilt",
      "Kraftstofffilter als Ursache ausgeschlossen",
    ],
    specialHints: [
      "Bei P0087 niemals direkt die Hochdruckpumpe ersetzen. Erst Filter, Niederdruckversorgung, Luft im System und Rücklaufmenge prüfen.",
      "Bei Startproblemen ist der Raildruck während des Anlassens entscheidend.",
      "Bei P0088 Rücklauf, Regelventile und Raildrucksensor-Plausibilität prüfen.",
    ],
  },

  egr: {
    title: "AGR / Abgasrückführung",
    subtitle: "Premium-Prüfprotokoll für P0401, P0402 und AGR-Durchsatzfehler",
    focus:
      "Fokus auf AGR Soll/Ist, Luftmassenänderung, Stellgliedtest, Verkokung, AGR-Kühler und Abgasgegendruck.",
    measurementRows: [
      "AGR Sollwert",
      "AGR Istwert",
      "AGR Stellposition",
      "Luftmasse AGR geschlossen",
      "Luftmasse AGR geöffnet",
      "LMM-Reaktion bei AGR-Ansteuerung",
      "Saugrohrdruck bei AGR-Ansteuerung",
      "Abgastemperatur",
      "DPF Differenzdruck",
      "Abgasgegendruck",
    ],
    visualChecks: [
      "AGR-Ventil auf Verkokung geprüft",
      "AGR-Kühler / AGR-Strecke auf Verstopfung geprüft",
      "Ansaugbrücke auf Verkokung geprüft",
      "Unterdruck- oder elektrische AGR-Ansteuerung geprüft",
      "AGR-Dichtungen auf Undichtigkeit geprüft",
      "LMM-Stecker / Kabel geprüft",
    ],
    diagnosticChecks: [
      "AGR-Stellgliedtest durchgeführt",
      "LMM-Veränderung bei AGR-Ansteuerung geprüft",
      "AGR Soll/Ist im Leerlauf geprüft",
      "AGR Soll/Ist bei Teillast geprüft",
      "AGR mechanisch auf Klemmen geprüft",
      "Abgasgegendruck / DPF-Differenzdruck geprüft",
      "Ansaugstrecke auf Verkokung beurteilt",
    ],
    specialHints: [
      "Bei P0401 ist oft zu wenig Durchsatz vorhanden: AGR-Strecke verkokt, Ventil klemmt oder Abgasgegendruck unplausibel.",
      "Bei P0402 kann das AGR offen hängen oder die Luftmasse unplausibel sein.",
      "AGR-Diagnose immer mit LMM-Reaktion vergleichen, nicht nur Stellgliedposition anschauen.",
    ],
  },

  dpf: {
    title: "DPF / Dieselpartikelfilter",
    subtitle: "Premium-Prüfprotokoll für P2002, P2453 und DPF-Differenzdruckfehler",
    focus:
      "Fokus auf Differenzdruck, Rußmasse, Aschemasse, Differenzdrucksensor, Schläuche, Temperaturen und Regenerationsfähigkeit.",
    measurementRows: [
      "DPF Differenzdruck Motor aus",
      "DPF Differenzdruck Leerlauf",
      "DPF Differenzdruck bei 2500 1/min",
      "DPF Differenzdruck unter Last",
      "Rußmasse berechnet",
      "Rußmasse gemessen",
      "Aschemasse",
      "Abgastemperatur vor DPF",
      "Abgastemperatur nach DPF",
      "Regenerationsstatus",
      "Kilometer seit letzter Regeneration",
      "Ölasche / Beladungswert",
    ],
    visualChecks: [
      "Differenzdruckschläuche auf Risse geprüft",
      "Differenzdruckschläuche auf Verstopfung geprüft",
      "Schläuche auf Vertauschung geprüft",
      "Differenzdrucksensor Steckverbindung geprüft",
      "Abgasanlage vor DPF auf Undichtigkeit geprüft",
      "Temperatursensoren Steckverbindungen geprüft",
    ],
    diagnosticChecks: [
      "Differenzdruck bei Motor aus auf Nullpunkt geprüft",
      "Differenzdruck im Leerlauf bewertet",
      "Differenzdruck unter Last bewertet",
      "Rußmasse und Aschemasse dokumentiert",
      "Regenerationshistorie geprüft",
      "Temperatursensoren plausibilisiert",
      "Ursache für erhöhte Rußbildung geprüft",
      "AGR-/Ladedruck-/Injektorproblem als Folgeschaden geprüft",
    ],
    specialHints: [
      "Bei P2453 zuerst Nullpunkt des Differenzdrucksensors bei Motor aus prüfen.",
      "Bei P2002 nicht nur DPF ersetzen. Ursache für Rußbildung prüfen: AGR, Ladedruck, Injektoren, Luftmasse.",
      "Zwangsregeneration nur durchführen, wenn Ölstand, Temperaturen, Differenzdruck und Sicherheitsbedingungen passen.",
    ],
  },

  mixture: {
    title: "Gemischbildung / Benziner",
    subtitle: "Premium-Prüfprotokoll für P0171, P0172 und Gemischadaption",
    focus:
      "Fokus auf Fuel Trims, Falschluft, Kurbelgehäuseentlüftung, Kraftstoffdruck, Lambdaregelung, LMM und Tankentlüftung.",
    measurementRows: [
      "Short Term Fuel Trim Bank 1",
      "Long Term Fuel Trim Bank 1",
      "Lambdasonde vor Kat Spannung / Lambda",
      "Lambdasonde nach Kat Plausibilität",
      "Luftmasse Leerlauf",
      "Luftmasse unter Last",
      "Saugrohrdruck Leerlauf",
      "Kraftstoffdruck",
      "Tankentlüftungsventil Ansteuerung",
      "Leerlaufregelung / Drosselklappenwinkel",
      "Kühlmitteltemperatur",
      "Ansauglufttemperatur",
    ],
    visualChecks: [
      "Ansaugsystem abgenebelt",
      "Kurbelgehäuseentlüftung geprüft",
      "Unterdruckschläuche geprüft",
      "Drosselklappe / Ansaugtrakt auf Undichtigkeit geprüft",
      "Abgasanlage vor Lambdasonde auf Undichtigkeit geprüft",
      "LMM-Stecker / Kabel geprüft",
      "Tankentlüftungsventil auf Offen-Hängen geprüft",
    ],
    diagnosticChecks: [
      "Fuel Trims im Leerlauf geprüft",
      "Fuel Trims bei erhöhter Drehzahl geprüft",
      "Fuel Trims unter Last geprüft",
      "Falschlufttest / Nebeltest durchgeführt",
      "Kraftstoffdruck geprüft",
      "Lambdasondenwerte plausibilisiert",
      "LMM-Werte plausibilisiert",
      "Tankentlüftung geprüft",
    ],
    specialHints: [
      "Bei P0171 zuerst Falschluft, PCV/KGE, LMM und Kraftstoffdruck prüfen.",
      "Bei P0172 auf zu hohen Kraftstoffdruck, tropfende Injektoren, LMM und Tankentlüftung achten.",
      "Fuel Trims im Leerlauf und bei erhöhter Drehzahl vergleichen: So lässt sich Falschluft oft gut eingrenzen.",
    ],
  },

  misfire: {
    title: "Verbrennungsaussetzer / Laufunruhe",
    subtitle: "Premium-Prüfprotokoll für P0300, P0301, P0302, P0303, P0304",
    focus:
      "Fokus auf Aussetzerzähler, zylinderbezogene Eingrenzung, Zündung beim Benziner, Injektoren/Raildruck beim Diesel, Kompression und mechanische Ursachen.",
    measurementRows: [
      "Aussetzerzähler Zylinder 1",
      "Aussetzerzähler Zylinder 2",
      "Aussetzerzähler Zylinder 3",
      "Aussetzerzähler Zylinder 4",
      "Leerlaufunruhe / Laufruhewerte",
      "Injektor-Korrekturwerte",
      "Raildruck Soll / Ist",
      "Kraftstoffdruck Benziner",
      "Zündwinkel / Klopfregelung",
      "Kompression Zylinder 1",
      "Kompression Zylinder 2",
      "Kompression Zylinder 3",
      "Kompression Zylinder 4",
      "Druckverlustprüfung",
    ],
    visualChecks: [
      "Zündkerzenbild geprüft bei Benziner",
      "Zündspulen / Stecker geprüft bei Benziner",
      "Injektor-Stecker / Kabel geprüft",
      "Ansaugsystem auf Falschluft geprüft",
      "Motor mechanisch auf Nebenluft / Undichtigkeiten geprüft",
      "Kraftstoffqualität geprüft",
    ],
    diagnosticChecks: [
      "Aussetzerzähler je Zylinder dokumentiert",
      "Fehler wandert nach Quertausch geprüft",
      "Benziner: Zündspule/Zündkerze quer getauscht",
      "Diesel: Injektor-Korrekturwerte geprüft",
      "Diesel: Injektor-Rücklaufmenge geprüft",
      "Kompression geprüft",
      "Druckverlustprüfung durchgeführt",
      "Injektor-Ansteuerung geprüft",
      "Falschluft ausgeschlossen",
    ],
    specialHints: [
      "Beim Diesel keine Zündkerzen/Zündspulen als Ursache prüfen. Dort Fokus auf Injektoren, Raildruck, Kompression und Mechanik.",
      "Beim Benziner zuerst Aussetzerzähler, Zündkerze/Zündspule, Falschluft und Kraftstoffdruck eingrenzen.",
      "Zylinderbezogene Fehler immer mit Quertausch oder Messung bestätigen, bevor Teile ersetzt werden.",
    ],
  },

  airMass: {
    title: "Luftmasse / Ansaugsystem",
    subtitle: "Premium-Prüfprotokoll für P0101 und unplausible Luftmassenwerte",
    focus:
      "Fokus auf LMM-Wert, Ansaugluft, Falschluft, AGR-Einfluss, Ladedruck, Luftfilter und Verkabelung.",
    measurementRows: [
      "Luftmasse Leerlauf",
      "Luftmasse bei 2500 1/min",
      "Luftmasse unter Last",
      "Saugrohrdruck",
      "Ladedruck Soll / Ist",
      "AGR Soll / Ist",
      "Ansauglufttemperatur",
      "LMM Signalspannung",
      "Luftfilter Differenz / Zustand",
    ],
    visualChecks: [
      "Luftfilter geprüft",
      "Ansaugweg vor LMM geprüft",
      "Ansaugweg nach LMM auf Falschluft geprüft",
      "LMM-Stecker / Kabel geprüft",
      "AGR-Strecke auf Einfluss geprüft",
      "Ladeluftstrecke geprüft",
    ],
    diagnosticChecks: [
      "LMM-Wert im Leerlauf plausibilisiert",
      "LMM-Wert unter Last plausibilisiert",
      "Falschlufttest durchgeführt",
      "AGR-Ansteuerung und LMM-Reaktion geprüft",
      "Ladedruckabweichung als Ursache geprüft",
      "Sensorversorgung geprüft",
    ],
    specialHints: [
      "P0101 kann durch LMM, Falschluft, AGR, Ladedruckleck oder Luftfilter verursacht werden.",
      "LMM niemals isoliert beurteilen. Immer zusammen mit AGR, Ladedruck und Ansaugsystem betrachten.",
    ],
  },
};

function isValidUserPlan(value: string | null): value is UserPlan {
  return value === "free" || value === "werkstatt" || value === "pro";
}

function hasPremiumAccess(userPlan: UserPlan) {
  return userPlan === "werkstatt" || userPlan === "pro";
}

function getProtocolProfile(currentCase: CurrentDiagnosisCase | null) {
  const firstFaultCode = currentCase?.faultCodeContext?.foundCodes?.[0];
  const code = firstFaultCode?.code?.toUpperCase() ?? "";
  const system = firstFaultCode?.system?.toLowerCase() ?? "";

  if (
    code === "P0299" ||
    code === "P0234" ||
    system.includes("ladedruck") ||
    system.includes("aufladung")
  ) {
    return protocolProfiles.boostPressure;
  }

  if (
    code === "P0087" ||
    code === "P0088" ||
    system.includes("kraftstoffdruck") ||
    system.includes("raildruck")
  ) {
    return protocolProfiles.fuelPressure;
  }

  if (
    code === "P0401" ||
    code === "P0402" ||
    system.includes("agr") ||
    system.includes("abgasrückführung") ||
    system.includes("abgasrueckfuehrung")
  ) {
    return protocolProfiles.egr;
  }

  if (
    code === "P2002" ||
    code === "P2453" ||
    system.includes("dieselpartikelfilter") ||
    system.includes("dpf")
  ) {
    return protocolProfiles.dpf;
  }

  if (code === "P0171" || code === "P0172" || system.includes("gemisch")) {
    return protocolProfiles.mixture;
  }

  if (
    code === "P0300" ||
    code === "P0301" ||
    code === "P0302" ||
    code === "P0303" ||
    code === "P0304" ||
    system.includes("verbrennung") ||
    system.includes("laufunruhe")
  ) {
    return protocolProfiles.misfire;
  }

  if (
    code === "P0101" ||
    system.includes("luftmasse") ||
    system.includes("ansaugsystem")
  ) {
    return protocolProfiles.airMass;
  }

  return defaultProfile;
}

function uniqueList(items: string[]) {
  return Array.from(new Set(items));
}

function getFirstUserMessage(messages: ChatMessage[]) {
  return messages.find((message) => message.role === "user")?.content ?? "";
}

function getLastAssistantMessage(messages: ChatMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.content;
}

function getFaultCodes(faultCodeContext: FaultCodeContext | null) {
  if (!faultCodeContext || faultCodeContext.foundCodes.length === 0) {
    return "";
  }

  return faultCodeContext.foundCodes
    .map((faultCode) => faultCode.code)
    .join(", ");
}

function getFaultCodeSummary(faultCodeContext: FaultCodeContext | null) {
  if (!faultCodeContext || faultCodeContext.foundCodes.length === 0) {
    return "Keine bekannten Fehlercodes aus DiagnoseHUB erkannt.";
  }

  return faultCodeContext.foundCodes
    .map((faultCode) => {
      return `${faultCode.code} - ${faultCode.title} (${faultCode.system})`;
    })
    .join("\n");
}

function getFaultCodeCauses(faultCodeContext: FaultCodeContext | null) {
  if (!faultCodeContext || faultCodeContext.foundCodes.length === 0) {
    return [];
  }

  return uniqueList(
    faultCodeContext.foundCodes.flatMap((faultCode) => faultCode.typicalCauses)
  );
}

function getFaultCodeChecks(faultCodeContext: FaultCodeContext | null) {
  if (!faultCodeContext || faultCodeContext.foundCodes.length === 0) {
    return [];
  }

  return uniqueList(
    faultCodeContext.foundCodes.flatMap((faultCode) => faultCode.suggestedChecks)
  );
}

function shortenText(text: string | undefined, maxLength: number) {
  if (!text) {
    return "";
  }

  const cleanText = text.replace(/\s+/g, " ").trim();

  if (cleanText.length <= maxLength) {
    return cleanText;
  }

  return `${cleanText.slice(0, maxLength)}...`;
}

function LineField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex min-h-10 items-end gap-3 border-b border-slate-400 pb-1">
      <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-600">
        {label}
      </span>

      <span className="min-h-5 flex-1 text-sm font-semibold text-slate-950">
        {value || ""}
      </span>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  lines = 4,
}: {
  label: string;
  value?: string;
  lines?: number;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
        {label}
      </p>

      <div
        className="rounded-xl border border-slate-400 p-3 text-sm leading-6 text-slate-950"
        style={{ minHeight: `${lines * 28}px` }}
      >
        {value || ""}
      </div>
    </div>
  );
}

function CheckItem({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-slate-600" />
      <p className="text-sm leading-6 text-slate-950">{label}</p>
    </div>
  );
}

function ProtocolSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="print-break-avoid border-t-2 border-slate-950 pt-5">
      <h2 className="mb-4 text-xl font-black uppercase tracking-tight text-slate-950">
        {title}
      </h2>

      {children}
    </section>
  );
}

export default function PruefprotokollPage() {
  const [currentCase, setCurrentCase] = useState<CurrentDiagnosisCase | null>(
    null
  );
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [demoAccount, setDemoAccount] = useState<DemoAccount | null>(null);
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString("de-DE"));

    try {
      const savedCase = localStorage.getItem(CURRENT_CASE_STORAGE_KEY);
      const savedPlan = localStorage.getItem(USER_PLAN_STORAGE_KEY);
      const savedAccount = localStorage.getItem(DEMO_ACCOUNT_STORAGE_KEY);

      if (savedCase) {
        const parsedCase = JSON.parse(savedCase);
        setCurrentCase(parsedCase);
      }

      if (isValidUserPlan(savedPlan)) {
        setUserPlan(savedPlan);
      }

      if (savedAccount) {
        const parsedAccount = JSON.parse(savedAccount) as DemoAccount;
        setDemoAccount(parsedAccount);

        if (isValidUserPlan(parsedAccount.plan)) {
          setUserPlan(parsedAccount.plan);
        }
      }
    } catch (error) {
      console.error("Diagnosefall konnte nicht geladen werden:", error);
    }
  }, []);

  const firstUserMessage = useMemo(() => {
    return getFirstUserMessage(currentCase?.messages ?? []);
  }, [currentCase]);

  const lastAssistantMessage = useMemo(() => {
    return getLastAssistantMessage(currentCase?.messages ?? []);
  }, [currentCase]);

  const premiumAccess = hasPremiumAccess(userPlan);

  const detectedProtocolProfile = useMemo(() => {
    return getProtocolProfile(currentCase);
  }, [currentCase]);

  const protocolProfile = useMemo(() => {
    if (!premiumAccess) {
      return defaultProfile;
    }

    return detectedProtocolProfile;
  }, [detectedProtocolProfile, premiumAccess]);

  const measurementRows = useMemo(() => {
    return uniqueList([
      ...baseMeasurementRows,
      ...protocolProfile.measurementRows,
    ]);
  }, [protocolProfile]);

  const visualChecks = useMemo(() => {
    return uniqueList([...baseVisualChecks, ...protocolProfile.visualChecks]);
  }, [protocolProfile]);

  const diagnosticChecks = useMemo(() => {
    return uniqueList([
      ...baseDiagnosticChecks,
      ...protocolProfile.diagnosticChecks,
    ]);
  }, [protocolProfile]);

  const faultCodes = getFaultCodes(currentCase?.faultCodeContext ?? null);
  const faultCodeSummary = getFaultCodeSummary(
    currentCase?.faultCodeContext ?? null
  );
  const faultCodeCauses = getFaultCodeCauses(
    currentCase?.faultCodeContext ?? null
  );
  const faultCodeChecks = getFaultCodeChecks(
    currentCase?.faultCodeContext ?? null
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white print:bg-white">
      <style>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            background: white !important;
          }

          .print-break-avoid {
            break-inside: avoid;
          }

          .print-new-page {
            break-before: page;
          }
        }
      `}</style>

      <div className="print:hidden">
        <Header />
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 print:hidden md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
              DiagnoseHUB Prüfprotokoll
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              {premiumAccess
                ? "Individuelles Premium-Prüfprotokoll"
                : "Standard-Prüfprotokoll"}
            </h1>

            <p className="mt-2 text-slate-400">
              Aktueller Plan:{" "}
              <span className="font-bold text-white">{planLabels[userPlan]}</span>
              {premiumAccess
                ? " · Fehlercode-spezifische Prüfprofile aktiv."
                : " · Fehlercode-spezifische Prüfprofile sind Premium vorbereitet."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/#diagnose"
              className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Zurück zur Diagnose
            </a>

            <button
              onClick={() => window.print()}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              Drucken / PDF speichern
            </button>
          </div>
        </div>

        {!premiumAccess && (
          <div className="mb-8 rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-6 print:hidden">
            <p className="font-bold text-yellow-300">
              Free-Plan: Standardprotokoll aktiv
            </p>

            <p className="mt-2 leading-7 text-slate-300">
              Der aktuelle Diagnosefall wurde erkannt, aber das automatisch
              angepasste Prüfprofil „{detectedProtocolProfile.title}“ ist als
              Premium-Funktion vorbereitet. Im Werkstatt Demo oder Pro Demo Plan
              wird das Protokoll direkt fehlerbezogen aufgebaut.
            </p>

            <a
              href="/#premium"
              className="mt-4 inline-flex rounded-xl border border-yellow-500/40 px-5 py-3 font-semibold text-yellow-300 transition hover:bg-yellow-500 hover:text-slate-950"
            >
              Premium-Funktionen ansehen
            </a>
          </div>
        )}

        <article className="mx-auto w-full max-w-[210mm] bg-white p-10 text-slate-950 shadow-2xl shadow-blue-950/40 print:max-w-none print:p-0 print:shadow-none">
          <header className="mb-8 border-b-4 border-slate-950 pb-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-slate-950 p-2">
                    <Image
                      src="/diagnosehub-logo.png"
                      alt="DiagnoseHUB Logo"
                      width={64}
                      height={64}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-700">
                      DiagnoseHUB
                    </p>

                    <h1 className="mt-1 text-4xl font-black tracking-tight text-slate-950">
                      Prüfprotokoll Fahrzeugdiagnose
                    </h1>
                  </div>
                </div>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-700">
                  Zum Eintragen von Messwerten, Sichtprüfungen, Checklisten und
                  Diagnoseergebnis. Dieses Protokoll unterstützt die
                  Werkstattdiagnose und ersetzt keine fachgerechte Prüfung am
                  Fahrzeug.
                </p>
              </div>

              <div className="min-w-56 rounded-xl border-2 border-slate-950 p-4">
                <p className="text-xs font-bold uppercase text-slate-600">
                  Erstellt am
                </p>
                <p className="mt-1 text-sm font-bold">{generatedAt}</p>

                <p className="mt-4 text-xs font-bold uppercase text-slate-600">
                  Plan
                </p>
                <p className="mt-1 text-sm font-bold">{planLabels[userPlan]}</p>

                <p className="mt-4 text-xs font-bold uppercase text-slate-600">
                  Profil
                </p>
                <p className="mt-1 text-sm font-bold">{protocolProfile.title}</p>
              </div>
            </div>
          </header>

          <div className="space-y-8">
            <ProtocolSection title="1. Werkstattdaten">
              <div className="grid gap-4 md:grid-cols-2">
                <LineField
                  label="Werkstatt"
                  value={demoAccount?.workshop || ""}
                />
                <LineField
                  label="Bearbeiter"
                  value={demoAccount?.name || ""}
                />
                <LineField label="E-Mail" value={demoAccount?.email || ""} />
                <LineField label="Rolle" value={demoAccount?.role || ""} />
              </div>
            </ProtocolSection>

            <ProtocolSection title="2. Fahrzeugdaten">
              <div className="grid gap-4 md:grid-cols-2">
                <LineField label="Hersteller" />
                <LineField label="Modell" />
                <LineField label="Kennzeichen" />
                <LineField label="FIN" />
                <LineField label="Kilometerstand" />
                <LineField label="Baujahr" />
                <LineField
                  label="Motortyp"
                  value={currentCase?.engineContext?.engineType}
                />
                <LineField
                  label="Motorcode"
                  value={currentCase?.engineContext?.code}
                />
                <LineField
                  label="Motor"
                  value={currentCase?.engineContext?.label}
                />
                <LineField label="Fehlercode" value={faultCodes} />
              </div>
            </ProtocolSection>

            <ProtocolSection title="3. Prüfprofil">
              <div className="rounded-xl border-2 border-slate-950 bg-slate-100 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  {premiumAccess
                    ? "Automatisch erkanntes Premium-Profil"
                    : "Standardprofil im Free-Plan"}
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  {protocolProfile.title}
                </h2>

                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {protocolProfile.subtitle}
                </p>

                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {protocolProfile.focus}
                </p>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <TextAreaField
                  label="Erkannter Fehlercode-Kontext"
                  value={faultCodeSummary}
                  lines={4}
                />

                <TextAreaField
                  label="Ausgangsfall aus DiagnoseHUB"
                  value={firstUserMessage}
                  lines={4}
                />
              </div>

              {protocolProfile.specialHints.length > 0 && (
                <div className="mt-5 rounded-xl border border-slate-400 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                    Hinweise
                  </p>

                  <div className="grid gap-2">
                    {protocolProfile.specialHints.map((hint) => (
                      <CheckItem key={hint} label={hint} />
                    ))}
                  </div>
                </div>
              )}
            </ProtocolSection>

            <ProtocolSection title="4. Kundenbeanstandung / Fehlerbild">
              <div className="grid gap-4 md:grid-cols-2">
                <TextAreaField label="Kundenbeanstandung" lines={4} />
                <TextAreaField label="Wann tritt der Fehler auf?" lines={4} />
                <TextAreaField
                  label="Kalt / warm / Last / Leerlauf"
                  lines={4}
                />
                <TextAreaField label="Sporadisch oder dauerhaft?" lines={4} />
              </div>
            </ProtocolSection>

            <ProtocolSection title="5. Fehlerspeicher">
              <div className="mb-4 grid gap-4 md:grid-cols-2">
                <TextAreaField
                  label="Kurze KI-Zusammenfassung"
                  value={shortenText(lastAssistantMessage, 550)}
                  lines={4}
                />

                <TextAreaField
                  label="Qualitätsprüfung"
                  value={currentCase?.qualityCheck || ""}
                  lines={4}
                />
              </div>

              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-200">
                    <th className="border border-slate-500 p-2 text-left">
                      Steuergerät
                    </th>
                    <th className="border border-slate-500 p-2 text-left">
                      Fehlercode
                    </th>
                    <th className="border border-slate-500 p-2 text-left">
                      Status
                    </th>
                    <th className="border border-slate-500 p-2 text-left">
                      Umgebungsbedingungen
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {[1, 2, 3, 4, 5].map((row) => (
                    <tr key={row}>
                      <td className="h-10 border border-slate-500 p-2" />
                      <td className="h-10 border border-slate-500 p-2" />
                      <td className="h-10 border border-slate-500 p-2" />
                      <td className="h-10 border border-slate-500 p-2" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </ProtocolSection>

            {premiumAccess && faultCodeCauses.length > 0 && (
              <ProtocolSection title="6. Typische Ursachen laut Fehlercode">
                <div className="grid gap-3 md:grid-cols-2">
                  {faultCodeCauses.map((cause) => (
                    <CheckItem key={cause} label={cause} />
                  ))}
                </div>
              </ProtocolSection>
            )}

            {premiumAccess && faultCodeChecks.length > 0 && (
              <ProtocolSection title="7. Empfohlene Prüfungen laut Fehlercode">
                <div className="grid gap-3 md:grid-cols-2">
                  {faultCodeChecks.map((check) => (
                    <CheckItem key={check} label={check} />
                  ))}
                </div>
              </ProtocolSection>
            )}

            <ProtocolSection title={premiumAccess ? "8. Sichtprüfung" : "6. Sichtprüfung"}>
              <div className="grid gap-3 md:grid-cols-2">
                {visualChecks.map((check) => (
                  <CheckItem key={check} label={check} />
                ))}
              </div>

              <div className="mt-5">
                <TextAreaField label="Auffälligkeiten Sichtprüfung" lines={5} />
              </div>
            </ProtocolSection>

            <ProtocolSection title={premiumAccess ? "9. Messwerte" : "7. Messwerte"}>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-200">
                    <th className="border border-slate-500 p-2 text-left">
                      Prüfpunkt
                    </th>
                    <th className="border border-slate-500 p-2 text-left">
                      Sollwert
                    </th>
                    <th className="border border-slate-500 p-2 text-left">
                      Istwert
                    </th>
                    <th className="border border-slate-500 p-2 text-left">
                      i.O. / n.i.O.
                    </th>
                    <th className="border border-slate-500 p-2 text-left">
                      Bemerkung
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {measurementRows.map((row) => (
                    <tr key={row}>
                      <td className="h-10 border border-slate-500 p-2 font-semibold">
                        {row}
                      </td>
                      <td className="h-10 border border-slate-500 p-2" />
                      <td className="h-10 border border-slate-500 p-2" />
                      <td className="h-10 border border-slate-500 p-2" />
                      <td className="h-10 border border-slate-500 p-2" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </ProtocolSection>

            <ProtocolSection
              title={premiumAccess ? "10. Diagnose-Checkliste" : "8. Diagnose-Checkliste"}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {diagnosticChecks.map((check) => (
                  <CheckItem key={check} label={check} />
                ))}
              </div>
            </ProtocolSection>

            <ProtocolSection
              title={premiumAccess ? "11. Ergebnis / Reparaturempfehlung" : "9. Ergebnis / Reparaturempfehlung"}
            >
              <div className="grid gap-4">
                <TextAreaField label="Festgestellte Ursache" lines={4} />
                <TextAreaField label="Reparaturempfehlung" lines={4} />

                <div className="grid gap-4 md:grid-cols-2">
                  <TextAreaField label="Benötigte Teile" lines={4} />
                  <TextAreaField label="Geschätzte Arbeitszeit" lines={4} />
                </div>

                <TextAreaField
                  label="Nachkontrolle / Probefahrt Ergebnis"
                  lines={4}
                />
              </div>
            </ProtocolSection>

            <ProtocolSection
              title={premiumAccess ? "12. Freigabe / Unterschrift" : "10. Freigabe / Unterschrift"}
            >
              <div className="grid gap-6 md:grid-cols-3">
                <LineField
                  label="Diagnose durchgeführt von"
                  value={demoAccount?.name || ""}
                />
                <LineField label="Datum" />
                <LineField label="Unterschrift" />
              </div>
            </ProtocolSection>
          </div>
        </article>
      </main>

      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}