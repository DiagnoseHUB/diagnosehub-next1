import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-20">
        <div className="mb-10">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-400">
            Rechtliches
          </p>

          <h1 className="text-5xl font-bold">Datenschutzerklärung</h1>

          <p className="mt-5 leading-8 text-slate-400">
            Diese Datenschutzerklärung ist ein Platzhalter für den Prototyp. Vor
            der Veröffentlichung müssen die tatsächlichen Datenverarbeitungen,
            Anbieter und Kontaktangaben geprüft und ergänzt werden.
          </p>
        </div>

        <section className="space-y-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
          <div>
            <h2 className="text-2xl font-bold">1. Verantwortlicher</h2>

            <div className="mt-4 leading-8 text-slate-400">
              <p>DiagnoseHUB</p>
              <p>Verantwortlicher: [Name ergänzen]</p>
              <p>Adresse: [ergänzen]</p>
              <p>E-Mail: [ergänzen]</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold">2. Zweck der Plattform</h2>

            <p className="mt-4 leading-8 text-slate-400">
              DiagnoseHUB dient der Unterstützung bei der strukturierten
              Fahrzeugdiagnose. Nutzer können Fahrzeugdaten, Symptome,
              Fehlercodes und technische Beschreibungen eingeben, um eine
              KI-gestützte Einschätzung und einen Prüfplan zu erhalten.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold">3. Verarbeitete Daten</h2>

            <p className="mt-4 leading-8 text-slate-400">
              Im aktuellen Prototyp können insbesondere folgende Daten
              verarbeitet werden:
            </p>

            <ul className="mt-4 list-inside list-disc space-y-2 text-slate-400">
              <li>eingegebene Fahrzeugdaten</li>
              <li>Motorkennbuchstaben</li>
              <li>Fehlercodes</li>
              <li>Symptombeschreibungen</li>
              <li>Diagnoseverlauf</li>
              <li>technische Rückfragen</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold">4. Lokale Speicherung</h2>

            <p className="mt-4 leading-8 text-slate-400">
              Der aktuelle Prototyp speichert Diagnosefälle lokal im Browser des
              Nutzers über Local Storage. Diese Daten bleiben auf dem jeweiligen
              Gerät gespeichert, bis sie vom Nutzer gelöscht oder durch
              Browserfunktionen entfernt werden.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold">5. KI-Verarbeitung</h2>

            <p className="mt-4 leading-8 text-slate-400">
              Für die KI-gestützte Diagnose können die eingegebenen Inhalte an
              einen externen KI-Dienst übertragen werden. Vor produktiver
              Veröffentlichung müssen Anbieter, Rechtsgrundlage,
              Auftragsverarbeitung und technische Schutzmaßnahmen konkret
              ergänzt werden.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold">6. Keine Eingabe unnötiger personenbezogener Daten</h2>

            <p className="mt-4 leading-8 text-slate-400">
              Nutzer sollten keine personenbezogenen Kundendaten, Kennzeichen,
              Fahrgestellnummern oder sonstige nicht erforderliche Informationen
              eingeben, solange der Prototyp nicht final datenschutzrechtlich
              geprüft ist.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold">7. Betroffenenrechte</h2>

            <p className="mt-4 leading-8 text-slate-400">
              Betroffene Personen haben grundsätzlich Rechte auf Auskunft,
              Berichtigung, Löschung, Einschränkung der Verarbeitung,
              Datenübertragbarkeit und Widerspruch. Die konkrete Ausgestaltung
              muss vor Veröffentlichung rechtlich geprüft und ergänzt werden.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold">8. Stand</h2>

            <p className="mt-4 leading-8 text-slate-400">
              Stand dieser Platzhalter-Erklärung: Juni 2026.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}