"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import { readAccountScopedLocalStorage } from "@/services/accountScopedStorage";
import {
  PLAN_CONFIG,
  hasPremiumAccess as hasPlanPremiumAccess,
  type UserPlan,
} from "@/config/plans";
import {
  loadWorkshopProfileState,
  readLocalWorkshopProfileState,
  type WorkshopProfileState,
} from "@/services/workshopProfileSupabase";


type PlanSource = "supabase" | "localStorage" | "fallback";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

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

type CurrentDiagnosisCase = {
  messages: ChatMessage[];
  engineContext: EngineContext | null;
  faultCodeContext: FaultCodeContext | null;
  qualityCheck: string;
  openedCaseId?: string | null;
};

type WorkshopData = {
  workshop: string;
  name: string;
  email: string;
  role: string;
};

type InspectionProfile = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  typicalCauses: string[];
  recommendedChecks: string[];
  measurementValues: string[];
  documentationNotes: string[];
};

const CURRENT_CASE_STORAGE_KEY = "diagnosehub-current-case";

const planSourceLabels: Record<PlanSource, string> = {
  supabase: "Supabase Datenbank",
  localStorage: "Lokaler Fallback",
  fallback: "Fallback",
};

const defaultWorkshopData: WorkshopData = {
  workshop: "DiagnoseHUB",
  name: "Nicht hinterlegt",
  email: "Nicht hinterlegt",
  role: "Werkstatt",
};

const defaultProfile: InspectionProfile = {
  id: "default",
  title: "Standard-Prüfprotokoll",
  subtitle: "Allgemeine Diagnoseprüfung",
  description:
    "Dieses Standardprotokoll dient zur strukturierten Dokumentation eines Diagnosefalls. Für individuelle Prüfprofile nach Fehlercode ist der Werkstatt- oder Pro-Plan erforderlich.",
  typicalCauses: [
    "Fehlerbild noch nicht eindeutig genug eingegrenzt",
    "Unvollständige Fahrzeug- oder Fehlercodeangaben",
    "Elektrische Versorgung, Massepunkt oder Steckverbindung fehlerhaft",
    "Sensorwert unplausibel oder nur sporadisch außerhalb des Sollbereichs",
    "Mechanischer Grundfehler möglich",
  ],
  recommendedChecks: [
    "Kundenbeanstandung exakt dokumentieren",
    "Fehlerspeicher aller relevanten Steuergeräte auslesen",
    "Freeze-Frame-Daten und Umgebungsbedingungen sichern",
    "Sichtprüfung auf Undichtigkeiten, Beschaedigungen, lose Steckverbindungen und Marderbiss durchführen",
    "Batteriespannung, Massepunkte und Spannungsversorgung prüfen",
    "Relevante Istwerte bei Leerlauf, Teillast und Last vergleichen",
    "Fehler löschen und Probefahrt mit Live-Daten durchführen",
  ],
  measurementValues: [
    "Batteriespannung Motor aus / Motor läuft",
    "Fehlerstatus: statisch oder sporadisch",
    "Freeze-Frame-Daten",
    "Relevante Soll-/Istwerte laut Herstellerdiagnose",
    "Temperaturwerte und Betriebszustand",
  ],
  documentationNotes: [
    "Ausgangszustand mit Fehlercodes dokumentieren",
    "Durchgeführte Prüfungen mit Messergebnissen eintragen",
    "Nach Reparatur Fehlerspeicher löschen und erneute Probefahrt dokumentieren",
    "Kundenhinweis erfassen, falls Folgeschäden oder Zusatzprüfungen möglich sind",
  ],
};

