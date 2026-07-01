import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import {
  loadLearningLessonBySlug,
  loadLearningModuleBySlug,
} from "@/lib/supabase/learningStorage";
import type {
  LearningContentBlock,
  LearningDifficulty,
  LearningLessonDetail,
  LearningModuleDetail,
} from "@/types/learning";

export const dynamic = "force-dynamic";

function getDifficultyLabel(difficulty: LearningDifficulty) {
  if (difficulty === "basic") return "Grundlage";
  if (difficulty === "intermediate") return "Fortgeschritten";
  return "Experte";
}

function getPlanLabel(plan: string) {
  if (plan === "free") return "Free";
  if (plan === "werkstatt") return "Werkstatt";
  if (plan === "pro") return "Pro";
  return plan;
}

function renderContentBlock(block: LearningContentBlock, index: number) {
  if (block.type === "list") {
    return (
      <div
        key={`${block.type}-${index}`}
        className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70"
      >
        {block.title && (
          <h3 className="text-xl font-black text-slate-950 dark:text-slate-100">
            {block.title}
          </h3>
        )}

        <ul className="mt-4 space-y-3 text-slate-700 dark:text-slate-300">
          {(block.items || []).map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              <span className="leading-7">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (block.type === "warning") {
    return (
      <div
        key={`${block.type}-${index}`}
        className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-yellow-950 dark:text-yellow-100"
      >
        {block.title && <h3 className="text-xl font-black">{block.title}</h3>}

        {block.content && (
          <p className="mt-3 leading-7">{block.content}</p>
        )}
      </div>
    );
  }

  return (
    <div
      key={`${block.type}-${index}`}
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/80"
    >
      {block.title && (
        <h3 className="text-xl font-black text-slate-950 dark:text-slate-100">
          {block.title}
        </h3>
      )}

      {block.content && (
        <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700 dark:text-slate-300">
          {block.content}
        </p>
      )}
    </div>
  );
}

function AccessBox({ requiredPlan }: { requiredPlan: string }) {
  return (
    <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-yellow-950 dark:text-yellow-100">
      <h2 className="text-xl font-black">Lerninhalt gesperrt</h2>

      <p className="mt-3 leading-7">
        Dieser Inhalt benötigt mindestens den Plan{" "}
        <strong>{getPlanLabel(requiredPlan)}</strong>. Für Testwerkstätten kann
        der Zugang später kostenlos über Supabase freigeschaltet werden.
      </p>

      <Link
        href="/billing"
        className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
      >
        Pro aktivieren
      </Link>
    </div>
  );
}

function ModulePage({ detail }: { detail: LearningModuleDetail }) {
  const { category, module, lessons, hasAccess } = detail;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-6xl">
          <Link
            href="/lernen"
            className="text-sm font-bold text-blue-700 hover:text-blue-500 dark:text-blue-400"
          >
            ← Zur Lernplattform
          </Link>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                {category.title}
              </span>

              <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {getDifficultyLabel(module.difficulty)}
              </span>

              <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {getPlanLabel(module.requiredPlan)}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
              {module.title}
            </h1>

            {module.subtitle && (
              <p className="mt-3 text-xl font-bold text-slate-700 dark:text-slate-300">
                {module.subtitle}
              </p>
            )}

            <p className="mt-5 max-w-4xl leading-7 text-slate-700 dark:text-slate-300">
              {module.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                ca. {module.estimatedMinutes} Min.
              </span>

              {module.relatedFaultCodes.map((code) => (
                <span
                  key={code}
                  className="rounded-full bg-blue-500/10 px-3 py-1 text-sm font-bold text-blue-700 dark:text-blue-300"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>

          {!hasAccess && (
            <div className="mt-6">
              <AccessBox requiredPlan={module.requiredPlan} />
            </div>
          )}

          <section className="mt-8">
            <h2 className="text-2xl font-black text-slate-950 dark:text-slate-100">
              Lektionen
            </h2>

            <div className="mt-5 grid gap-4">
              {lessons.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  Noch keine veröffentlichten Lektionen vorhanden.
                </div>
              ) : (
                lessons.map((lesson, index) => (
                  <Link
                    key={lesson.id}
                    href={`/lernen/${lesson.slug}`}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-blue-500 dark:hover:bg-blue-950/30"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-400">
                          Lektion {index + 1}
                        </p>

                        <h3 className="mt-1 text-xl font-black text-slate-950 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
                          {lesson.title}
                        </h3>

                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                          {lesson.summary || lesson.subtitle}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {lesson.estimatedMinutes} Min.
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {getPlanLabel(lesson.requiredPlan)}
                        </span>

                        {lesson.isLocked && (
                          <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-700 dark:text-yellow-300">
                            Gesperrt
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function LessonPage({ detail }: { detail: LearningLessonDetail }) {
  const { category, module, lesson, hasAccess } = detail;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-5xl">
          <Link
            href={`/lernen/${module.slug}`}
            className="text-sm font-bold text-blue-700 hover:text-blue-500 dark:text-blue-400"
          >
            ← Zurück zum Modul
          </Link>

          <header className="mt-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                {category.title}
              </span>

              <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {module.title}
              </span>

              <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {getDifficultyLabel(lesson.difficulty)}
              </span>

              <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {getPlanLabel(lesson.requiredPlan)}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
              {lesson.title}
            </h1>

            {lesson.subtitle && (
              <p className="mt-3 text-xl font-bold text-slate-700 dark:text-slate-300">
                {lesson.subtitle}
              </p>
            )}

            <p className="mt-5 leading-7 text-slate-700 dark:text-slate-300">
              {lesson.summary}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                ca. {lesson.estimatedMinutes} Min.
              </span>

              {lesson.relatedFaultCodes.map((code) => (
                <span
                  key={code}
                  className="rounded-full bg-blue-500/10 px-3 py-1 text-sm font-bold text-blue-700 dark:text-blue-300"
                >
                  {code}
                </span>
              ))}
            </div>
          </header>

          {!hasAccess ? (
            <div className="mt-6">
              <AccessBox requiredPlan={lesson.requiredPlan} />
            </div>
          ) : (
            <>
              <section className="mt-8 space-y-5">
                {lesson.contentBlocks.map(renderContentBlock)}
              </section>

              {lesson.checklist.length > 0 && (
                <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/80">
                  <h2 className="text-2xl font-black text-slate-950 dark:text-slate-100">
                    Werkstatt-Checkliste
                  </h2>

                  <ol className="mt-5 space-y-3">
                    {lesson.checklist.map((item, index) => (
                      <li
                        key={item}
                        className="flex gap-3 text-slate-700 dark:text-slate-300"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
                          {index + 1}
                        </span>

                        <span className="leading-7">{item}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {lesson.quizQuestions.length > 0 && (
                <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/80">
                  <h2 className="text-2xl font-black text-slate-950 dark:text-slate-100">
                    Quiz vorbereitet
                  </h2>

                  <div className="mt-5 space-y-4">
                    {lesson.quizQuestions.map((quiz, index) => (
                      <div
                        key={`${quiz.question}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70"
                      >
                        <p className="font-black text-slate-950 dark:text-slate-100">
                          {index + 1}. {quiz.question}
                        </p>

                        <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                          {quiz.answers.map((answer, answerIndex) => (
                            <li
                              key={answer}
                              className={
                                answerIndex === quiz.correctIndex
                                  ? "rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 font-bold text-green-700 dark:text-green-300"
                                  : "rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
                              }
                            >
                              {answer}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </article>
      </main>
    </div>
  );
}

export default async function LearningSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const moduleDetail = await loadLearningModuleBySlug(slug, "free");

  if (moduleDetail) {
    return <ModulePage detail={moduleDetail} />;
  }

  const lessonDetail = await loadLearningLessonBySlug(slug, "free");

  if (lessonDetail) {
    return <LessonPage detail={lessonDetail} />;
  }

  notFound();
}