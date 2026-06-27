import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
                Angaben zum Anbieter
              </h2>

              <div className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-yellow-100">
                <p className="font-bold">Vor Livegang ausfüllen</p>
                <p className="mt-2">
                  Diese Seite ist ein technischer Beta-Platzhalter. Ersetze die
                  Platzhalter vor Veröffentlichung durch deine echten
                  Anbieterangaben.
                </p>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p className="font-semibold text-white">
                  &lt;Vollständiger Name / Firmenname&gt;
                </p>
                <p>&lt;Straße und Hausnummer&gt;</p>
                <p>&lt;PLZ und Ort&gt;</p>
                <p>Deutschland</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">Kontakt</h2>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p>
                  E-Mail:{" "}
                  <span className="font-semibold text-white">
                    &lt;deine-email@domain.de&gt;
                  </span>
                </p>
                <p>
                  Telefon:{" "}
                  <span className="font-semibold text-white">
                    &lt;optional / falls gewünscht&gt;
                  </span>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                Verantwortlich für den Inhalt
              </h2>

              <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p>&lt;Vollständiger Name&gt;</p>
                <p>&lt;Anschrift wie oben&gt;</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                Hinweis zur Beta-Version
              </h2>

              <p className="mt-4">
                DiagnoseHUB befindet sich aktuell in einer technischen
                Beta-Phase. Die Plattform dient der digitalen Unterstützung bei
                Kfz-Diagnose, Dokumentation und späteren Lernfunktionen.
              </p>

              <p className="mt-4">
                Die bereitgestellten Inhalte ersetzen keine eigene fachliche
                Prüfung am Fahrzeug und keine Herstellerinformationen,
                Reparaturanleitungen oder gesetzlichen Prüfvorgaben.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                Haftung für Inhalte
              </h2>

              <p className="mt-4">
                Die Inhalte dieser Seite wurden mit größter Sorgfalt erstellt.
                Für Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann
                jedoch keine Gewähr übernommen werden.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">
                Haftung für Links
              </h2>

              <p className="mt-4">
                Diese Website kann Links zu externen Webseiten enthalten. Auf
                deren Inhalte besteht kein Einfluss. Für fremde Inhalte ist
                stets der jeweilige Anbieter oder Betreiber der verlinkten
                Seiten verantwortlich.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white">Urheberrecht</h2>

              <p className="mt-4">
                Die durch den Seitenbetreiber erstellten Inhalte und Werke auf
                dieser Website unterliegen dem deutschen Urheberrecht. Beiträge
                Dritter werden als solche gekennzeichnet.
              </p>
            </section>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}