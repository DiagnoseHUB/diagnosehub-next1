"use client";

import { useMemo, useState } from "react";
import type {
  ExamCaseTask,
  ExamPartId,
  ExamQuestion,
  JourneymanExam,
} from "@/data/journeymanExams";

type JourneymanExamClientProps = {
  exams: JourneymanExam[];
  initialSeed: number;
};

type ExamRun = {
  seed: number;
  questions: ExamQuestion[];
  caseTasks: ExamCaseTask[];
};

type CaseEvaluation = {
  points: number;
  maxPoints: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  matchedExpectedPoints: string[];
  missingExpectedPoints: string[];
};

type CaseEvaluationApiResponse = {
  evaluation?: CaseEvaluation;
  error?: string;
};

type SavedExamResult = {
  examId: ExamPartId;
  score: number;
  maxScore: number;
  percent: number;
  gradeLabel: string;
  completedAt: string;
};

type SavedExamStore = Record<ExamPartId, SavedExamResult[]>;

const EXAM_RESULTS_STORAGE_KEY = "diagnosehub-gesellenprüfung-results-v1";

function readSavedResults(): SavedExamStore {
  if (typeof window === "undefined") {
    return {
      "teil-1": [],
      "teil-2": [],
    };
  }

  const rawValue = window.localStorage.getItem(EXAM_RESULTS_STORAGE_KEY);

  if (!rawValue) {
    return {
      "teil-1": [],
      "teil-2": [],
    };
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<SavedExamStore>;

    return {
      "teil-1": Array.isArray(parsed["teil-1"]) ? parsed["teil-1"] : [],
      "teil-2": Array.isArray(parsed["teil-2"]) ? parsed["teil-2"] : [],
    };
  } catch {
    return {
      "teil-1": [],
      "teil-2": [],
    };
  }
}

function writeSavedResults(store: SavedExamStore) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(EXAM_RESULTS_STORAGE_KEY, JSON.stringify(store));
}

function createSeededRandom(seed: number) {
  let currentValue = seed || 1;

  return () => {
    currentValue = (currentValue * 1664525 + 1013904223) % 4294967296;
    return currentValue / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: number) {
  const random = createSeededRandom(seed);
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(random() * (index + 1));
    [shuffledItems[index], shuffledItems[targetIndex]] = [
      shuffledItems[targetIndex],
      shuffledItems[index],
    ];
  }

  return shuffledItems;
}

function createExamRun(exam: JourneymanExam, seed: number): ExamRun {
  return {
    seed,
    questions: shuffleWithSeed(exam.questions, seed).slice(
      0,
      Math.min(exam.questionPickCount, exam.questions.length),
    ),
    caseTasks: shuffleWithSeed(exam.caseTasks, seed + 97).slice(
      0,
      Math.min(exam.caseTaskPickCount, exam.caseTasks.length),
    ),
  };
}

