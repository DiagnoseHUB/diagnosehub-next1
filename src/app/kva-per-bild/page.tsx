import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PartsMarketplaceClient from "@/components/PartsMarketplaceClient";

export const metadata = {
  title: "KVA per Bild | DiagnoseHUB",
  description:
    "KI-gestützte Bild-Kostenschätzung für Fahrzeugschäden mit Prüfhinweisen und grober Spanne.",
};

export default function KvaPerBildPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <PartsMarketplaceClient view="estimate" />
      </main>

      <Footer />
    </div>
  );
}
