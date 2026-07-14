import { NextResponse } from "next/server";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  canAnswerCommunityQuestions,
  resolveCommunityRank,
  type CommunityProfile,
} from "@/services/communityRank";
import { createCommunityReputationEvent } from "@/services/communityReputation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnswerBody = {
  questionId?: unknown;
  body?: unknown;
};

function cleanText(value: unknown, maxLength = 4000) {
  return typeof value === "string"
    ? value.trim().replace(/\r\n/g, "\n").slice(0, maxLength)
    : "";
}

function cleanUuid(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : "";
}

async function loadProfile(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workshop_profiles")
    .select("id, role, account_type, qualification_level, company_verified, hv_verified, community_rank")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Profil konnte nicht geladen werden: ${error.message}`);
  }

  return (data as CommunityProfile | null) || null;
}

export async function POST(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);
    const profile = await loadProfile(user.id);
    const rank = resolveCommunityRank(profile);

    if (!canAnswerCommunityQuestions(rank)) {
      return NextResponse.json(
        {
          error:
            "Antworten dürfen aktuell nur Gesellen, Meister oder geprüfte Werkstätten geben.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as AnswerBody;
    const questionId = cleanUuid(body.questionId);
    const answerBody = cleanText(body.body);

    if (!questionId || !answerBody) {
      return NextResponse.json(
        {
          error: "Frage und Antworttext sind Pflicht.",
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("community_answers")
      .insert({
        question_id: questionId,
        author_id: user.id,
        body: answerBody,
        answer_rank: rank === "meister" ? "meister" : "geselle",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Antwort konnte nicht gespeichert werden: ${error.message}`);
    }

    await Promise.all([
      supabase
        .from("community_questions")
        .update({ status: "answered" })
        .eq("id", questionId)
        .neq("status", "solved"),
      createCommunityReputationEvent(supabase, {
        userId: user.id,
        sourceType: "answer",
        sourceId: data.id,
        points: 4,
        reason: "Fachantwort gegeben",
      }),
    ]);

    return NextResponse.json({
      answer: data,
      message: "Antwort wurde gespeichert.",
    });
  } catch (error) {
    console.error("Community-Antwort konnte nicht gespeichert werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Community-Antwort konnte nicht gespeichert werden.",
      },
      { status: 500 }
    );
  }
}
