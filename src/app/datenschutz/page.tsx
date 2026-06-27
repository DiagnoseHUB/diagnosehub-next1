import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-14">
        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-blue-950/30">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-400">
            DiagnoseHUB
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
            Datenschutzerklärung
          </h1>

          <div className="mt-8 space-y-8 leading-8 text-slate-300">
            <section>
              <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-yellow-100">
                <p className="font-bold">Vor Livegang final prüfen</p>
                <p className="mt-2">
                  Diese Datenschutzerklärung ist ein technischer
                  Beta-Platzhalter. Sie muss vor Veröffentlichung an die
                  tatsächlich eingesetzten Dienste, Datenflüsse und
                  Verantwortlichen angepasst werden.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                1. Verantwortlicher
              </h2>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p className="font-semibold text-white">
                  &lt;Vollständiger Name / Firmenname&gt;
                </p>
                <p>&lt;Straße und Hausnummer&gt;</p>
                <p>&lt;PLZ und Ort&gt;</p>
                <p>Deutschland</p>
                <p className="mt-3">
                  E-Mail:{" "}
                  <span className="font-semibold text-white">
                    &lt;deine-email@domain.de&gt;
                  </span>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                2. Allgemeine Hinweise zur Datenverarbeitung
              </h2>

              <p className="mt-4">
                Beim Besuch und bei der Nutzung von DiagnoseHUB können
                personenbezogene Daten verarbeitet werden. Dazu gehören
                insbesondere Kontaktdaten, Accountdaten, technische Nutzungsdaten
                sowie Inhalte, die Nutzer innerhalb der Plattform eingeben.
              </p>

              <p className="mt-4">
                Die Verarbeitung erfolgt, soweit erforderlich, zur Bereitstellung
                der Plattform, zur Verwaltung von Nutzerkonten, zur Speicherung
                von Diagnosefällen und zur Verbesserung der Funktionalität.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                3. Hosting und technische Bereitstellung
              </h2>

              <p className="mt-4">
                Die Website wird technisch über einen Hosting-Anbieter
                bereitgestellt. Dabei können technische Zugriffsdaten verarbeitet
                werden, zum Beispiel IP-Adresse, Datum und Uhrzeit des Zugriffs,
                verwendeter Browser, Betriebssystem und aufgerufene Seiten.
              </p>

              <p className="mt-4">
                Zweck dieser Verarbeitung ist die sichere und stabile
                Bereitstellung der Website.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                4. Supabase Auth und Datenbank
              </h2>

              <p className="mt-4">
                DiagnoseHUB nutzt Supabase für Login, Authentifizierung und die
                Speicherung bestimmter Daten. Dazu können insbesondere folgende
                Daten gehören:
              </p>

              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>E-Mail-Adresse des Nutzerkontos</li>
                <li>technische Nutzer-ID</li>
                <li>Werkstattprofil mit Name, Werkstatt, Rolle und Plan</li>
                <li>gespeicherte Diagnosefälle</li>
                <li>Nutzungszähler</li>
                <li>Premium-Vormerkungen</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                5. Nutzung der KI-Diagnose
              </h2>

              <p className="mt-4">
                Bei Nutzung der Diagnosefunktion werden vom Nutzer eingegebene
                Fahrzeuginformationen, Fehlerbeschreibungen, Fehlercodes und
                Gesprächsverläufe verarbeitet, um eine Diagnoseantwort zu
                erzeugen.
              </p>

              <p className="mt-4">
                Nutzer sollten keine unnötigen personenbezogenen Daten in die
                Diagnoseeingabe schreiben. Die Eingaben sollten sich auf das
                Fahrzeug, den Fehlerfall und technische Prüfinformationen
                beschränken.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                6. LocalStorage
              </h2>

              <p className="mt-4">
                DiagnoseHUB kann Daten im lokalen Speicher des Browsers
                speichern. Dazu gehören zum Beispiel Theme-Einstellungen,
                zwischengespeicherte Accountinformationen, Diagnosefälle,
                Nutzungsdaten oder aktuelle Arbeitsstände.
              </p>

              <p className="mt-4">
                Diese Daten verbleiben im Browser des Nutzers, bis sie gelöscht
                oder überschrieben werden. Nutzer können den lokalen Speicher
                über die Browser-Einstellungen entfernen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                7. Premium-Vormerkung
              </h2>

              <p className="mt-4">
                Wenn Nutzer eine Premium-Vormerkung absenden, werden die dabei
                eingegebenen Daten gespeichert. Dazu können Name, Werkstatt,
                E-Mail-Adresse, Telefonnummer, gewünschter Plan und eine
                freiwillige Notiz gehören.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                8. Speicherdauer
              </h2>

              <p className="mt-4">
                Personenbezogene Daten werden nur so lange gespeichert, wie es
                für die genannten Zwecke erforderlich ist oder gesetzliche
                Aufbewahrungspflichten bestehen. Nutzerbezogene Inhalte können
                gelöscht werden, wenn sie für die Nutzung nicht mehr benötigt
                werden oder der Nutzer die Löschung verlangt.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                9. Rechte der betroffenen Personen
              </h2>

              <p className="mt-4">
                Betroffene Personen haben im Rahmen der gesetzlichen Vorgaben
                insbesondere Rechte auf Auskunft, Berichtigung, Löschung,
                Einschränkung der Verarbeitung, Datenübertragbarkeit und
                Widerspruch.
              </p>

              <p className="mt-4">
                Anfragen können an die oben genannte Kontaktadresse gerichtet
                werden.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                10. Änderungen dieser Datenschutzerklärung
              </h2>

              <p className="mt-4">
                Diese Datenschutzerklärung kann angepasst werden, wenn sich
                Funktionen, eingesetzte Dienste oder rechtliche Anforderungen
                ändern.
              </p>

              <p className="mt-4 text-slate-500">
                Stand: &lt;Datum eintragen&gt;
              </p>
            </section>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}