const boostPressureProfile: InspectionProfile = {
  id: "boost-pressure",
  title: "Individuelles Prüfprofil: Ladedruck / Aufladung",
  subtitle: "Für Fehler wie P0299, P0234 oder Ladedruckabweichung",
  description:
    "Dieses Prüfprofil grenzt Ladedruckfehler systematisch ein. Fokus liegt auf Ladeluftstrecke, Turboladerregelung, Unterdrucksystem, Sensorik und Abgasgegendruck.",
  typicalCauses: [
    "Undichtigkeit in der Ladeluftstrecke",
    "Ladeluftschlauch eingerissen oder abgesprungen",
    "Ladedrucksensor verschmutzt oder unplausibel",
    "Unterdruckleitung undicht oder poroes",
    "Druckwandler / Magnetventil für Ladedruckregelung fehlerhaft",
    "VTG-Verstellung schwergaengig oder Wastegate klemmt",
    "Turbolader mechanisch verschlissen",
    "Abgasgegendruck zu hoch, zum Beispiel durch DPF-Probleme",
  ],
  recommendedChecks: [
    "Fehlerspeicher mit Freeze-Frame auslesen",
    "Ladedruck Soll/Ist bei Probefahrt unter Last aufzeichnen",
    "Ladeluftstrecke abdrücken",
    "Schlaeuche, Schellen, Ladeluftkühler und O-Ringe prüfen",
    "Unterdruckversorgung mit Handpumpe prüfen",
    "Druckwandler/Magnetventil elektrisch und pneumatisch prüfen",
    "VTG- oder Wastegate-Stellgliedtest durchführen",
    "Ladedrucksensor mit Atmosphaerendruck und Lastwerten plausibilisieren",
    "Abgasgegendruck beziehungsweise DPF-Differenzdruck prüfen",
  ],
  measurementValues: [
    "Ladedruck Sollwert",
    "Ladedruck Istwert",
    "Atmosphaerendruck",
    "Luftmasse Istwert",
    "Ansteuerung Ladedrucksteller / N75 / Druckwandler",
    "Unterdruck am Druckwandler",
    "DPF-Differenzdruck oder Abgasgegendruck",
  ],
  documentationNotes: [
    "Soll-/Ist-Ladedruck vor und nach Reparatur dokumentieren",
    "Abdrücktest mit Druckwert und Ergebnis eintragen",
    "Unterdruckprüfung mit Haltezeit dokumentieren",
    "Probefahrt mit reproduzierbarem Lastzustand festhalten",
  ],
};

const fuelPressureProfile: InspectionProfile = {
  id: "fuel-pressure",
  title: "Individuelles Prüfprofil: Kraftstoffdruck / Raildruck",
  subtitle: "Für Fehler wie P0087, P0088 oder Raildruckabweichung",
  description:
    "Dieses Profil dient zur Eingrenzung von Niederdruckversorgung, Hochdrucksystem, Mengenregelung, Sensorik und Injektorrücklauf.",
  typicalCauses: [
    "Kraftstofffilter zugesetzt",
    "Niederdruckpumpe liefert zu wenig Foerdermenge",
    "Luft im Kraftstoffsystem",
    "Mengenregelventil oder Druckregelventil fehlerhaft",
    "Raildrucksensor unplausibel",
    "Injektor mit zu hoher Rücklaufmenge",
    "Hochdruckpumpe verschlissen",
    "Kraftstoffqualität oder Verunreinigung problematisch",
  ],
  recommendedChecks: [
    "Raildruck Soll/Ist beim Starten, Leerlauf und unter Last aufzeichnen",
    "Kraftstofffilterzustand prüfen und Wartungshistorie bewerten",
    "Niederdruckversorgung mit Manometer oder Diagnosedaten prüfen",
    "Rücklaufmengentest der Injektoren durchführen",
    "Mengenregelventil und Druckregelventil elektrisch prüfen",
    "Raildrucksensor auf Plausibilität prüfen",
    "Kraftstoffsystem auf Luftblasen und Undichtigkeiten prüfen",
    "Bei Verdacht Kraftstoffprobe auf Spaene oder Verunreinigung prüfen",
  ],
  measurementValues: [
    "Raildruck Sollwert",
    "Raildruck Istwert",
    "Niederdruck Kraftstoffversorgung",
    "Ansteuerung Mengenregelventil",
    "Ansteuerung Druckregelventil",
    "Injektor-Rücklaufmengen",
    "Startdrehzahl",
  ],
  documentationNotes: [
    "Raildruckkurve beim Startversuch dokumentieren",
    "Rücklaufmengen je Zylinder erfassen",
    "Filterzustand und Kraftstoffprobe dokumentieren",
    "Nach Reparatur Startverhalten und Lastfahrt prüfen",
  ],
};

