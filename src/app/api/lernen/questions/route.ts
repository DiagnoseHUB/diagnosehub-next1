import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { isValidUserPlan, type UserPlan } from "@/config/plans";
import { loadPublishedLearningQuestions } from "@/lib/supabase/learningQuestionStorage";
import type {
  LearningDifficulty,
  LearningQuestion,
  LearningQuestionType,
} from "@/types/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_DIFFICULTIES: LearningDifficulty[] = [
  "basic",
  "intermediate",
  "advanced",
];

const VALID_QUESTION_TYPES: LearningQuestionType[] = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "text",
];

const MAX_PUBLIC_LIMIT = 100;
const INTERNAL_POOL_LIMIT = 100;

function isLearningDifficulty(value: unknown): value is LearningDifficulty {
  return (
    typeof value === "string" &&
    VALID_DIFFICULTIES.includes(value as LearningDifficulty)
  );
}

function isLearningQuestionType(value: unknown): value is LearningQuestionType {
  return (
    typeof value === "string" &&
    VALID_QUESTION_TYPES.includes(value as LearningQuestionType)
  );
}

function normalizeLimit(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 20;
  }

  return Math.min(Math.max(Math.round(numericValue), 1), MAX_PUBLIC_LIMIT);
}

function normalizeStringList(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function shuffleArray<T>(items: T[]): T[] {
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index--) {
    const randomIndex = randomInt(index + 1);

    [shuffledItems[index], shuffledItems[randomIndex]] = [
      shuffledItems[randomIndex],
      shuffledItems[index],
    ];
  }

  return shuffledItems;
}

function sanitizeQuestion(question: LearningQuestion) {
  return {
    id: question.id,
    categoryId: question.categoryId,
    moduleId: question.moduleId,
    lessonId: question.lessonId,
    slug: question.slug,
    question: question.question,
    questionType: question.questionType,
    difficulty: question.difficulty,
    requiredPlan: question.requiredPlan,

    /*
      Wichtig:
      Antworten hier NICHT mischen.

      Deine Antwortprüfung arbeitet mit den urspruenglichen Antwort-Indexen.
      Antworten müssen im Client gemischt werden, während originalIndex erhalten bleibt.
    */
    answers: question.answers,

    examArea: question.examArea,
    competenceArea: question.competenceArea,
    tags: question.tags,
    relatedFaultCodes: question.relatedFaultCodes,
    relatedParts: question.relatedParts,
    relatedSystems: question.relatedSystems,
    sortOrder: question.sortOrder,
    isLocked: question.isLocked ?? false,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedPlan = searchParams.get("userPlan");
    const userPlan: UserPlan = isValidUserPlan(requestedPlan)
      ? requestedPlan
      : "free";

    const requestedDifficulty = searchParams.get("difficulty");
    const difficulty = isLearningDifficulty(requestedDifficulty)
      ? requestedDifficulty
      : undefined;

    const requestedQuestionType = searchParams.get("questionType");
    const questionType = isLearningQuestionType(requestedQuestionType)
      ? requestedQuestionType
      : undefined;

    /*
      Das ist die Anzahl, die der Nutzer im Quiz sehen will:
      z. B. 10, 20, 50 oder 100.
    */
    const requestedLimit = normalizeLimit(searchParams.get("limit"));

    /*
      Wichtig:
      Wir laden intern mehr Fragen als angezeigt werden sollen.
      Danach mischen wir serverseitig und schneiden erst dann auf requestedLimit.
      Dadurch kommen nicht immer nur die ersten 10/20 Fragen.
    */
    const internalFetchLimit = Math.max(requestedLimit, INTERNAL_POOL_LIMIT);

    const questionPool = await loadPublishedLearningQuestions({
      userPlan,
      categorySlug: searchParams.get("categorySlug") || undefined,
      moduleSlug: searchParams.get("moduleSlug") || undefined,
      lessonSlug: searchParams.get("lessonSlug") || undefined,
      difficulty,
      questionType,
      tags: normalizeStringList(searchParams.get("tags")),
      faultCodes: normalizeStringList(searchParams.get("faultCodes")),
      parts: normalizeStringList(searchParams.get("parts")),
      systems: normalizeStringList(searchParams.get("systems")),
      limit: internalFetchLimit,
    });

    const shuffledQuestions = shuffleArray(questionPool);
    const selectedQuestions = shuffledQuestions.slice(0, requestedLimit);

    return NextResponse.json(
      {
        questions: selectedQuestions.map(sanitizeQuestion),

        /*
          count = Fragenpool, aus dem zufaellig gewählt wurde.
          returnedCount = Anzahl, die wirklich angezeigt wird.
          debugRunId = sichtbarer Kontrollwert zum Testen, ob die Route neu läuft.
        */
        count: questionPool.length,
        returnedCount: selectedQuestions.length,
        debugRunId: `${Date.now()}-${randomInt(1_000_000)}`,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("Lernfragen konnten nicht geladen werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Lernfragen konnten nicht geladen werden.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}