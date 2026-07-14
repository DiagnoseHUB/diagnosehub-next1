import { NextResponse } from "next/server";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  canAcceptCommunityAnswers,
  resolveCommunityRank,
  type CommunityProfile,
} from "@/services/communityRank";
import { createCommunityReputationEvent } from "@/services/communityReputation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AcceptBody = {
  answerId?: unknown;
};

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

    if (!canAcceptCommunityAnswers(rank)) {
      return NextResponse.json(
        {
          error:
            "Nur Meister oder entsprechend freigegebene Accounts dürfen eine Antwort als richtig markieren.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as AcceptBody;
    const answerId = cleanUuid(body.answerId);

    if (!answerId) {
      return NextResponse.json(
        {
          error: "Antwort-ID fehlt.",
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data: answer, error: answerError } = await supabase
      .from("community_answers")
      .select("id, question_id, author_id")
      .eq("id", answerId)
      .maybeSingle();

    if (answerError) {
      throw new Error(`Antwort konnte nicht geprüft werden: ${answerError.message}`);
    }

    if (!answer) {
      return NextResponse.json(
        {
          error: "Antwort wurde nicht gefunden.",
        },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    await Promise.all([
      supabase
        .from("community_answers")
        .update({
          is_accepted: false,
          accepted_by: null,
          accepted_at: null,
        })
        .eq("question_id", answer.question_id),
      supabase
        .from("community_answers")
        .update({
          is_accepted: true,
          accepted_by: user.id,
          accepted_at: now,
        })
        .eq("id", answer.id),
      supabase
        .from("community_questions")
        .update({
          status: "solved",
          accepted_answer_id: answer.id,
        })
        .eq("id", answer.question_id),
    ]);

    if (answer.author_id) {
      await createCommunityReputationEvent(supabase, {
        userId: answer.author_id,
        sourceType: "accepted_answer",
        sourceId: answer.id,
        points: 10,
        reason: "Antwort als richtig markiert",
      });
    }

    return NextResponse.json({
      accepted: true,
      message: "Antwort wurde als richtige Antwort markiert.",
    });
  } catch (error) {
    console.error("Antwort konnte nicht markiert werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Antwort konnte nicht markiert werden.",
      },
      { status: 500 }
    );
  }
}
