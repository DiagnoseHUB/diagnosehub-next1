import { NextResponse } from "next/server";
import {
  getAuthenticatedRequestErrorStatus,
  loadAuthenticatedUserFromRequest,
} from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import {
  COMMUNITY_RANK_LABELS,
  canAcceptCommunityAnswers,
  canAnswerCommunityQuestions,
  resolveCommunityRank,
  type CommunityProfile,
} from "@/services/communityRank";
import {
  createCommunityReputationEvent,
  isMissingSupabaseTableError,
  loadCommunityLeaderboard,
} from "@/services/communityReputation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QuestionBody = {
  title?: unknown;
  body?: unknown;
  vehicleData?: unknown;
  tags?: unknown;
};

type CommunityQuestionRow = Record<string, unknown> & {
  id: string;
  author_id?: string | null;
};

type CommunityAnswerRow = Record<string, unknown> & {
  question_id: string;
  author_id?: string | null;
};

type ProfileRow = CommunityProfile & {
  id: string;
  full_name: string | null;
  workshop_name: string | null;
  company_name?: string | null;
};

const PROFILE_SELECT =
  "id, full_name, workshop_name, company_name, role, account_type, qualification_level, company_verified, hv_verified, community_rank";

function cleanText(value: unknown, maxLength = 2000) {
  return typeof value === "string"
    ? value.trim().replace(/\r\n/g, "\n").slice(0, maxLength)
    : "";
}

function cleanTags(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => cleanText(entry, 40).toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
  }

  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map((entry) => cleanText(entry, 40).toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
  }

  return [];
}

function formatProfile(profile?: ProfileRow | null) {
  const rank = resolveCommunityRank(profile);

  return {
    id: profile?.id || "",
    name: profile?.workshop_name || profile?.company_name || profile?.full_name || "DiagnoseHUB Nutzer",
    rank,
    rankLabel: COMMUNITY_RANK_LABELS[rank],
    canAnswer: canAnswerCommunityQuestions(rank),
    canAccept: canAcceptCommunityAnswers(rank),
  };
}

async function loadProfiles(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const profiles = new Map<string, ReturnType<typeof formatProfile>>();

  if (ids.length === 0) {
    return profiles;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workshop_profiles")
    .select(PROFILE_SELECT)
    .in("id", ids);

  if (error) {
    throw new Error(`Profile konnten nicht geladen werden: ${error.message}`);
  }

  for (const profile of (data || []) as ProfileRow[]) {
    profiles.set(profile.id, formatProfile(profile));
  }

  return profiles;
}

async function loadCurrentProfile(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workshop_profiles")
    .select(PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Profil konnte nicht geladen werden: ${error.message}`);
  }

  return formatProfile((data as ProfileRow | null) || null);
}

export async function GET(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);
    const supabase = createSupabaseAdminClient();

    const [profile, questionsResult, answersResult, leaderboard] =
      await Promise.all([
        loadCurrentProfile(user.id),
        supabase
          .from("community_questions")
          .select("*")
          .neq("status", "archived")
          .order("updated_at", { ascending: false })
          .limit(40),
        supabase
          .from("community_answers")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(200),
        loadCommunityLeaderboard(),
      ]);

    const forumTableMissing =
      isMissingSupabaseTableError(questionsResult.error, "community_questions") ||
      isMissingSupabaseTableError(answersResult.error, "community_answers");

    if (forumTableMissing) {
      return NextResponse.json({
        profile,
        questions: [],
        leaderboard,
        setupNotice:
          "Forum-Datenbank noch nicht eingerichtet. Bitte die Forum-Migration in Supabase ausführen.",
      });
    }

    if (questionsResult.error) {
      throw new Error(`Fragen konnten nicht geladen werden: ${questionsResult.error.message}`);
    }

    if (answersResult.error) {
      throw new Error(`Antworten konnten nicht geladen werden: ${answersResult.error.message}`);
    }

    const questions = (questionsResult.data || []) as CommunityQuestionRow[];
    const answers = (answersResult.data || []) as CommunityAnswerRow[];
    const profileIds = [
      ...questions.map((question) => question.author_id || ""),
      ...answers.map((answer) => answer.author_id || ""),
    ];
    const profiles = await loadProfiles(profileIds);
    const answersByQuestion = new Map<string, unknown[]>();

    for (const answer of answers) {
      const questionId = answer.question_id;
      const entries = answersByQuestion.get(questionId) || [];

      entries.push({
        ...answer,
        author: profiles.get(answer.author_id || "") || null,
      });
      answersByQuestion.set(questionId, entries);
    }

    return NextResponse.json({
      profile,
      questions: questions.map((question) => ({
        ...question,
        author: profiles.get(question.author_id || "") || null,
        answers: answersByQuestion.get(question.id) || [],
      })),
      leaderboard,
    });
  } catch (error) {
    console.error("Community-Fragen konnten nicht geladen werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Community-Fragen konnten nicht geladen werden.",
      },
      { status: getAuthenticatedRequestErrorStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);
    const body = (await request.json()) as QuestionBody;
    const title = cleanText(body.title, 140);
    const questionBody = cleanText(body.body, 3000);
    const vehicleData = cleanText(body.vehicleData, 1600);

    if (!title || !questionBody) {
      return NextResponse.json(
        {
          error: "Bitte gib Titel und Frage an.",
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("community_questions")
      .insert({
        author_id: user.id,
        title,
        body: questionBody,
        vehicle_data: vehicleData,
        tags: cleanTags(body.tags),
        status: "open",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Frage konnte nicht gespeichert werden: ${error.message}`);
    }

    await createCommunityReputationEvent(supabase, {
      userId: user.id,
      sourceType: "question",
      sourceId: data.id,
      points: 1,
      reason: "Fachfrage gestellt",
    });

    return NextResponse.json({
      question: data,
      message: "Frage wurde gespeichert.",
    });
  } catch (error) {
    console.error("Community-Frage konnte nicht gespeichert werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Community-Frage konnte nicht gespeichert werden.",
      },
      { status: getAuthenticatedRequestErrorStatus(error) }
    );
  }
}
