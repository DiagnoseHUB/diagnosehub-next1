import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PartsMarketplaceClient from "@/components/PartsMarketplaceClient";

export const metadata = {
  title: "Teilemarkt | DiagnoseHUB",
  description:
    "Gebrauchtteile geprüfter Anbieter finden, einstellen und gezielt anfragen.",
};

export default function TeilemarktPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <PartsMarketplaceClient />
      </main>

      <Footer />
    </div>
  );
}
