import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PartsMarketplaceClient from "@/components/PartsMarketplaceClient";

export const metadata = {
  title: "Forum | DiagnoseHUB",
  description:
    "Diagnoseforum mit Fachfragen, Antworten, bestätigten Lösungen und Rollen für Azubis, Gesellen und Meister.",
};

export default function ForumPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <PartsMarketplaceClient view="forum" />
      </main>

      <Footer />
    </div>
  );
}
