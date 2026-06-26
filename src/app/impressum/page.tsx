import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-20">
        <div className="mb-10">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-400">
            Rechtliches
          </p>

          <h1 className="text-5xl font-bold">Impressum</h1>

          <p className="mt-5 leading-8 text-slate-400">
            Diese Seite ist ein Platzhalter. Vor der Veröffentlichung müssen die
            Angaben vollständig und korrekt ergänzt werden.
          </p>
        </div>

        <section className="space-y-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
          <div>
            <h2 className="text-2xl font-bold">Angaben gemäß Impressumspflicht</h2>

            <div className="mt-4 leading-8 text-slate-400">
              <p>DiagnoseHUB</p>
              <p>Inhaber / Verantwortlicher: [Name ergänzen]</p>
              <p>Straße und Hausnummer: [ergänzen]</p>
              <p>PLZ und Ort: [ergänzen]</p>
              <p>Deutschland</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold">Kontakt</h2>

            <div className="mt-4 leading-8 text-slate-400">
              <p>Telefon: [ergänzen]</p>
              <p>E-Mail: [ergänzen]</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold">Umsatzsteuer-ID</h2>

            <p className="mt-4 leading-8 text-slate-400">
              Umsatzsteuer-Identifikationsnummer gemäß § 27 a
              Umsatzsteuergesetz: [falls vorhanden ergänzen]
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold">Verantwortlich für den Inhalt</h2>

            <div className="mt-4 leading-8 text-slate-400">
              <p>[Name ergänzen]</p>
              <p>[Adresse ergänzen]</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold">Hinweis zur Fahrzeugdiagnose</h2>

            <p className="mt-4 leading-8 text-slate-400">
              DiagnoseHUB ist eine digitale Diagnosehilfe. Die bereitgestellten
              Informationen ersetzen keine fachgerechte Prüfung, Messung oder
              Reparaturentscheidung durch qualifiziertes Fachpersonal.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}