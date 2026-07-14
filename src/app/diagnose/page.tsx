import Footer from "@/components/Footer";
import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";

export default function DiagnosePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-8">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-blue-700 dark:text-blue-300">
            Diagnose
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
            Diagnose oder Anleitung starten.
          </h1>
          <p className="mt-4 max-w-3xl leading-8 text-slate-600 dark:text-slate-300">
            Gib Fahrzeugdaten, Fehlercode, Symptom, Messwerte oder eine konkrete
            Arbeit ein. DiagnoseHUB erkennt, ob du einen Prüfplan oder eine
            Anleitung brauchst.
          </p>
        </section>

        <SearchBar />
      </main>

      <Footer />
    </div>
  );
}
