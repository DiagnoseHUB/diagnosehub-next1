import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Datenschutz | DiagnoseHUB",
  description: "Datenschutzerklärung von DiagnoseHUB.",
};

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

          <p className="mt-4 text-sm text-slate-400">Stand: 04.07.2026</p>

          <div className="mt-8 space-y-8 leading-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-bold text-white">
                1. Verantwortlicher
              </h2>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p className="font-semibold text-white">DiagnoseHUB</p>
                <p>Lukas Lettenmeier</p>
                <p>Ringstraße 18</p>
                <p>86733 Alerheim</p>
                <p>Deutschland</p>
                <p className="mt-3">
                  E-Mail:{" "}
                  <a
                    href="mailto:info@diagnosehub.de"
                    className="font-semibold text-blue-300 transition hover:text-blue-200"
                  >
                    info@diagnosehub.de
                  </a>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                2. Allgemeine Hinweise
              </h2>

              <p className="mt-4">
                Wir verarbeiten personenbezogene Daten nur, soweit dies für den
                Betrieb von DiagnoseHUB, die Bereitstellung der Funktionen, die
                Vertragsabwicklung, die Sicherheit der Plattform oder aufgrund
                gesetzlicher Pflichten erforderlich ist.
              </p>

              <p className="mt-4">
                DiagnoseHUB richtet sich an Kfz-Werkstätten, Kfz-Fachpersonal
                und Nutzer im beruflichen oder ausbildungsbezogenen Umfeld. Bitte
                gib in Diagnosefällen keine unnötigen personenbezogenen Daten von
                Kunden, Mitarbeitern oder sonstigen Dritten ein.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                3. Hosting und technische Bereitstellung
              </h2>

              <p className="mt-4">
                Die Website wird über Vercel bereitgestellt. Beim Aufruf der
                Website können technisch erforderliche Daten verarbeitet werden,
                insbesondere IP-Adresse, Datum und Uhrzeit des Zugriffs,
                aufgerufene Seiten, Browser- und Geräteinformationen,
                Referrer-URL und technische Logdaten.
              </p>

              <p className="mt-4">
                Die Verarbeitung erfolgt zur sicheren und stabilen Bereitstellung
                der Website, zur Fehleranalyse und zur Abwehr von Angriffen. Die
                Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser
                berechtigtes Interesse liegt im sicheren und zuverlässigen
                Betrieb der Plattform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                4. Domain, E-Mail und technische Infrastruktur
              </h2>

              <p className="mt-4">
                Die Domain und E-Mail-Infrastruktur werden über ALL-INKL
                beziehungsweise Kasserver betrieben. Bei der Kontaktaufnahme per
                E-Mail werden die von dir übermittelten Daten verarbeitet,
                insbesondere E-Mail-Adresse, Inhalt der Nachricht, Zeitpunkt und
                technische Versandinformationen.
              </p>

              <p className="mt-4">
                Die Verarbeitung erfolgt zur Bearbeitung deiner Anfrage. Je nach
                Inhalt der Anfrage ist die Rechtsgrundlage Art. 6 Abs. 1 lit. b
                DSGVO oder Art. 6 Abs. 1 lit. f DSGVO.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                5. Registrierung, Login und Nutzerkonto
              </h2>

              <p className="mt-4">
                Für Login, Authentifizierung, Nutzerprofile und Datenbankfunktionen
                nutzen wir Supabase. Dabei können insbesondere E-Mail-Adresse,
                Nutzer-ID, Login-Status, Werkstattprofil, Tarifstatus,
                gespeicherte Diagnosefälle, Nutzungszähler und technische
                Metadaten verarbeitet werden.
              </p>

              <p className="mt-4">
                Die Verarbeitung erfolgt zur Bereitstellung deines Kontos und der
                gebuchten oder kostenlosen Funktionen. Rechtsgrundlage ist Art. 6
                Abs. 1 lit. b DSGVO. Soweit die Verarbeitung der Sicherheit,
                Missbrauchsverhinderung oder Fehleranalyse dient, erfolgt sie auf
                Grundlage von Art. 6 Abs. 1 lit. f DSGVO.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                6. KI-Diagnose, Anleitungen und Bauteilwissen
              </h2>

              <p className="mt-4">
                Wenn du DiagnoseHUB nutzt, werden deine Eingaben verarbeitet, um
                technische Antworten, Diagnosehinweise, Prüfschritte,
                Anleitungen oder Lerninhalte zu erstellen. Dazu können unter
                anderem Fahrzeugdaten, Motorcodes, Fehlercodes, Symptome,
                Messwerte, eigene Notizen und Folgefragen gehören.
              </p>

              <p className="mt-4">
                Zur Erzeugung der KI-Antworten nutzen wir OpenAI. Die für die
                Antwort erforderlichen Eingaben werden an OpenAI übermittelt und
                dort verarbeitet. Bitte gib keine Kundennamen, Kennzeichen,
                Telefonnummern, Adressen oder sonstige unnötige personenbezogene
                Daten in Diagnosefälle ein.
              </p>

              <p className="mt-4">
                Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit die
                Verarbeitung zur Nutzung der Plattform erforderlich ist.
                Zusätzlich besteht ein berechtigtes Interesse gemäß Art. 6 Abs. 1
                lit. f DSGVO an der technischen Bereitstellung, Verbesserung und
                Absicherung der Plattform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                7. Zahlungsabwicklung mit Stripe
              </h2>

              <p className="mt-4">
                Für kostenpflichtige Tarife und Abonnements nutzen wir Stripe.
                Wenn du einen kostenpflichtigen Tarif buchst, werden die für die
                Zahlungsabwicklung erforderlichen Daten an Stripe übermittelt
                oder direkt von Stripe erhoben. Dazu können Name,
                E-Mail-Adresse, Rechnungsdaten, Zahlungsdaten, Kundennummer,
                Abo-Status, Transaktionsdaten und technische Zahlungsinformationen
                gehören.
              </p>

              <p className="mt-4">
                Zahlungsdaten wie vollständige Kreditkartennummern werden nicht
                von uns gespeichert, sondern durch Stripe verarbeitet. Die
                Verarbeitung erfolgt zur Vertragsdurchführung gemäß Art. 6 Abs. 1
                lit. b DSGVO sowie zur Erfüllung gesetzlicher Pflichten gemäß
                Art. 6 Abs. 1 lit. c DSGVO.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                8. Service-Erinnerungen per E-Mail
              </h2>

              <p className="mt-4">
                Wenn du die Service-Erinnerung aktivierst, verarbeiten wir deine
                gespeicherten Fahrzeugdaten, Fälligkeiten, Kilometerstände und
                die E-Mail-Adresse deines Nutzerkontos, um dich automatisch an
                Hauptuntersuchung, AU, Hersteller-Service und Wartungspunkte zu
                erinnern.
              </p>

              <p className="mt-4">
                Die E-Mails sind sachliche Funktionsmails und enthalten keine
                Werbung. Du kannst die E-Mail-Erinnerungen jederzeit in
                DiagnoseHUB deaktivieren oder über den Abmeldelink in jeder Mail
                abbestellen. Zur Vermeidung doppelter Erinnerungen speichern wir
                ein Versandprotokoll mit Erinnerungstyp, Fälligkeit, Empfänger
                und Versandzeitpunkt.
              </p>

              <p className="mt-4">
                Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit die
                Erinnerungen Bestandteil des gebuchten Service sind. Soweit du
                die Benachrichtigung freiwillig aktivierst, erfolgt die
                Verarbeitung zusätzlich auf Grundlage deiner Einwilligung gemäß
                Art. 6 Abs. 1 lit. a DSGVO; diese kannst du jederzeit mit Wirkung
                für die Zukunft widerrufen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                9. Cookies, Local Storage und technisch erforderliche Speicherung
              </h2>

              <p className="mt-4">
                DiagnoseHUB verwendet technisch erforderliche Speichermechanismen,
                insbesondere für Login-Sitzungen, Sicherheit, Theme-Einstellungen
                wie Hell-/Dunkelmodus, Tarifstatus und Nutzungsfunktionen. Dazu
                können Cookies oder Local Storage des Browsers verwendet werden.
              </p>

              <p className="mt-4">
                Diese Speicherung ist erforderlich, um die Plattform technisch zu
                betreiben und Nutzerfunktionen bereitzustellen. Rechtsgrundlage
                ist Art. 6 Abs. 1 lit. b DSGVO sowie Art. 6 Abs. 1 lit. f DSGVO.
              </p>

              <p className="mt-4">
                Derzeit setzen wir keine eigenen Tracking- oder Werbe-Cookies und
                nutzen keine externe Webanalyse wie Google Analytics.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                10. Empfaenger und eingesetzte Dienstleister
              </h2>

              <p className="mt-4">
                Zur Bereitstellung von DiagnoseHUB setzen wir insbesondere diese
                Dienstleister ein:
              </p>

              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>Vercel für Hosting und Auslieferung der Website,</li>
                <li>Supabase für Authentifizierung, Datenbank und Nutzerprofile,</li>
                <li>OpenAI für KI-Funktionen,</li>
                <li>Stripe für Zahlungsabwicklung und Abonnements,</li>
                <li>
                  Resend oder einen vergleichbaren E-Mail-Dienstleister für
                  automatisierte Service-Erinnerungen,
                </li>
                <li>ALL-INKL/Kasserver für Domain und E-Mail-Infrastruktur.</li>
              </ul>

              <p className="mt-4">
                Mit Dienstleistern, die personenbezogene Daten in unserem Auftrag
                verarbeiten, werden soweit erforderlich Vereinbarungen zur
                Auftragsverarbeitung abgeschlossen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                11. Drittlandübermittlungen
              </h2>

              <p className="mt-4">
                Einige eingesetzte Dienstleister können personenbezogene Daten in
                Ländern außerhalb der Europäischen Union oder des Europäischen
                Wirtschaftsraums verarbeiten, insbesondere in den USA. In diesen
                Fällen erfolgt die Verarbeitung auf Grundlage geeigneter
                Garantien, etwa Standardvertragsklauseln, Angemessenheitsbeschlüssen
                oder vergleichbaren vertraglichen und technischen Schutzmaßnahmen.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                12. Speicherdauer
              </h2>

              <p className="mt-4">
                Wir speichern personenbezogene Daten nur so lange, wie es für die
                jeweiligen Zwecke erforderlich ist. Kontodaten werden grundsätzlich
                für die Dauer des Nutzerkontos gespeichert. Gespeicherte
                Diagnosefälle bleiben erhalten, bis sie gelöscht werden oder das
                Konto gelöscht wird.
              </p>

              <p className="mt-4">
                Versandprotokolle für Service-Erinnerungen werden nur so lange
                gespeichert, wie sie zur Vermeidung doppelter Erinnerungen, zur
                Nachvollziehbarkeit des Dienstes und zur Fehleranalyse
                erforderlich sind.
              </p>

              <p className="mt-4">
                Zahlungs- und Rechnungsdaten werden entsprechend gesetzlicher
                handels- und steuerrechtlicher Aufbewahrungspflichten gespeichert.
                Technische Logdaten werden nur so lange gespeichert, wie dies für
                Betrieb, Sicherheit und Fehleranalyse erforderlich ist.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                13. Deine Rechte
              </h2>

              <p className="mt-4">
                Du hast nach Maßgabe der DSGVO insbesondere das Recht auf
                Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
                Datenübertragbarkeit und Widerspruch gegen bestimmte
                Verarbeitungen. Wenn eine Verarbeitung auf Einwilligung beruht,
                kannst du diese Einwilligung jederzeit mit Wirkung für die Zukunft
                widerrufen.
              </p>

              <p className="mt-4">
                Zur Ausübung deiner Rechte kannst du dich jederzeit an
                info@diagnosehub.de wenden.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                14. Beschwerderecht bei einer Aufsichtsbehörde
              </h2>

              <p className="mt-4">
                Du hast das Recht, dich bei einer Datenschutzaufsichtsbehörde zu
                beschweren, wenn du der Ansicht bist, dass die Verarbeitung deiner
                personenbezogenen Daten gegen Datenschutzrecht verstößt.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                15. Keine automatisierte Einzelentscheidung
              </h2>

              <p className="mt-4">
                Eine automatisierte Entscheidungsfindung im Sinne von Art. 22
                DSGVO findet nicht statt. KI-Antworten dienen lediglich als
                technische Unterstützung und ersetzen keine fachliche Entscheidung
                des Nutzers oder Fachbetriebs.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                16. Änderungen dieser Datenschutzerklärung
              </h2>

              <p className="mt-4">
                Wir können diese Datenschutzerklärung anpassen, wenn sich die
                Plattform, eingesetzte Dienstleister oder rechtliche Anforderungen
                ändern. Es gilt die jeweils auf dieser Website veröffentlichte
                Fassung.
              </p>
            </section>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
