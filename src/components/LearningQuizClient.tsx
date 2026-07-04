"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PLAN_CONFIG,
  isValidUserPlan,
  type UserPlan,
} from "@/config/plans";
import type {
  LearningDifficulty,
  LearningQuestionAnswerResult,
  LearningQuestionType,
} from "@/types/learning";

type PublicLearningQuestion = {
  id: string;
  categoryId: string | null;
  moduleId: string | null;
  lessonId: string | null;
  slug: string | null;
  question: string;
  questionType: LearningQuestionType;
  difficulty: LearningDifficulty;
  requiredPlan: UserPlan;
  answers: string[];
  examArea: string;
  competenceArea: string;
  tags: string[];
  relatedFaultCodes: string[];
  relatedParts: string[];
  relatedSystems: string[];
  sortOrder: number;
  isLocked: boolean;
};

type QuestionsApiResponse = {
  questions?: PublicLearningQuestion[];
  count?: number;
  error?: string;
};

type AnswerApiResponse = {
  result?: LearningQuestionAnswerResult;
  error?: string;
};

const USER_PLAN_STORAGE_KEY = "diagnosehub-user-plan";

const categoryOptions = [
  { label: "Alle Bereiche", value: "" },
  { label: "Diagnose-Grundlagen", value: "diagnose-grundlagen" },
  { label: "Diesel", value: "diesel" },
  { label: "Motormanagement", value: "motormanagement" },
  { label: "Elektrik", value: "elektrik" },
  { label: "Klima", value: "klima" },
  { label: "Bremse", value: "bremse" },
  { label: "Fahrwerk", value: "fahrwerk" },
];

const difficultyOptions: { label: string; value: "" | LearningDifficulty }[] = [
  { label: "Alle Level", value: "" },
  { label: "Grundlage", value: "basic" },
  { label: "Fortgeschritten", value: "intermediate" },
  { label: "Experte", value: "advanced" },
];

const limitOptions = [10, 20, 50, 100];

function readLocalUserPlan(): UserPlan {
  if (typeof window === "undefined") {
    return "free";
  }

  const savedPlan = localStorage.getItem(USER_PLAN_STORAGE_KEY);

  return isValidUserPlan(savedPlan) ? savedPlan : "free";
}

function getDifficultyLabel(difficulty: LearningDifficulty) {
  if (difficulty === "basic") return "Grundlage";
  if (difficulty === "intermediate") return "Fortgeschritten";
  return "Experte";
}

function getQuestionTypeLabel(questionType: LearningQuestionType) {
  if (questionType === "single_choice") return "Eine Antwort";
  if (questionType === "multiple_choice") return "Mehrere Antworten";
  if (questionType === "true_false") return "Richtig/Falsch";
  return "Freitext";
}

function getPlanLabel(plan: UserPlan) {
  return PLAN_CONFIG[plan]?.label || plan;
}

