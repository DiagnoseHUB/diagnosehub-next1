import Footer from "@/components/Footer";
import Header from "@/components/Header";
import SignalLibraryClient from "@/components/SignalLibraryClient";

export const metadata = {
  title: "Oszilloskop- und Signalbibliothek | DiagnoseHUB",
  description:
    "Referenzsignale, Messaufbau, Gutbilder und typische Fehlerbilder für Kfz-Oszilloskopmessungen.",
};

export default function SignalePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <SignalLibraryClient />
      </main>

      <Footer />
    </div>
  );
}