const egrProfile: InspectionProfile = {
  id: "egr",
  title: "Individuelles Prüfprofil: AGR-System",
  subtitle: "Für Fehler wie P0401, P0402 oder AGR-Regelabweichung",
  description:
    "Dieses Profil konzentriert sich auf AGR-Ventil, AGR-Kühler, Ansaugtrakt, Luftmasse und Stellgliedfunktion.",
  typicalCauses: [
    "AGR-Ventil verkokt oder klemmt",
    "AGR-Kühler oder AGR-Strecke zugesetzt",
    "Stellmotor oder Positionssensor fehlerhaft",
    "Unterdruckdose oder Unterdruckansteuerung fehlerhaft",
    "Luftmassenmesser liefert unplausible Werte",
    "Ansaugtrakt stark verkokt",
    "Software- oder Adaptionsproblem nach Reparatur",
  ],
  recommendedChecks: [
    "AGR Soll-/Ist-Position per Diagnose vergleichen",
    "AGR-Stellgliedtest durchführen",
    "Luftmasse bei AGR-Ansteuerung beobachten",
    "AGR-Strecke und Ansaugtrakt auf Verkokung prüfen",
    "Unterdruckversorgung prüfen, falls pneumatisch gesteuert",
    "Stecker, Pins und Kabelbaum am AGR prüfen",
    "Nach Reinigung oder Tausch Grundeinstellung/Adaption durchführen",
  ],
  measurementValues: [
    "AGR Sollposition",
    "AGR Istposition",
    "Luftmasse Soll/Ist",
    "Ansauglufttemperatur",
    "Unterdruck AGR-Ansteuerung",
    "Fehlerstatus nach Stellgliedtest",
  ],
  documentationNotes: [
    "AGR-Stellgliedtest Ergebnis dokumentieren",
    "Verkokungsgrad mit Foto oder Beschreibung festhalten",
    "Luftmassenänderung bei AGR-Ansteuerung erfassen",
    "Nach Reparatur Adaption und Probefahrt dokumentieren",
  ],
};

const dpfProfile: InspectionProfile = {
  id: "dpf",
  title: "Individuelles Prüfprofil: Dieselpartikelfilter",
  subtitle: "Für Fehler wie P2002, P2453 oder DPF-Differenzdruck",
  description:
    "Dieses Profil prüft DPF-Beladung, Differenzdrucksensorik, Regenerationsbedingungen, Temperatursensorik und Abgasgegendruck.",
  typicalCauses: [
    "DPF mit Ruß oder Asche überladen",
    "Differenzdrucksensor fehlerhaft",
    "Differenzdruckleitungen verstopft oder undicht",
    "Abgastemperatursensor unplausibel",
    "Regeneration wird wegen anderem Fehler nicht freigegeben",
    "Viele Kurzstrecken oder abgebrochene Regenerationen",
    "Injektorproblem oder Oelverbrauch verursacht erhöhte Rußbildung",
  ],
  recommendedChecks: [
    "DPF-Differenzdruck im Leerlauf und bei erhöhter Drehzahl prüfen",
    "Rußmasse und Aschemasse auslesen",
    "Regenerationsstatus und letzte Regeneration prüfen",
    "Differenzdruckleitungen auf Durchgang und Dichtheit prüfen",
    "Abgastemperatursensoren plausibilisieren",
    "Motoroelstand prüfen, Oelverduennung bewerten",
    "Vorgelagerte Fehler beheben, bevor Regeneration angestoßen wird",
    "Probefahrt oder Serviceregeneration nur bei erfuellten Bedingungen durchführen",
  ],
  measurementValues: [
    "DPF-Differenzdruck Leerlauf",
    "DPF-Differenzdruck bei 2500 1/min",
    "Berechnete Rußmasse",
    "Aschemasse",
    "Abgastemperaturen vor/nach DPF",
    "Regenerationsstatus",
    "Kilometer seit letzter Regeneration",
  ],
  documentationNotes: [
    "Differenzdruckwerte vor und nach Maßnahme dokumentieren",
    "Ruß-/Aschewerte erfassen",
    "Regeneration nur mit Sicherheitsbedingungen dokumentieren",
    "Kundenfahrprofil aufnehmen",
  ],
};

const mixtureProfile: InspectionProfile = {
  id: "mixture",
  title: "Individuelles Prüfprofil: Gemischaufbereitung",
  subtitle: "Für Fehler wie P0171, P0172 oder Gemisch zu mager/fett",
  description:
    "Dieses Profil grenzt Falschluft, Kraftstoffversorgung, Lambdaregelung, Luftmassenmessung und Einspritzung ein.",
  typicalCauses: [
    "Falschluft im Ansaugsystem",
    "Kurbelgehäuseentlüftung undicht",
    "Luftmassenmesser unplausibel",
    "Lambdasonde gealtert oder fehlerhaft",
    "Kraftstoffdruck zu niedrig oder zu hoch",
    "Einspritzventil undicht oder verschmutzt",
    "Abgasanlage vor Lambdasonde undicht",
  ],
  recommendedChecks: [
    "Short Term und Long Term Fuel Trim auslesen",
    "Ansaugsystem abnebeln",
    "Kurbelgehäuseentlüftung prüfen",
    "Luftmassenmesser auf Plausibilität prüfen",
    "Lambdasondensignal vor und nach Kat prüfen",
    "Kraftstoffdruck messen",
    "Abgasanlage vor Lambdasonde auf Undichtigkeit prüfen",
    "Einspritzventile bei Bedarf prüfen",
  ],
  measurementValues: [
    "STFT",
    "LTFT",
    "Lambdasondenspannung oder Lambda-Faktor",
    "Luftmasse g/s",
    "Saugrohrdruck",
    "Kraftstoffdruck",
    "Motortemperatur",
  ],
  documentationNotes: [
    "Fuel Trims im Leerlauf und bei Teillast dokumentieren",
    "Ergebnis Abnebeltest festhalten",
    "Lambdawerte vor und nach Reparatur vergleichen",
    "Adaptionswerte nach Reparatur prüfen",
  ],
};