function normalizeSelection(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

export default function LearningQuizClient() {
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [categorySlug, setCategorySlug] = useState("");
  const [difficulty, setDifficulty] = useState<"" | LearningDifficulty>("");
  const [limit, setLimit] = useState(20);

  const [questions, setQuestions] = useState<PublicLearningQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, number[]>
  >({});
  const [answerResults, setAnswerResults] = useState<
    Record<string, LearningQuestionAnswerResult>
  >({});

  const [loading, setLoading] = useState(false);
  const [checkingQuestionId, setCheckingQuestionId] = useState("");
  const [error, setError] = useState("");
const [debugRunId, setDebugRunId] = useState("");
  const answeredCount = Object.keys(answerResults).length;

  const correctCount = Object.values(answerResults).filter(
    (result) => result.isCorrect
  ).length;

  const successRate =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams();

    params.set("userPlan", userPlan);
    params.set("limit", String(limit));

    if (categorySlug) {
      params.set("categorySlug", categorySlug);
    }

    if (difficulty) {
      params.set("difficulty", difficulty);
    }

    return `/api/lernen/questions?${params.toString()}`;
  }, [userPlan, categorySlug, difficulty, limit]);

  useEffect(() => {
    setUserPlan(readLocalUserPlan());
  }, []);

  useEffect(() => {
    void loadQuestions();
  }, [requestUrl]);

  async function loadQuestions() {
    setLoading(true);
    setError("");
    setSelectedAnswers({});
    setAnswerResults({});

    try {
      const response = await fetch(requestUrl, {
        method: "GET",
      });

      const data = (await response.json()) as QuestionsApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Fragen konnten nicht geladen werden.");
      }

      setQuestions(data.questions || []);
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "Fragen konnten nicht geladen werden."
      );
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  function selectSingleAnswer(questionId: string, answerIndex: number) {
    setSelectedAnswers((currentValues) => ({
      ...currentValues,
      [questionId]: [answerIndex],
    }));
  }

  function toggleMultipleAnswer(questionId: string, answerIndex: number) {
    setSelectedAnswers((currentValues) => {
      const currentSelection = currentValues[questionId] || [];
      const nextSelection = currentSelection.includes(answerIndex)
        ? currentSelection.filter((value) => value !== answerIndex)
        : [...currentSelection, answerIndex];

      return {
        ...currentValues,
        [questionId]: normalizeSelection(nextSelection),
      };
    });
  }

  async function checkAnswer(question: PublicLearningQuestion) {
    const selectedAnswerIndexes = selectedAnswers[question.id] || [];

    if (
      selectedAnswerIndexes.length === 0 &&
      question.questionType !== "text"
    ) {
      setError("Bitte zuerst eine Antwort auswählen.");
      return;
    }

    setCheckingQuestionId(question.id);
    setError("");

    try {
      const response = await fetch("/api/lernen/questions/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId: question.id,
          selectedAnswerIndexes,
          userPlan,
        }),
      });

      const data = (await response.json()) as AnswerApiResponse;

      if (!response.ok || !data.result) {
        throw new Error(data.error || "Antwort konnte nicht geprüft werden.");
      }

      setAnswerResults((currentValues) => ({
        ...currentValues,
        [question.id]: data.result!,
      }));
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "Antwort konnte nicht geprüft werden."
      );
    } finally {
      setCheckingQuestionId("");
    }
  }

  function resetQuiz() {
    setSelectedAnswers({});
    setAnswerResults({});
    setError("");
  }

  function renderAnswerButton(
    question: PublicLearningQuestion,
    answer: string,
    answerIndex: number
  ) {
    const selectedIndexes = selectedAnswers[question.id] || [];
    const result = answerResults[question.id];
    const isSelected = selectedIndexes.includes(answerIndex);
    const isCorrectAnswer = result?.correctAnswerIndexes.includes(answerIndex);
    const isAnswered = Boolean(result);

    let className =
      "w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition";

    if (isAnswered && isCorrectAnswer) {
      className +=
        " border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300";
    } else if (isAnswered && isSelected && !isCorrectAnswer) {
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
        disabled={isAnswered}
        onClick={() => {
          if (question.questionType === "multiple_choice") {
            toggleMultipleAnswer(question.id, answerIndex);
            return;
          }

          selectSingleAnswer(question.id, answerIndex);
        }}
        className={className}
      >
        <span className="mr-2 font-black">
          {String.fromCharCode(65 + answerIndex)}.
        </span>
        {answer}
      </button>
    );
  }

  return (
    <div>
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-8 shadow-sm transition-colors dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-blue-950/30">
        <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-400">
          DiagnoseHUB Quiz
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">
          Prüfungsfragen & Werkstattwissen
        </h1>

        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-700 dark:text-slate-300">
          Der Fragenpool ist für Meisterwissen, Diagnose-Grundlagen und
          technische Werkstattfälle vorbereitet. Fragen können später per CSV
          strukturiert importiert werden.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-bold text-blue-700 dark:text-blue-300">
            Plan: {getPlanLabel(userPlan)}
          </span>

          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-700 dark:text-green-300">
            {questions.length} Fragen geladen
          </span>

          <span className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Trefferquote: {successRate} %
          </span>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Bereich
            </span>

            <select
              value={categorySlug}
              onChange={(event) => setCategorySlug(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              {categoryOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Schwierigkeit
            </span>

            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value as "" | LearningDifficulty)
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              {difficultyOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Anzahl
            </span>

            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              {limitOptions.map((option) => (
                <option key={option} value={option}>
                  {option} Fragen
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Aktionen
            </span>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void loadQuestions()}
                disabled={loading}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Lädt..." : "Neu laden"}
              </button>

              <button
                type="button"
                onClick={resetQuiz}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
          <span>
            Beantwortet:{" "}
            <strong className="text-slate-950 dark:text-slate-100">
              {answeredCount}
            </strong>
          </span>

          <span>
            Richtig:{" "}
            <strong className="text-green-700 dark:text-green-300">
              {correctCount}
            </strong>
          </span>

          <span>
            Falsch:{" "}
            <strong className="text-red-700 dark:text-red-300">
              {Math.max(answeredCount - correctCount, 0)}
            </strong>
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 rounded-3xl border border-blue-500/30 bg-blue-500/10 p-6 text-sm font-bold text-blue-700 dark:text-blue-300">
          Fragen werden geladen...
        </div>
      ) : questions.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="text-2xl font-black text-slate-950 dark:text-slate-100">
            Noch keine Fragen vorhanden
          </h2>

          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Die Quiz-Seite ist vorbereitet. Als Nächstes fuegen wir die ersten
            Fragen in den Supabase-Fragenpool ein.
          </p>

          <Link
            href="/lernen"
            className="mt-5 inline-flex rounded-xl border border-blue-500/40 px-5 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-600 hover:text-white dark:text-blue-300"
          >
            Zur Lernplattform
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-5">
          {questions.map((question, questionIndex) => {
            const result = answerResults[question.id];
            const isAnswered = Boolean(result);

            return (
              <article
                key={question.id}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                        Frage {questionIndex + 1}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {getDifficultyLabel(question.difficulty)}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {getQuestionTypeLabel(question.questionType)}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {getPlanLabel(question.requiredPlan)}
                      </span>
                    </div>

                    {(question.examArea || question.competenceArea) && (
                      <p className="mt-3 text-sm font-semibold text-slate-500">
                        {[question.examArea, question.competenceArea]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>

                  {isAnswered && (
                    <span
                      className={
                        result.isCorrect
                          ? "rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-black text-green-700 dark:text-green-300"
                          : "rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-black text-red-700 dark:text-red-300"
                      }
                    >
                      {result.isCorrect ? "Richtig" : "Falsch"}
                    </span>
                  )}
                </div>

                <h2 className="mt-5 text-xl font-black leading-8 text-slate-950 dark:text-slate-100">
                  {question.question}
                </h2>

                {question.questionType === "text" ? (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    Freitext-Fragen sind vorbereitet. Die automatische Bewertung
                    bauen wir später.
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3">
                    {question.answers.map((answer, answerIndex) =>
                      renderAnswerButton(question, answer, answerIndex)
                    )}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void checkAnswer(question)}
                    disabled={
                      isAnswered ||
                      checkingQuestionId === question.id ||
                      question.questionType === "text"
                    }
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {checkingQuestionId === question.id
                      ? "Prüft..."
                      : isAnswered
                        ? "Geprüft"
                        : "Antwort prüfen"}
                  </button>

                  {question.relatedFaultCodes.map((code) => (
                    <span
                      key={code}
                      className="rounded-full bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-300"
                    >
                      {code}
                    </span>
                  ))}

                  {question.relatedParts.slice(0, 3).map((part) => (
                    <span
                      key={part}
                      className="rounded-full bg-green-500/10 px-3 py-2 text-xs font-bold text-green-700 dark:text-green-300"
                    >
                      {part}
                    </span>
                  ))}
                </div>

                {result && (
                  <div
                    className={
                      result.isCorrect
                        ? "mt-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm leading-6 text-green-800 dark:text-green-200"
                        : "mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-800 dark:text-red-200"
                    }
                  >
                    <p className="font-black">
                      {result.isCorrect
                        ? "Richtige Antwort."
                        : "Nicht korrekt."}
                    </p>

                    {result.explanation && (
                      <p className="mt-2">{result.explanation}</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}