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

  return Math.min(Math.max(Math.round(numericValue), 1), 100);
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

    const questions = await loadPublishedLearningQuestions({
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
      limit: normalizeLimit(searchParams.get("limit")),
    });

    return NextResponse.json({
      questions: questions.map(sanitizeQuestion),
      count: questions.length,
    });
  } catch (error) {
    console.error("Lernfragen konnten nicht geladen werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Lernfragen konnten nicht geladen werden.",
      },
      { status: 500 }
    );
  }
}