const misfireProfile: InspectionProfile = {
  id: "misfire",
  title: "Individuelles Prüfprofil: Verbrennungsaussetzer / Laufunruhe",
  subtitle: "Für Fehler wie P0300, P0301, P0302, P0303, P0304",
  description:
    "Dieses Profil grenzt zylinderbezogene Aussetzer über Zündung, Einspritzung, Kompression, Falschluft und mechanische Ursachen ein.",
  typicalCauses: [
    "Zuendkerze verschlissen oder falscher Elektrodenabstand",
    "Zuendspule fehlerhaft",
    "Einspritzventil fehlerhaft oder verschmutzt",
    "Kompressionsverlust",
    "Falschluft an zylindernahem Ansaugkanal",
    "Kabelbaum oder Steckerproblem",
    "Mechanischer Schaden an Ventiltrieb oder Kolben",
  ],
  recommendedChecks: [
    "Aussetzerzähller je Zylinder auslesen",
    "Zuendkerzenbild prüfen",
    "Zuendspule zylinderweise quer tauschen",
    "Einspritzventil zylinderweise prüfen oder quer tauschen",
    "Kompressionstest durchführen",
    "Druckverlusttest bei Verdacht durchführen",
    "Ansaugsystem auf zylindernahe Falschluft prüfen",
    "Stecker und Kabelbaum am betroffenen Zylinder prüfen",
  ],
  measurementValues: [
    "Aussetzerzähller je Zylinder",
    "Laufunruhewerte",
    "Kompressionsdruck je Zylinder",
    "Druckverlust Prozent",
    "Fuel Trims",
    "Zuendwinkelrücknahme",
  ],
  documentationNotes: [
    "Betroffenen Zylinder eindeutig dokumentieren",
    "Quer-Tausch-Prüfung mit Ergebnis erfassen",
    "Kompressionswerte tabellarisch notieren",
    "Probefahrt nach Reparatur mit Aussetzerzähller dokumentieren",
  ],
};

const airMassProfile: InspectionProfile = {
  id: "air-mass",
  title: "Individuelles Prüfprofil: Luftmasse / Ansaugsystem",
  subtitle: "Für Fehler wie P0101 oder Luftmassen-Plausibilität",
  description:
    "Dieses Profil prüft Luftmassenmesser, Ansaugstrecke, Undichtigkeiten, AGR-Einfluss und Sensorplausibilität.",
  typicalCauses: [
    "Luftmassenmesser verschmutzt oder fehlerhaft",
    "Falschluft nach Luftmassenmesser",
    "Luftfilter zugesetzt",
    "Ansaugschlauch beschädigt",
    "AGR-Einfluss verfaelscht Luftmasse",
    "Stecker oder Kabelbaumproblem am LMM",
    "Software-/Adaptionswert unplausibel",
  ],
  recommendedChecks: [
    "Luftfilter und Ansaugweg prüfen",
    "Luftmasse Soll/Ist im Leerlauf und unter Last vergleichen",
    "Ansaugsystem auf Undichtigkeiten prüfen",
    "Stecker und Kabelbaum am Luftmassenmesser prüfen",
    "AGR-Ansteuerung und Luftmassenänderung vergleichen",
    "Saugrohrdrucksensor auf Plausibilität prüfen",
    "Bei Verdacht Vergleichsmessung mit bekannt gutem Sensor durchführen",
  ],
  measurementValues: [
    "Luftmasse g/s",
    "Luftmasse Sollwert",
    "Saugrohrdruck",
    "Ansauglufttemperatur",
    "AGR Soll/Ist",
    "Motordrehzahl und Last",
  ],
  documentationNotes: [
    "Luftmasse bei definierten Drehzahlen dokumentieren",
    "Luftfilterzustand festhalten",
    "Undichtigkeitsprüfung dokumentieren",
    "Sensorwerte vor und nach Reparatur vergleichen",
  ],
};

const inspectionProfiles = [
  boostPressureProfile,
  fuelPressureProfile,
  egrProfile,
  dpfProfile,
  mixtureProfile,
  misfireProfile,
  airMassProfile,
];

