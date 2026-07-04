import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Impressum | DiagnoseHUB",
  description: "Impressum und Anbieterkennzeichnung von DiagnoseHUB.",
};

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-14">
        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-blue-950/30">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-blue-400">
            DiagnoseHUB
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
            Impressum
          </h1>

          <div className="mt-8 space-y-8 leading-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-bold text-white">
                Angaben gemaeß § 5 DDG
              </h2>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p className="font-semibold text-white">DiagnoseHUB</p>
                <p>Lukas Lettenmeier</p>
                <p>Einzelunternehmen</p>
                <p>Ringstraße 18</p>
                <p>86733 Alerheim</p>
                <p>Deutschland</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">Kontakt</h2>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p>
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
                Umsatzsteuer
              </h2>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p>
                  Kleinunternehmer gemaeß § 19 UStG. Eine Umsatzsteuer-ID ist
                  derzeit nicht vorhanden.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
              </h2>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p>Lukas Lettenmeier</p>
                <p>Ringstraße 18</p>
                <p>86733 Alerheim</p>
                <p>Deutschland</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                Hinweis zur Beta-Version
              </h2>

              <p className="mt-4">
                DiagnoseHUB befindet sich aktuell in einer technischen
                Beta-Phase. Die Plattform dient der digitalen Unterstuetzung bei
                Kfz-Diagnose, Dokumentation und Lernfunktionen.
              </p>

              <p className="mt-4">
                Die bereitgestellten Inhalte ersetzen keine eigene fachliche
                Prüfung am Fahrzeug, keine Herstellerinformationen, keine
                Reparaturanleitungen des Herstellers und keine gesetzlichen
                Prüfvorgaben. Die Verantwortung für Diagnose, Messung,
                Reparaturentscheidung und Arbeitssicherheit bleibt beim
                ausführenden Fachbetrieb.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                Haftung für Inhalte
              </h2>

              <p className="mt-4">
                Die Inhalte dieser Website werden mit groeßtmöglicher Sorgfalt
                erstellt. Für Richtigkeit, Vollständigkeit und Aktualitaet der
                Inhalte kann jedoch keine Gewähr uebernommen werden.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                Haftung für Links
              </h2>

              <p className="mt-4">
                Diese Website kann Links zu externen Webseiten Dritter
                enthalten. Auf deren Inhalte besteht kein Einfluss. Für die
                Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter
                oder Betreiber verantwortlich.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">Urheberrecht</h2>

              <p className="mt-4">
                Die durch den Seitenbetreiber erstellten Inhalte und Werke auf
                dieser Website unterliegen dem deutschen Urheberrecht. Beitraege
                Dritter werden als solche gekennzeichnet. Eine Vervielfaeltigung,
                Bearbeitung, Verbreitung oder sonstige Verwertung außerhalb der
                Grenzen des Urheberrechts bedarf der vorherigen schriftlichen
                Zustimmung des jeweiligen Rechteinhabers.
              </p>
            </section>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
