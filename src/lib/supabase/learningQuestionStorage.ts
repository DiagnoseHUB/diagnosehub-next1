import type { UserPlan } from "@/config/plans";
import type {
  LearningDifficulty,
  LearningQuestion,
  LearningQuestionAnswerResult,
  LearningQuestionAttempt,
  LearningQuestionFilter,
  LearningQuestionType,
} from "@/types/learning";
import { createSupabaseAdminClient } from "./supabaseAdmin";

type LearningQuestionDatabaseRow = {
  id: string;
  category_id: string | null;
  module_id: string | null;
  lesson_id: string | null;
  slug: string | null;
  question: string;
  question_type: LearningQuestionType;
  difficulty: LearningDifficulty;
  required_plan: UserPlan;
  answers: unknown;
  correct_answer_indexes: number[] | null;
  explanation: string;
  exam_area: string;
  competence_area: string;
  tags: string[] | null;
  related_fault_codes: string[] | null;
  related_parts: string[] | null;
  related_systems: string[] | null;
  sort_order: number;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type LearningQuestionAttemptDatabaseRow = {
  id: string;
  user_id: string;
  question_id: string;
  selected_answer_indexes: number[] | null;
  is_correct: boolean;
  answered_at: string;
  created_at: string;
};

type SaveQuestionAttemptInput = {
  userId: string;
  questionId: string;
  selectedAnswerIndexes: number[];
};

const PLAN_RANK: Record<UserPlan, number> = {
  free: 0,
  werkstatt: 1,
  pro: 2,
};

function canAccessPlan(userPlan: UserPlan, requiredPlan: UserPlan) {
  return PLAN_RANK[userPlan] >= PLAN_RANK[requiredPlan];
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 0);
}

function normalizeAnswers(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }

      if (
        entry &&
        typeof entry === "object" &&
        "text" in entry &&
        typeof entry.text === "string"
      ) {
        return entry.text;
      }

      return "";
    })
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeLimit(value: unknown) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 20;
  }

  return Math.min(Math.max(Math.round(numericValue), 1), 100);
}

function arraysEqualAsSet(firstArray: number[], secondArray: number[]) {
  const first = Array.from(new Set(firstArray)).sort((a, b) => a - b);
  const second = Array.from(new Set(secondArray)).sort((a, b) => a - b);

  if (first.length !== second.length) {
    return false;
  }

  return first.every((value, index) => value === second[index]);
}

function convertQuestionRow(
  row: LearningQuestionDatabaseRow,
  userPlan: UserPlan = "free"
): LearningQuestion {
  return {
    id: row.id,
    categoryId: row.category_id,
    moduleId: row.module_id,
    lessonId: row.lesson_id,
    slug: row.slug,
    question: row.question,
    questionType: row.question_type || "single_choice",
    difficulty: row.difficulty || "basic",
    requiredPlan: row.required_plan || "free",
    answers: normalizeAnswers(row.answers),
    correctAnswerIndexes: normalizeNumberArray(row.correct_answer_indexes),
    explanation: row.explanation || "",
    examArea: row.exam_area || "",
    competenceArea: row.competence_area || "",
    tags: normalizeStringArray(row.tags),
    relatedFaultCodes: normalizeStringArray(row.related_fault_codes),
    relatedParts: normalizeStringArray(row.related_parts),
    relatedSystems: normalizeStringArray(row.related_systems),
    sortOrder: row.sort_order ?? 100,
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isLocked: !canAccessPlan(userPlan, row.required_plan || "free"),
  };
}

function convertAttemptRow(
  row: LearningQuestionAttemptDatabaseRow
): LearningQuestionAttempt {
  return {
    id: row.id,
    userId: row.user_id,
    questionId: row.question_id,
    selectedAnswerIndexes: normalizeNumberArray(row.selected_answer_indexes),
    isCorrect: Boolean(row.is_correct),
    answeredAt: row.answered_at,
    createdAt: row.created_at,
  };
}