function hasPremiumAccess(userPlan: UserPlan) {
  return hasPlanPremiumAccess(userPlan);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getCurrentDateTime() {
  return new Date().toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getFirstUserMessage(messages: ChatMessage[]) {
  return messages.find((message) => message.role === "user")?.content || "";
}

function getLastAssistantMessage(messages: ChatMessage[]) {
  const assistantMessages = messages.filter((message) => {
    return message.role === "assistant";
  });

  return assistantMessages[assistantMessages.length - 1]?.content || "";
}

function getSearchText(
  messages: ChatMessage[],
  faultCodeContext: FaultCodeContext | null,
  engineContext: EngineContext | null
) {
  const messageText = messages.map((message) => message.content).join(" ");
  const faultText =
    faultCodeContext?.foundCodes
      .map((faultCode) => {
        return `${faultCode.code} ${faultCode.title} ${faultCode.system} ${faultCode.description}`;
      })
      .join(" ") || "";
  const engineText = engineContext
    ? `${engineContext.engineType} ${engineContext.code || ""} ${
        engineContext.label
      }`
    : "";

  return `${messageText} ${faultText} ${engineText}`.toLowerCase();
}

function detectInspectionProfile(
  messages: ChatMessage[],
  faultCodeContext: FaultCodeContext | null,
  engineContext: EngineContext | null
) {
  const text = getSearchText(messages, faultCodeContext, engineContext);

  if (
    text.includes("p0299") ||
    text.includes("p0234") ||
    text.includes("ladedruck") ||
    text.includes("aufladung") ||
    text.includes("turbo") ||
    text.includes("turbolader") ||
    text.includes("wastegate") ||
    text.includes("vtg")
  ) {
    return boostPressureProfile;
  }

  if (
    text.includes("p0087") ||
    text.includes("p0088") ||
    text.includes("raildruck") ||
    text.includes("kraftstoffdruck") ||
    text.includes("hochdruckpumpe") ||
    text.includes("niederdruck")
  ) {
    return fuelPressureProfile;
  }

  if (
    text.includes("p0401") ||
    text.includes("p0402") ||
    text.includes("agr") ||
    text.includes("abgasrückführung") ||
    text.includes("abgasrückführung")
  ) {
    return egrProfile;
  }

  if (
    text.includes("p2002") ||
    text.includes("p2453") ||
    text.includes("dpf") ||
    text.includes("dieselpartikelfilter") ||
    text.includes("differenzdruck")
  ) {
    return dpfProfile;
  }

  if (
    text.includes("p0171") ||
    text.includes("p0172") ||
    text.includes("gemisch") ||
    text.includes("mager") ||
    text.includes("fett") ||
    text.includes("fuel trim") ||
    text.includes("fuel trims")
  ) {
    return mixtureProfile;
  }

  if (
    text.includes("p0300") ||
    text.includes("p0301") ||
    text.includes("p0302") ||
    text.includes("p0303") ||
    text.includes("p0304") ||
    text.includes("aussetzer") ||
    text.includes("verbrennungsaussetzer") ||
    text.includes("laufunruhe")
  ) {
    return misfireProfile;
  }

  if (
    text.includes("p0101") ||
    text.includes("luftmasse") ||
    text.includes("luftmassenmesser") ||
    text.includes("lmm") ||
    text.includes("ansaugsystem")
  ) {
    return airMassProfile;
  }

  return defaultProfile;
}

function convertProfileStateToWorkshopData(
  profileState: WorkshopProfileState
): WorkshopData {
  return {
    workshop: profileState.workshop || defaultWorkshopData.workshop,
    name: profileState.name || defaultWorkshopData.name,
    email: profileState.email || defaultWorkshopData.email,
    role: profileState.role || defaultWorkshopData.role,
  };
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="mt-2 font-semibold text-white">{value}</div>
    </div>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 text-slate-300">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3 text-slate-300">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

export default function PrüfprotokollPage() {
  const supabase = useMemo(() => createClient(), []);

  const [currentCase, setCurrentCase] = useState<CurrentDiagnosisCase | null>(
    null
  );
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [planSource, setPlanSource] = useState<PlanSource>("fallback");
  const [workshopData, setWorkshopData] =
    useState<WorkshopData>(defaultWorkshopData);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadPlanAndWorkshopData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        loadCurrentCase(nextSession?.user.id ?? null);
        window.setTimeout(() => {
          void loadPlanAndWorkshopData(nextSession);
        }, 0);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  function loadCurrentCase(userId?: string | null) {
    try {
      const savedCurrentCase = readAccountScopedLocalStorage(
        CURRENT_CASE_STORAGE_KEY,
        userId
      );

      if (!savedCurrentCase) {
        setCurrentCase(null);
        return;
      }

      const parsedCase = JSON.parse(savedCurrentCase) as CurrentDiagnosisCase;

      setCurrentCase({
        messages: parsedCase.messages || [],
        engineContext: parsedCase.engineContext || null,
        faultCodeContext: parsedCase.faultCodeContext || null,
        qualityCheck: parsedCase.qualityCheck || "",
        openedCaseId: parsedCase.openedCaseId || null,
      });
    } catch (error) {
      console.error("Aktueller Diagnosefall konnte nicht geladen werden:", error);
      setCurrentCase(null);
      setError("Der aktuelle Diagnosefall konnte nicht geladen werden.");
    }
  }

  async function loadPlanAndWorkshopData(existingSession?: Session | null) {
    setLoadingPlan(true);
    setError("");

    try {
      const localState = readLocalWorkshopProfileState();

      setUserPlan(localState.plan);
      setWorkshopData(convertProfileStateToWorkshopData(localState));
      setPlanSource(localState.source);

      const session =
        existingSession ??
        (await supabase.auth.getSession()).data.session ??
        null;

      loadCurrentCase(session?.user.id ?? null);

      const profileState = await loadWorkshopProfileState(
        supabase,
        session?.user ?? null
      );

      setUserPlan(profileState.plan);
      setWorkshopData(convertProfileStateToWorkshopData(profileState));
      setPlanSource(profileState.source);
    } catch (error) {
      console.error("Plan konnte nicht geladen werden:", error);
      setError("Plan konnte nicht geladen werden. Fallback auf Free aktiv.");
      setUserPlan("free");
      setPlanSource("fallback");
      setWorkshopData(defaultWorkshopData);
    } finally {
      setLoadingPlan(false);
    }
  }

  const messages = currentCase?.messages || [];
  const engineContext = currentCase?.engineContext || null;
  const faultCodeContext = currentCase?.faultCodeContext || null;
  const qualityCheck = currentCase?.qualityCheck || "";

  const detectedPremiumProfile = useMemo(() => {
    return detectInspectionProfile(messages, faultCodeContext, engineContext);
  }, [messages, faultCodeContext, engineContext]);

  const premiumAccess = hasPremiumAccess(userPlan);

  const activeProfile = premiumAccess
    ? detectedPremiumProfile
    : defaultProfile;

  const firstUserMessage = getFirstUserMessage(messages);
  const lastAssistantMessage = getLastAssistantMessage(messages);

  const detectedProfileText =
    detectedPremiumProfile.id === "default"
      ? "Kein spezielles Fehlercode-Profil erkannt"
      : detectedPremiumProfile.title;

  const premiumProfileStatus = premiumAccess
    ? detectedPremiumProfile.id === "default"
      ? "Premium aktiv, aber Standardprofil verwendet"
      : "Premium-Prüfprofil aktiv"
    : "Nicht aktiv";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 print:hidden md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-400">
              DiagnoseHUB Prüfprotokoll
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight md:text-5xl">
              Prüfprotokoll drucken
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/#diagnose"
              className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Zur Diagnose
            </Link>

            <button
              onClick={() => window.print()}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              Drucken
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-yellow-300 print:hidden">
            {error}
          </div>
        )}

        {!currentCase || messages.length === 0 ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8">
            <h2 className="text-3xl font-bold">Kein Diagnosefall geladen</h2>

            <p className="mt-4 leading-8 text-slate-400">
              Starte zuerst eine Diagnose oder öffne einen gespeicherten Fall.
              Danach kann DiagnoseHUB daraus ein Prüfprotokoll erstellen.
            </p>

            <Link
              href="/#diagnose"
              className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              Diagnose starten
            </Link>
          </section>
        ) : (
          <article className="print-area space-y-8 rounded-[2rem] border border-slate-800 bg-slate-950 p-6 shadow-2xl shadow-blue-950/30 print:border-0 print:bg-white print:p-0 print:text-black print:shadow-none">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 print:border-0 print:bg-white print:p-0">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-slate-900 p-2 print:border-gray-300 print:bg-white">
                    <Image
                      src="/diagnosehub-logo.png"
                      alt="DiagnoseHUB Logo"
                      width={64}
                      height={64}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-400 print:text-gray-600">
                      DiagnoseHUB
                    </p>
                    <h2 className="text-3xl font-black text-white print:text-black">
                      Prüfprotokoll
                    </h2>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400 print:border-gray-300 print:bg-white print:text-gray-700">
                  <p>
                    Erstellt:{" "}
                    <span className="font-semibold text-white print:text-black">
                      {getCurrentDateTime()}
                    </span>
                  </p>
                  <p>
                    Plan:{" "}
                    <span className="font-semibold text-white print:text-black">
                      {PLAN_CONFIG[userPlan].label}
                    </span>
                  </p>
                  <p>
                    Planquelle:{" "}
                    <span className="font-semibold text-white print:text-black">
                      {planSourceLabels[planSource]}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <InfoRow label="Werkstatt" value={workshopData.workshop} />
                <InfoRow label="Bearbeiter" value={workshopData.name} />
                <InfoRow label="E-Mail" value={workshopData.email} />
                <InfoRow label="Rolle" value={workshopData.role} />
              </div>
            </section>

            <section
              className={
                premiumAccess
                  ? "rounded-3xl border border-green-500/30 bg-green-500/10 p-6 print:border-gray-300 print:bg-white"
                  : "rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-6 print:border-gray-300 print:bg-white"
              }
            >
              <p
                className={
                  premiumAccess
                    ? "text-sm font-semibold uppercase tracking-wide text-green-300 print:text-gray-700"
                    : "text-sm font-semibold uppercase tracking-wide text-yellow-300 print:text-gray-700"
                }
              >
                Plan- und Prüfprofil-Kontrolle
              </p>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <InfoRow label="Aktiver Plan" value={PLAN_CONFIG[userPlan].label} />
                <InfoRow
                  label="Premium-Prüfprofil"
                  value={premiumProfileStatus}
                />
                <InfoRow
                  label="Erkanntes Profil"
                  value={
                    loadingPlan
                      ? "Plan wird geladen..."
                      : premiumAccess
                        ? detectedProfileText
                        : `${detectedProfileText} / im Free-Plan gesperrt`
                  }
                />
              </div>

              {!premiumAccess && (
                <p className="mt-4 leading-7 text-yellow-200 print:text-gray-700">
                  Free-Plan: Standardprotokoll aktiv. Individuelle Prüfprofile
                  nach Fehlercode sind ab Werkstatt Demo oder Werkstatt Pro Demo
                  aktiv.
                </p>
              )}
            </section>

            <SectionCard title="Fahrzeug- und Motorkontext">
              <div className="grid gap-4 md:grid-cols-4">
                <InfoRow
                  label="Motortyp"
                  value={engineContext?.engineType || "nicht erkannt"}
                />
                <InfoRow
                  label="Erkennung"
                  value={engineContext?.source || "nicht erkannt"}
                />
                <InfoRow
                  label="Motorcode"
                  value={engineContext?.code || "nicht erkannt"}
                />
                <InfoRow
                  label="Motor"
                  value={engineContext?.label || "nicht erkannt"}
                />
              </div>

              {engineContext?.notes && (
                <p className="mt-4 leading-7 text-slate-400 print:text-gray-700">
                  {engineContext.notes}
                </p>
              )}
            </SectionCard>

            <SectionCard title="Fehlercode-Kontext">
              {faultCodeContext && faultCodeContext.foundCodes.length > 0 ? (
                <div className="space-y-5">
                  {faultCodeContext.summary && (
                    <p className="leading-7 text-slate-400 print:text-gray-700">
                      {faultCodeContext.summary}
                    </p>
                  )}

                  {faultCodeContext.foundCodes.map((faultCode) => (
                    <div
                      key={faultCode.code}
                      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 print:border-gray-300 print:bg-white"
                    >
                      <div className="grid gap-4 md:grid-cols-[0.3fr_0.7fr]">
                        <InfoRow label="Fehlercode" value={faultCode.code} />
                        <InfoRow label="System" value={faultCode.system} />
                      </div>

                      <h3 className="mt-5 text-xl font-bold text-white print:text-black">
                        {faultCode.title}
                      </h3>

                      <p className="mt-3 leading-7 text-slate-400 print:text-gray-700">
                        {faultCode.description}
                      </p>

                      {premiumAccess && (
                        <div className="mt-6 grid gap-6 lg:grid-cols-2">
                          <div>
                            <h4 className="mb-3 font-bold text-white print:text-black">
                              Typische Ursachen laut Fehlercode
                            </h4>
                            <CheckList items={faultCode.typicalCauses} />
                          </div>

                          <div>
                            <h4 className="mb-3 font-bold text-white print:text-black">
                              Empfohlene Prüfungen laut Fehlercode
                            </h4>
                            <NumberedList items={faultCode.suggestedChecks} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="leading-7 text-slate-400 print:text-gray-700">
                  Es wurde kein bekannter Fehlercode im aktuellen Fall erkannt.
                  Das Prüfprotokoll verwendet deshalb das Standardprofil.
                </p>
              )}
            </SectionCard>

            <SectionCard title={activeProfile.title}>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-400 print:text-gray-600">
                {activeProfile.subtitle}
              </p>

              <p className="mt-4 leading-8 text-slate-400 print:text-gray-700">
                {activeProfile.description}
              </p>

              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <div>
                  <h3 className="mb-4 text-xl font-bold text-white print:text-black">
                    Typische Ursachen
                  </h3>
                  <CheckList items={activeProfile.typicalCauses} />
                </div>

                <div>
                  <h3 className="mb-4 text-xl font-bold text-white print:text-black">
                    Empfohlene Prüfschritte
                  </h3>
                  <NumberedList items={activeProfile.recommendedChecks} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Messwerte dokumentieren">
              <div className="grid gap-3 md:grid-cols-2">
                {activeProfile.measurementValues.map((value) => (
                  <div
                    key={value}
                    className="grid grid-cols-[1fr_1.2fr] gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 print:border-gray-300 print:bg-white"
                  >
                    <p className="font-semibold text-white print:text-black">
                      {value}
                    </p>
                    <div className="min-h-7 border-b border-slate-700 print:border-gray-500" />
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Prüf- und Reparaturdokumentation">
              <div className="grid gap-8 lg:grid-cols-2">
                <div>
                  <h3 className="mb-4 text-xl font-bold text-white print:text-black">
                    Dokumentationshinweise
                  </h3>
                  <CheckList items={activeProfile.documentationNotes} />
                </div>

                <div>
                  <h3 className="mb-4 text-xl font-bold text-white print:text-black">
                    Werkstattnotizen
                  </h3>

                  <div className="space-y-5">
                    <div className="min-h-16 border-b border-slate-700 print:border-gray-500" />
                    <div className="min-h-16 border-b border-slate-700 print:border-gray-500" />
                    <div className="min-h-16 border-b border-slate-700 print:border-gray-500" />
                    <div className="min-h-16 border-b border-slate-700 print:border-gray-500" />
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Diagnose-Zusammenfassung">
              <div className="space-y-6">
                <div>
                  <p className="mb-2 font-bold text-white print:text-black">
                    Kundenbeanstandung / Eingabe
                  </p>
                  <div className="whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950/70 p-5 leading-8 text-slate-300 print:border-gray-300 print:bg-white print:text-gray-800">
                    {firstUserMessage || "Keine Eingabe vorhanden."}
                  </div>
                </div>

                <div>
                  <p className="mb-2 font-bold text-white print:text-black">
                    Letzte DiagnoseHUB-Einschätzung
                  </p>
                  <div className="whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950/70 p-5 leading-8 text-slate-300 print:border-gray-300 print:bg-white print:text-gray-800">
                    {lastAssistantMessage || "Keine KI-Antwort vorhanden."}
                  </div>
                </div>

                {qualityCheck && (
                  <div>
                    <p className="mb-2 font-bold text-white print:text-black">
                      Qualitätsprüfung
                    </p>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 leading-8 text-slate-300 print:border-gray-300 print:bg-white print:text-gray-800">
                      {qualityCheck}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Abschluss">
              <div className="grid gap-8 md:grid-cols-3">
                <div>
                  <p className="font-bold text-white print:text-black">
                    Prüfung durchgeführt von
                  </p>
                  <div className="mt-8 border-b border-slate-700 print:border-gray-500" />
                </div>

                <div>
                  <p className="font-bold text-white print:text-black">Datum</p>
                  <div className="mt-8 border-b border-slate-700 print:border-gray-500" />
                </div>

                <div>
                  <p className="font-bold text-white print:text-black">
                    Unterschrift
                  </p>
                  <div className="mt-8 border-b border-slate-700 print:border-gray-500" />
                </div>
              </div>

              <p className="mt-8 text-sm leading-7 text-slate-500 print:text-gray-600">
                Hinweis: DiagnoseHUB ersetzt keine fachgerechte Prüfung am
                Fahrzeug. Das Prüfprotokoll dient der strukturierten
                Dokumentation und Eingrenzung. Herstellervorgaben,
                Sicherheitsvorschriften und fahrzeugspezifische Prüfanleitungen
                sind zusätzlich zu beachten.
              </p>
            </SectionCard>
          </article>
        )}
      </main>

      <Footer />

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 14mm;
          }

          html,
          body {
            background: white !important;
            color: black !important;
          }

          header,
          footer,
          .print\\:hidden {
            display: none !important;
          }

          .print-area {
            width: 100% !important;
          }

          section {
            break-inside: avoid;
          }

          * {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
