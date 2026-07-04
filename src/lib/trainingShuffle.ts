export type TrainingAnswer = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type TrainingQuestion = {
  id: string;
  question: string;
  explanation?: string;
  answers: TrainingAnswer[];
};

type RawAnswer =
  | string
  | {
      id?: string;
      text?: string;
      answer?: string;
      label?: string;
      isCorrect?: boolean;
      correct?: boolean;
    };

export type RawTrainingQuestion = {
  id?: string;
  question?: string;
  text?: string;
  title?: string;
  explanation?: string;
  correctIndex?: number;
  correctAnswer?: string;
  correct?: string | number;
  correctOption?: string | number;
  answers?: RawAnswer[];
  options?: RawAnswer[] | Record<string, RawAnswer>;
};

function getRandomNumber(): number {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / 4294967296;
  }

  return Math.random();
}

export function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(getRandomNumber() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function getAnswerText(answer: RawAnswer): string {
  if (typeof answer === "string") return answer.trim();

  return (
    normalizeText(answer.text) ||
    normalizeText(answer.answer) ||
    normalizeText(answer.label)
  );
}

function getExplicitCorrectValue(answer: RawAnswer): boolean | null {
  if (typeof answer === "string") return null;

  if (typeof answer.isCorrect === "boolean") {
    return answer.isCorrect;
  }

  if (typeof answer.correct === "boolean") {
    return answer.correct;
  }

  return null;
}

function getRawAnswers(question: RawTrainingQuestion): RawAnswer[] {
  if (Array.isArray(question.answers) && question.answers.length > 0) {
    return question.answers;
  }

  if (Array.isArray(question.options) && question.options.length > 0) {
    return question.options;
  }

  if (
    question.options &&
    typeof question.options === "object" &&
    !Array.isArray(question.options)
  ) {
    const preferredOrder = ["a", "b", "c", "d", "A", "B", "C", "D"];

    const orderedAnswers = preferredOrder
      .filter((key) => key in question.options!)
      .map((key) => (question.options as Record<string, RawAnswer>)[key]);

    if (orderedAnswers.length > 0) {
      return orderedAnswers;
    }

    return Object.values(question.options);
  }

  return [];
}

function markerMatchesIndex(marker: string | number, index: number): boolean {
  if (typeof marker === "number") {
    return marker === index;
  }

  const normalized = marker.trim().toLowerCase();

  const letterIndexMap: Record<string, number> = {
    a: 0,
    b: 1,
    c: 2,
    d: 3,
  };

  if (normalized in letterIndexMap) {
    return letterIndexMap[normalized] === index;
  }

  return false;
}

function markerMatchesText(marker: string | number, text: string): boolean {
  if (typeof marker !== "string") return false;

  return marker.trim().toLowerCase() === text.trim().toLowerCase();
}

export function normalizeTrainingQuestions(
  questions: RawTrainingQuestion[]
): TrainingQuestion[] {
  return questions.map((question, questionIndex) => {
    const rawAnswers = getRawAnswers(question);

    const correctMarker =
      question.correctAnswer ?? question.correct ?? question.correctOption;

    const normalizedAnswers: TrainingAnswer[] = rawAnswers
      .map((answer, answerIndex) => {
        const answerText = getAnswerText(answer);

        const explicitCorrect = getExplicitCorrectValue(answer);

        let isCorrect = false;

        if (explicitCorrect !== null) {
          isCorrect = explicitCorrect;
        } else if (correctMarker !== undefined) {
          isCorrect =
            markerMatchesIndex(correctMarker, answerIndex) ||
            markerMatchesText(correctMarker, answerText);
        } else if (typeof question.correctIndex === "number") {
          isCorrect = question.correctIndex === answerIndex;
        }

        return {
          id:
            typeof answer === "object" && answer.id
              ? answer.id
              : `q-${questionIndex}-a-${answerIndex}`,
          text: answerText,
          isCorrect,
        };
      })
      .filter((answer) => answer.text.length > 0);

    const finalAnswers =
      normalizedAnswers.length > 0
        ? normalizedAnswers
        : [
            {
              id: `q-${questionIndex}-a-0`,
              text: "Antwort A",
              isCorrect: true,
            },
            {
              id: `q-${questionIndex}-a-1`,
              text: "Antwort B",
              isCorrect: false,
            },
            {
              id: `q-${questionIndex}-a-2`,
              text: "Antwort C",
              isCorrect: false,
            },
            {
              id: `q-${questionIndex}-a-3`,
              text: "Antwort D",
              isCorrect: false,
            },
          ];

    const hasCorrectAnswer = finalAnswers.some((answer) => answer.isCorrect);

    return {
      id: question.id || `q-${questionIndex}`,
      question:
        normalizeText(question.question) ||
        normalizeText(question.text) ||
        normalizeText(question.title) ||
        `Frage ${questionIndex + 1}`,
      explanation: question.explanation,
      answers: hasCorrectAnswer
        ? finalAnswers
        : finalAnswers.map((answer, answerIndex) => ({
            ...answer,
            isCorrect: answerIndex === 0,
          })),
    };
  });
}

export function prepareTrainingQuestions(
  questions: RawTrainingQuestion[],
  maxQuestions?: number
): TrainingQuestion[] {
  const normalizedQuestions = normalizeTrainingQuestions(questions);

  const shuffledQuestions = shuffleArray(normalizedQuestions).map(
    (question) => ({
      ...question,
      answers: shuffleArray(question.answers),
    })
  );

  if (
    typeof maxQuestions === "number" &&
    Number.isFinite(maxQuestions) &&
    maxQuestions > 0
  ) {
    return shuffledQuestions.slice(0, maxQuestions);
  }

  return shuffledQuestions;
}