export async function loadPublishedLearningQuestions(
  filter: LearningQuestionFilter = {}
): Promise<LearningQuestion[]> {
  const supabase = createSupabaseAdminClient();

  const userPlan = filter.userPlan || "free";
  const limit = normalizeLimit(filter.limit);

  let query = supabase
    .from("learning_questions")
    .select("*")
    .eq("is_published", true)
    .not("published_at", "is", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (filter.difficulty) {
    query = query.eq("difficulty", filter.difficulty);
  }

  if (filter.questionType) {
    query = query.eq("question_type", filter.questionType);
  }

  if (filter.tags && filter.tags.length > 0) {
    query = query.overlaps("tags", filter.tags);
  }

  if (filter.faultCodes && filter.faultCodes.length > 0) {
    query = query.overlaps("related_fault_codes", filter.faultCodes);
  }

  if (filter.parts && filter.parts.length > 0) {
    query = query.overlaps("related_parts", filter.parts);
  }

  if (filter.systems && filter.systems.length > 0) {
    query = query.overlaps("related_systems", filter.systems);
  }

  if (filter.categorySlug) {
    const { data: categoryData, error: categoryError } = await supabase
      .from("learning_categories")
      .select("id")
      .eq("slug", filter.categorySlug)
      .maybeSingle();

    if (categoryError) {
      throw new Error(
        `Kategorie konnte nicht geladen werden: ${categoryError.message}`
      );
    }

    if (!categoryData) {
      return [];
    }

    query = query.eq("category_id", categoryData.id);
  }

  if (filter.moduleSlug) {
    const { data: moduleData, error: moduleError } = await supabase
      .from("learning_modules")
      .select("id")
      .eq("slug", filter.moduleSlug)
      .maybeSingle();

    if (moduleError) {
      throw new Error(
        `Modul konnte nicht geladen werden: ${moduleError.message}`
      );
    }

    if (!moduleData) {
      return [];
    }

    query = query.eq("module_id", moduleData.id);
  }

  if (filter.lessonSlug) {
    const { data: lessonData, error: lessonError } = await supabase
      .from("learning_lessons")
      .select("id")
      .eq("slug", filter.lessonSlug)
      .maybeSingle();

    if (lessonError) {
      throw new Error(
        `Lektion konnte nicht geladen werden: ${lessonError.message}`
      );
    }

    if (!lessonData) {
      return [];
    }

    query = query.eq("lesson_id", lessonData.id);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Fragen konnten nicht geladen werden: ${error.message}`);
  }

  return ((data || []) as LearningQuestionDatabaseRow[])
    .map((row) => convertQuestionRow(row, userPlan))
    .filter((question) => canAccessPlan(userPlan, question.requiredPlan));
}

export async function loadLearningQuestionById(
  questionId: string,
  userPlan: UserPlan = "free"
): Promise<LearningQuestion | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("learning_questions")
    .select("*")
    .eq("id", questionId)
    .eq("is_published", true)
    .not("published_at", "is", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Frage konnte nicht geladen werden: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const question = convertQuestionRow(data as LearningQuestionDatabaseRow, userPlan);

  if (question.isLocked) {
    return null;
  }

  return question;
}

export async function evaluateLearningQuestionAnswer(params: {
  questionId: string;
  selectedAnswerIndexes: number[];
  userPlan?: UserPlan;
}): Promise<LearningQuestionAnswerResult> {
  const question = await loadLearningQuestionById(
    params.questionId,
    params.userPlan || "free"
  );

  if (!question) {
    throw new Error("Frage wurde nicht gefunden oder ist nicht freigeschaltet.");
  }

  const selectedAnswerIndexes = normalizeNumberArray(params.selectedAnswerIndexes);

  const isCorrect = arraysEqualAsSet(
    selectedAnswerIndexes,
    question.correctAnswerIndexes
  );

  return {
    questionId: question.id,
    selectedAnswerIndexes,
    correctAnswerIndexes: question.correctAnswerIndexes,
    isCorrect,
    explanation: question.explanation,
  };
}

export async function saveLearningQuestionAttempt(
  params: SaveQuestionAttemptInput
): Promise<LearningQuestionAttempt> {
  const supabase = createSupabaseAdminClient();

  const question = await loadLearningQuestionById(params.questionId, "pro");

  if (!question) {
    throw new Error("Frage wurde nicht gefunden.");
  }

  const selectedAnswerIndexes = normalizeNumberArray(params.selectedAnswerIndexes);

  const isCorrect = arraysEqualAsSet(
    selectedAnswerIndexes,
    question.correctAnswerIndexes
  );

  const { data, error } = await supabase
    .from("learning_question_attempts")
    .insert({
      user_id: params.userId,
      question_id: params.questionId,
      selected_answer_indexes: selectedAnswerIndexes,
      is_correct: isCorrect,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Antwortversuch konnte nicht gespeichert werden: ${error.message}`
    );
  }

  return convertAttemptRow(data as LearningQuestionAttemptDatabaseRow);
}

export async function loadLearningQuestionAttemptsForUser(userId: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("learning_question_attempts")
    .select("*")
    .eq("user_id", userId)
    .order("answered_at", { ascending: false });

  if (error) {
    throw new Error(
      `Antwortversuche konnten nicht geladen werden: ${error.message}`
    );
  }

  return ((data || []) as LearningQuestionAttemptDatabaseRow[]).map(
    convertAttemptRow
  );
}