import AudienceLandingPage from "@/components/AudienceLandingPage";

export const metadata = {
  title: "DiagnoseHUB für Werkstätten",
  description:
    "KI-gestützte Kfz-Diagnose, Prüfpläne, Fallhistorie und Dokumentation für Werkstätten.",
};

export default function WerkstaettenLandingPage() {
  return (
    <AudienceLandingPage
      eyebrow="Für Werkstätten"
      title="Fehlerfälle schneller strukturieren und sauber dokumentieren."
      intro="DiagnoseHUB unterstützt freie Werkstätten bei Diagnosefällen: Fehlercode, Symptom, Motorcode oder Messwerte eingeben und daraus einen nachvollziehbaren Prüfplan erstellen."
      primaryCta={{
        label: "Diagnose starten",
        href: "/diagnose",
      }}
      secondaryCta={{
        label: "Tarife ansehen",
        href: "/preise",
      }}
      accent="amber"
      proofPoints={[
        "Prüfplan aus Fehlerbild",
        "Fallhistorie pro Account",
        "Prüfprotokoll für Dokumentation",
      ]}
      useCases={[
        {
          title: "Komplexe Fälle sortieren",
          description:
            "Wenn Fehlerspeicher, Symptom und Messwerte nicht direkt zusammenpassen, hilft DiagnoseHUB beim Eingrenzen.",
        },
        {
          title: "Folgefragen stellen",
          description:
            "Messwerte, neue Symptome oder Prüfergebnisse können im selben Fall weiterverarbeitet werden.",
        },
        {
          title: "Dokumentation verbessern",
          description:
            "Gespeicherte Fälle und Prüfprotokolle machen nachvollziehbar, was geprüft wurde und warum.",
        },
      ]}
      workflow={[
        {
          step: "01",
          title: "Kundenbeanstandung aufnehmen",
          description:
            "Fahrzeugdaten, Fehlercodes, Symptome, Live-Daten oder bisherige Prüfungen eingeben.",
        },
        {
          step: "02",
          title: "Prüfreihenfolge erhalten",
          description:
            "DiagnoseHUB ordnet Ursachen, Messpunkte und nächste Schritte in eine sinnvolle Reihenfolge.",
        },
        {
          step: "03",
          title: "Fall speichern und abschließen",
          description:
            "Der Fall bleibt im Account verfügbar und kann für Folgefragen oder ein Prüfprotokoll genutzt werden.",
        },
      ]}
      comparisonTitle="Für Werkstätten, die weniger suchen und besser prüfen wollen."
      comparisonItems={[
        "Schneller Einstieg in unbekannte Fehlerbilder, ohne sofort Teile zu tauschen.",
        "Strukturierte Prüfpunkte für Elektrik, Sensorik, Ladedruck, DPF, Klima, Bremse und Fahrwerk.",
        "Strukturierte Prüfpläne zeigen Prüforte, Reihenfolge und nächste Entscheidung.",
        "Fallhistorie und Prüfprotokoll unterstützen interne Dokumentation und Kundengespräch.",
      ]}
      closingTitle="Aus Fehlercode und Symptom wird ein prüfbarer Ablauf."
      closingText="Für Werkstätten sind Diagnose 150, Komplett 150 oder Unlimited sinnvoll, abhängig davon, wie viele Fälle pro Monat bearbeitet werden."
    />
  );
}
