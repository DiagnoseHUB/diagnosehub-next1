"use client";

import { useEffect, useMemo, useState } from "react";
import {
  prepareTrainingQuestions,
  type RawTrainingQuestion,
  type TrainingQuestion,
} from "@/lib/trainingShuffle";

type TrainingModeProps = {
  questions: RawTrainingQuestion[];
  title?: string;
  maxQuestions?: number;
  trainingKey?: string;
};

function createRandomRunId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function getStorageKey(trainingKey?: string, title?: string) {
  return `diagnosehub-training-last-questions-${
    trainingKey || title || "default"
  }`;
}

function readLastQuestionIds(storageKey: string): string[] {
  if (typeof window === "undefined") return [];

  try {
    const storedValue = window.localStorage.getItem(storageKey);

    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) return [];

    return parsedValue.filter((item) => typeof item === "string");
  } catch {
    return [];
  }
}

function saveLastQuestionIds(storageKey: string, questionIds: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(questionIds));
  } catch {
    // localStorage kann blockiert sein, z. B. privater Modus.
  }
}

function selectQuestionsForRun({
  questionPool,
  maxQuestions,
  storageKey,
}: {
  questionPool: TrainingQuestion[];
  maxQuestions?: number;
  storageKey: string;
}): TrainingQuestion[] {
  if (
    typeof maxQuestions !== "number" ||
    !Number.isFinite(maxQuestions) ||
    maxQuestions <= 0 ||
    questionPool.length <= maxQuestions
  ) {
    saveLastQuestionIds(
      storageKey,
      questionPool.map((question) => question.id)
    );

    return questionPool;
  }

  const lastQuestionIds = readLastQuestionIds(storageKey);
  const lastQuestionIdSet = new Set(lastQuestionIds);

  const questionsNotUsedLastTime = questionPool.filter(
    (question) => !lastQuestionIdSet.has(question.id)
  );

  const selectedQuestions: TrainingQuestion[] = [];

  for (const question of questionsNotUsedLastTime) {
    if (selectedQuestions.length >= maxQuestions) break;
    selectedQuestions.push(question);
  }

  if (selectedQuestions.length < maxQuestions) {
    for (const question of questionPool) {
      if (selectedQuestions.length >= maxQuestions) break;

      const alreadySelected = selectedQuestions.some(
        (selectedQuestion) => selectedQuestion.id === question.id
      );

      if (!alreadySelected) {
        selectedQuestions.push(question);
      }
    }
  }

  saveLastQuestionIds(
    storageKey,
    selectedQuestions.map((question) => question.id)
  );

  return selectedQuestions;
}

export default function TrainingMode({
  questions,
  title = "Trainingsmodus",
  maxQuestions,
  trainingKey,
}: TrainingModeProps) {
  const [runId, setRunId] = useState(() => createRandomRunId());

  const [trainingQuestions, setTrainingQuestions] = useState<
    TrainingQuestion[]
  >([]);

  const [questionPoolLength, setQuestionPoolLength] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const questionsKey = useMemo(() => {
    return JSON.stringify(questions ?? []);
  }, [questions]);

  const storageKey = useMemo(() => {
    return getStorageKey(trainingKey, title);
  }, [trainingKey, title]);

  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      const preparedQuestionPool = prepareTrainingQuestions(questions ?? []);

      const selectedQuestions = selectQuestionsForRun({
        questionPool: preparedQuestionPool,
        maxQuestions,
        storageKey,
      });

      setQuestionPoolLength(preparedQuestionPool.length);
      setTrainingQuestions(selectedQuestions);
      setCurrentIndex(0);
      setSelectedAnswerId(null);
      setChecked(false);
      setScore(0);
      setFinished(false);
    }, 0);

    return () => window.clearTimeout(initTimer);
  }, [questionsKey, runId, maxQuestions, storageKey, questions]);

  const currentQuestion = trainingQuestions[currentIndex];

  const selectedAnswer = currentQuestion?.answers.find(
    (answer) => answer.id === selectedAnswerId
  );

  const isSelectedCorrect = selectedAnswer?.isCorrect === true;

  function handleCheckAnswer() {
    if (!selectedAnswerId || checked) return;

    if (isSelectedCorrect) {
      setScore((previousScore) => previousScore + 1);
    }

    setChecked(true);
  }

  function handleNextQuestion() {
    if (currentIndex >= trainingQuestions.length - 1) {
      setFinished(true);
      return;
    }

    setCurrentIndex((previousIndex) => previousIndex + 1);
    setSelectedAnswerId(null);
    setChecked(false);
  }

  function handleRestart() {
    setRunId(createRandomRunId());
  }

  if (trainingQuestions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <h2 className="text-xl font-black">{title}</h2>

        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Für diese Anleitung sind noch keine Trainingsfragen vorhanden.
        </p>
      </div>
    );
  }

  if (finished) {
    const percentage = Math.round((score / trainingQuestions.length) * 100);

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <h2 className="text-xl font-black">Training abgeschlossen</h2>

        <div className="mt-4 rounded-xl bg-slate-100 p-4 dark:bg-slate-950">
          <p className="text-3xl font-black">
            {score} / {trainingQuestions.length}
          </p>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Ergebnis: {percentage} %
          </p>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Fragenpool: {questionPoolLength} gespeicherte Fragen
          </p>
        </div>

        <button
          type="button"
          onClick={handleRestart}
          className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700"
        >
          Neuer zufälliger Durchlauf
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black">{title}</h2>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Frage {currentIndex + 1} von {trainingQuestions.length}
          </p>

          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Fragenpool: {questionPoolLength} gespeicherte Fragen
          </p>
        </div>

        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black dark:bg-slate-950">
          {score} richtig
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-black leading-snug">
          {currentQuestion.question}
        </h3>

        <div className="mt-5 grid gap-3">
          {currentQuestion.answers.map((answer, answerIndex) => {
            const letter = String.fromCharCode(65 + answerIndex);
            const isSelected = selectedAnswerId === answer.id;
            const showCorrect = checked && answer.isCorrect;
            const showWrong = checked && isSelected && !answer.isCorrect;

            let buttonClass =
              "w-full rounded-xl border px-4 py-3 text-left text-sm leading-6 transition";

            if (showCorrect) {
              buttonClass +=
                " border-green-500 bg-green-50 text-green-950 dark:border-green-500 dark:bg-green-950/50 dark:text-green-100";
            } else if (showWrong) {
              buttonClass +=
                " border-red-500 bg-red-50 text-red-950 dark:border-red-500 dark:bg-red-950/50 dark:text-red-100";
            } else if (isSelected) {
              buttonClass +=
                " border-blue-500 bg-blue-50 text-blue-950 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-100";
            } else {
              buttonClass +=
                " border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800";
            }

            return (
              <button
                key={answer.id}
                type="button"
                disabled={checked}
                onClick={() => setSelectedAnswerId(answer.id)}
                className={buttonClass}
              >
                <span className="mr-2 font-black">{letter}.</span>
                <span>{answer.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {checked && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="font-black">
            {isSelectedCorrect ? "Richtig." : "Falsch."}
          </p>

          {currentQuestion.explanation && (
            <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
              {currentQuestion.explanation}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-between gap-3">
        <button
          type="button"
          onClick={handleRestart}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Neu mischen
        </button>

        {!checked ? (
          <button
            type="button"
            disabled={!selectedAnswerId}
            onClick={handleCheckAnswer}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Antwort prüfen
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNextQuestion}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700"
          >
            {currentIndex >= trainingQuestions.length - 1
              ? "Training beenden"
              : "Nächste Frage"}
          </button>
        )}
      </div>
    </div>
  );
}
