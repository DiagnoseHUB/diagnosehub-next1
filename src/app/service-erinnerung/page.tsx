import Header from "@/components/Header";
import ServiceReminderClient from "@/components/ServiceReminderClient";

export const metadata = {
  title: "Service-Erinnerung | DiagnoseHUB",
  description:
    "Zentrale Erinnerungen für Hauptuntersuchung, AU, Hersteller-Service und Wartungsintervalle privater Fahrzeuge.",
};

export default function ServiceErinnerungPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <ServiceReminderClient />
      </main>
    </div>
  );
}
