import Footer from "@/components/Footer";
import Header from "@/components/Header";
import TorqueSpecManager from "@/components/TorqueSpecManager";

export const metadata = {
  title: "Drehmomente | DiagnoseHUB",
  description:
    "Gemeinsame Drehmoment-Datenbank mit Entwürfen, manueller Freigabe und automatischer Nutzung in Diagnosen.",
};

export default function DrehmomentePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <TorqueSpecManager />
      </main>

      <Footer />
    </div>
  );
}
