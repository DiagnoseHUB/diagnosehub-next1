import { NextResponse } from "next/server";
import { isValidUserPlan, type UserPlan } from "@/config/plans";
import { findRelatedLearningModules } from "@/lib/supabase/learningStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeLimit(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 6;
  }

  return Math.min(Math.max(Math.round(numericValue), 1), 12);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const faultCodes = normalizeStringArray(body.faultCodes);
    const parts = normalizeStringArray(body.parts);
    const systems = normalizeStringArray(body.systems);
    const userPlan: UserPlan = isValidUserPlan(body.userPlan)
      ? body.userPlan
      : "free";
    const limit = normalizeLimit(body.limit);

    const modules = await findRelatedLearningModules({
      faultCodes,
      parts,
      systems,
      userPlan,
      limit,
    });

    return NextResponse.json({
      modules,
    });
  } catch (error) {
    console.error("Passende Lernmodule konnten nicht geladen werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Passende Lernmodule konnten nicht geladen werden.",
      },
      { status: 500 }
    );
  }
}