function normalizeSelection(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function isSelectionCorrect(selected: number[], correct: number[]) {
  const normalizedSelected = normalizeSelection(selected);
  const normalizedCorrect = normalizeSelection(correct);

  return (
    normalizedSelected.length === normalizedCorrect.length &&
    normalizedSelected.every((value, index) => value === normalizedCorrect[index])
  );
}

function getGradeLabel(percent: number) {
  if (percent >= 92) return "sehr gut";
  if (percent >= 81) return "gut";
  if (percent >= 67) return "befriedigend";
  if (percent >= 50) return "ausreichend";
  if (percent >= 30) return "mangelhaft";
  return "ungenuegend";
}

function getExamScore(
  examRun: ExamRun,
  selectedAnswers: Record<string, number[]>,
  caseEvaluations: Record<string, CaseEvaluation>,
) {
  const questionScore = examRun.questions.reduce((sum, question) => {
    const selected = selectedAnswers[question.id] || [];

    return isSelectionCorrect(selected, question.correctAnswerIndexes)
      ? sum + question.points
      : sum;
  }, 0);

  const caseScore = examRun.caseTasks.reduce((sum, task) => {
    return sum + (caseEvaluations[task.id]?.points || 0);
  }, 0);

  return questionScore + caseScore;
}

function getExamMaxScore(examRun: ExamRun) {
  return (
    examRun.questions.reduce((sum, question) => sum + question.points, 0) +
    examRun.caseTasks.reduce((sum, task) => sum + task.points, 0)
  );
}

function createClientSeed() {
  return Date.now() + Math.floor(Math.random() * 100000);
}

export default function JourneymanExamClient({
  exams,
  initialSeed,
}: JourneymanExamClientProps) {
  const [activeExamId, setActiveExamId] = useState<ExamPartId>("teil-1");
  const initialExam = exams[0];
  const [examRun, setExamRun] = useState<ExamRun>(() =>
    createExamRun(initialExam, initialSeed),
  );
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number[]>>({});
  const [caseAnswers, setCaseAnswers] = useState<Record<string, string>>({});
  const [caseEvaluations, setCaseEvaluations] = useState<
    Record<string, CaseEvaluation>
  >({});
  const [caseErrors, setCaseErrors] = useState<Record<string, string>>({});
  const [gradingTaskId, setGradingTaskId] = useState("");
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [savedResults, setSavedResults] = useState<SavedExamStore>(() =>
    readSavedResults(),
  );

  const activeExam = useMemo(() => {
    return exams.find((exam) => exam.id === activeExamId) || exams[0];
  }, [activeExamId, exams]);

  const maxScore = getExamMaxScore(examRun);
  const score = getExamScore(examRun, selectedAnswers, caseEvaluations);
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const gradeLabel = getGradeLabel(percent);
  const lastResult = savedResults[activeExam.id]?.[0];
  const evaluatedCaseCount = examRun.caseTasks.filter(
    (task) => caseEvaluations[task.id],
  ).length;

  function clearRunState(nextExam: JourneymanExam, seed: number) {
    setExamRun(createExamRun(nextExam, seed));
    setSelectedAnswers({});
    setCaseAnswers({});
    setCaseEvaluations({});
    setCaseErrors({});
    setGradingTaskId("");
    setShowEvaluation(false);
  }

  function switchExam(examId: ExamPartId) {
    const nextExam = exams.find((exam) => exam.id === examId) || exams[0];

    setActiveExamId(examId);
    clearRunState(nextExam, createClientSeed());
  }

  function selectAnswer(question: ExamQuestion, answerIndex: number) {
    setSelectedAnswers((currentValues) => {
      const currentSelection = currentValues[question.id] || [];

      if (question.type === "multiple_choice") {
        const nextSelection = currentSelection.includes(answerIndex)
          ? currentSelection.filter((value) => value !== answerIndex)
          : [...currentSelection, answerIndex];

        return {
          ...currentValues,
          [question.id]: normalizeSelection(nextSelection),
        };
      }

      return {
        ...currentValues,
        [question.id]: [answerIndex],
      };
    });
  }

  async function gradeCaseTask(task: ExamCaseTask) {
    const answer = (caseAnswers[task.id] || "").trim();

    setCaseErrors((currentValues) => ({
      ...currentValues,
      [task.id]: "",
    }));

    if (answer.length < 40) {
      setCaseErrors((currentValues) => ({
        ...currentValues,
        [task.id]:
          "Bitte schreibe erst eine fachliche Antwort mit mehreren konkreten Prüfschritten.",
      }));
      return;
    }

    setGradingTaskId(task.id);

    try {
      const response = await fetch(
        "/api/lernen/gesellenprüfung/fallbewertung",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            examTitle: activeExam.title,
            taskTitle: task.title,
            prompt: task.prompt,
            expectedPoints: task.expectedPoints,
            maxPoints: task.points,
            answer,
          }),
        },
      );
      const data = (await response.json()) as CaseEvaluationApiResponse;

      if (!response.ok || !data.evaluation) {
        throw new Error(data.error || "Fallaufgabe konnte nicht bewertet werden.");
      }

      setCaseEvaluations((currentValues) => ({
        ...currentValues,
        [task.id]: data.evaluation!,
      }));
    } catch (error) {
      setCaseErrors((currentValues) => ({
        ...currentValues,
        [task.id]:
          error instanceof Error
            ? error.message
            : "Fallaufgabe konnte nicht bewertet werden.",
      }));
    } finally {
      setGradingTaskId("");
    }
  }

  function saveResult() {
    const result: SavedExamResult = {
      examId: activeExam.id,
      score,
      maxScore,
      percent,
      gradeLabel,
      completedAt: new Date().toISOString(),
    };
    const nextStore = {
      ...savedResults,
      [activeExam.id]: [result, ...(savedResults[activeExam.id] || [])].slice(0, 5),
    };

    setSavedResults(nextStore);
    writeSavedResults(nextStore);
  }

  function resetExam() {
    clearRunState(activeExam, createClientSeed());
  }

  return (
    <div>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Gesellenprüfung Training
        </p>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
              Teil 1 & Teil 2 realistisch üben
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400 sm:text-base">
              Jeder Durchlauf zieht neue Fragen aus dem Pool. Fallaufgaben
              beantwortest du frei im Textfeld und lässt sie anschließend von
              der KI mit Punkten und Feedback bewerten.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {exams.map((exam) => (
              <button
                key={exam.id}
                type="button"
                onClick={() => switchExam(exam.id)}
                className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                  activeExam.id === exam.id
                    ? "bg-blue-600 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {exam.id === "teil-1" ? "Teil 1" : "Teil 2"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
              {activeExam.title}
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">
              {activeExam.subtitle}
            </h2>

            <p className="mt-4 max-w-4xl rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              {activeExam.scenario}
            </p>
          </div>

          <div className="grid min-w-64 grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
              <p className="text-2xl font-black text-slate-950 dark:text-slate-100">
                {examRun.questions.length}
              </p>
              <p className="text-xs font-bold text-slate-500">Fragen</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
              <p className="text-2xl font-black text-slate-950 dark:text-slate-100">
                {maxScore}
              </p>
              <p className="text-xs font-bold text-slate-500">Punkte</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {activeExam.competenceAreas.map((area) => (
            <span
              key={area}
              className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300"
            >
              {area}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-5">
        {examRun.questions.map((question, questionIndex) => {
          const selected = selectedAnswers[question.id] || [];
          const isCorrect = isSelectionCorrect(
            selected,
            question.correctAnswerIndexes,
          );

          return (
            <article
              key={question.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
            >
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  Aufgabe {questionIndex + 1}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {question.area}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {question.points} Punkte
                </span>
              </div>

              <h3 className="mt-4 text-xl font-black leading-8 text-slate-950 dark:text-slate-100">
                {question.question}
              </h3>

              <div className="mt-5 grid gap-3">
                {question.answers.map((answer, answerIndex) => {
                  const isSelected = selected.includes(answerIndex);
                  const isCorrectAnswer =
                    question.correctAnswerIndexes.includes(answerIndex);

                  let className =
                    "w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition";

                  if (showEvaluation && isCorrectAnswer) {
                    className +=
                      " border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300";
                  } else if (showEvaluation && isSelected && !isCorrectAnswer) {
                    className +=
                      " border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
                  } else if (isSelected) {
                    className +=
                      " border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300";
                  } else {
                    className +=
                      " border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-blue-950/30";
                  }

                  return (
                    <button
                      key={`${question.id}-${answerIndex}`}
                      type="button"
                      onClick={() => selectAnswer(question, answerIndex)}
                      className={className}
                    >
                      <span className="mr-2 font-black">
                        {String.fromCharCode(65 + answerIndex)}.
                      </span>
                      {answer}
                    </button>
                  );
                })}
              </div>

              {showEvaluation && (
                <div
                  className={`mt-5 rounded-2xl border p-4 text-sm leading-6 ${
                    isCorrect
                      ? "border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-200"
                      : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200"
                  }`}
                >
                  <p className="font-black">
                    {isCorrect ? "Voll richtig." : "Noch nicht korrekt."}
                  </p>
                  <p className="mt-2">{question.explanation}</p>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="mt-6 grid gap-5">
        {examRun.caseTasks.map((task, index) => {
          const evaluation = caseEvaluations[task.id];
          const error = caseErrors[task.id];

          return (
            <article
              key={task.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
            >
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-yellow-800 dark:text-yellow-300">
                  Fallaufgabe {index + 1}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {task.points} Punkte
                </span>
                {evaluation && (
                  <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-green-700 dark:text-green-300">
                    KI: {evaluation.points} / {task.points}
                  </span>
                )}
              </div>

              <h3 className="mt-4 text-xl font-black text-slate-950 dark:text-slate-100">
                {task.title}
              </h3>
              <p className="mt-3 leading-7 text-slate-700 dark:text-slate-300">
                {task.prompt}
              </p>

              <label className="mt-5 grid gap-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Deine Antwort
                </span>
                <textarea
                  value={caseAnswers[task.id] || ""}
                  onChange={(event) =>
                    setCaseAnswers((currentValues) => ({
                      ...currentValues,
                      [task.id]: event.target.value,
                    }))
                  }
                  rows={8}
                  placeholder="Beschreibe deinen Prüfplan, Messungen, mögliche Ursache, Reparaturentscheidung und Abschlussprüfung..."
                  className="min-h-44 rounded-2xl border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void gradeCaseTask(task)}
                  disabled={gradingTaskId === task.id}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {gradingTaskId === task.id
                    ? "KI bewertet..."
                    : "Mit KI bewerten"}
                </button>

                {evaluation && (
                  <button
                    type="button"
                    onClick={() =>
                      setCaseEvaluations((currentValues) => {
                        const nextValues = { ...currentValues };
                        delete nextValues[task.id];
                        return nextValues;
                      })
                    }
                    className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Bewertung zurücksetzen
                  </button>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              {evaluation && (
                <div className="mt-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm leading-6 text-green-900 dark:text-green-100">
                  <p className="text-lg font-black">
                    {evaluation.points} / {task.points} Punkte
                  </p>
                  <p className="mt-2">{evaluation.feedback}</p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="font-black">Gut getroffen</p>
                      <ul className="mt-2 space-y-1">
                        {evaluation.strengths.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-black">Für mehr Punkte</p>
                      <ul className="mt-2 space-y-1">
                        {evaluation.improvements.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {showEvaluation && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="font-black text-slate-950 dark:text-slate-100">
                    Erwartungshorizont
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    {task.expectedPoints.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950 dark:text-slate-100">
              Auswertung
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Aktuell: {score} von {maxScore} Punkten, {percent} %, Note{" "}
              {gradeLabel}. Fallaufgaben bewertet: {evaluatedCaseCount} /{" "}
              {examRun.caseTasks.length}.
            </p>

            {lastResult && (
              <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                Letztes gespeichertes Ergebnis: {lastResult.percent} % am{" "}
                {new Date(lastResult.completedAt).toLocaleDateString("de-DE")}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowEvaluation(true)}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500"
            >
              Lösungen anzeigen
            </button>

            <button
              type="button"
              onClick={saveResult}
              className="rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white transition hover:bg-green-500"
            >
              Ergebnis speichern
            </button>

            <button
              type="button"
              onClick={resetExam}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Neuer Durchlauf
            </button>
          </div>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </section>
    </div>
  );
}
