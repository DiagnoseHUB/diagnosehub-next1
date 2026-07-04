import Header from "@/components/Header";
import JourneymanExamClient from "@/components/JourneymanExamClient";
import { JOURNEYMAN_EXAMS } from "@/data/journeymanExams";

export const metadata = {
  title: "Gesellenprüfung Teil 1 & 2 | DiagnoseHUB",
  description:
    "Realistische Trainingsprüfungen für Kfz-Gesellenprüfung Teil 1 und Teil 2.",
};

export const dynamic = "force-dynamic";

function createInitialExamSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

export default function GesellenprüfungPage() {
  const initialSeed = createInitialExamSeed();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-6xl">
          <JourneymanExamClient
            exams={JOURNEYMAN_EXAMS}
            initialSeed={initialSeed}
          />
        </section>
      </main>
    </div>
  );
}
