import Header from "@/components/Header";
import LearningQuizClient from "@/components/LearningQuizClient";

export const dynamic = "force-dynamic";

export default function LearningQuizPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-6xl">
          <LearningQuizClient />
        </section>
      </main>
    </div>
  );
}