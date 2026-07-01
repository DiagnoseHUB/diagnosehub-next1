import { NextResponse } from "next/server";
import { isValidUserPlan, type UserPlan } from "@/config/plans";
import { evaluateLearningQuestionAnswer } from "@/lib/supabase/learningQuestionStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 0);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const questionId =
      typeof body.questionId === "string" ? body.questionId.trim() : "";

    if (!questionId) {
      return NextResponse.json(
        { error: "Frage-ID fehlt." },
        { status: 400 }
      );
    }

    const userPlan: UserPlan = isValidUserPlan(body.userPlan)
      ? body.userPlan
      : "free";

    const result = await evaluateLearningQuestionAnswer({
      questionId,
      selectedAnswerIndexes: normalizeNumberArray(body.selectedAnswerIndexes),
      userPlan,
    });

    return NextResponse.json({
      result,
    });
  } catch (error) {
    console.error("Antwort konnte nicht geprüft werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Antwort konnte nicht geprüft werden.",
      },
      { status: 500 }
    );
  }
}