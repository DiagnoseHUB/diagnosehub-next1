import {
  canAccessRequiredPlan,
  type UserPlan,
} from "@/config/plans";
import {
  LOCAL_LEARNING_CATEGORIES,
  LOCAL_LEARNING_LESSONS,
  LOCAL_LEARNING_MODULES,
} from "@/data/localLearningCatalog";
import type {
  LearningDifficulty,
  LearningLesson,
  LearningModule,
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

function canAccessPlan(userPlan: UserPlan, requiredPlan: UserPlan) {
  return canAccessRequiredPlan(userPlan, requiredPlan);
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

function normalizeSearchToken(value: string) {
  return value.trim().toLowerCase();
}

function includesAny(sourceValues: string[], requestedValues?: string[]) {
  if (!requestedValues || requestedValues.length === 0) {
    return true;
  }

  const sourceTokens = new Set(sourceValues.map(normalizeSearchToken));

  return requestedValues
    .map(normalizeSearchToken)
    .some((requestedValue) => sourceTokens.has(requestedValue));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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

function convertLocalLessonQuestion(
  lesson: LearningLesson,
  learningModule: LearningModule,
  quizIndex: number,
  userPlan: UserPlan = "free"
): LearningQuestion | null {
  const quiz = lesson.quizQuestions[quizIndex];

  if (!quiz || quiz.answers.length === 0) {
    return null;
  }

  const category = LOCAL_LEARNING_CATEGORIES.find(
    (entry) => entry.id === learningModule.categoryId
  );
  const requiredPlan = lesson.requiredPlan || learningModule.requiredPlan || "free";
  const correctIndex = Number(quiz.correctIndex);

  return {
    id: `local-question-${lesson.slug}-${quizIndex + 1}`,
    categoryId: learningModule.categoryId,
    moduleId: learningModule.id,
    lessonId: lesson.id,
    slug: lesson.slug,
    question: quiz.question,
    questionType: "single_choice",
    difficulty: lesson.difficulty,
    requiredPlan,
    answers: quiz.answers,
    correctAnswerIndexes: Number.isInteger(correctIndex) ? [correctIndex] : [0],
    explanation: quiz.explanation || "",
    examArea: category?.title || "Lernen",
    competenceArea: learningModule.title,
    tags: uniqueStrings([...learningModule.tags, ...lesson.tags]),
    relatedFaultCodes: uniqueStrings([
      ...learningModule.relatedFaultCodes,
      ...lesson.relatedFaultCodes,
    ]),
    relatedParts: uniqueStrings([
      ...learningModule.relatedParts,
      ...lesson.relatedParts,
    ]),
    relatedSystems: uniqueStrings([
      ...learningModule.relatedSystems,
      ...lesson.relatedSystems,
    ]),
    sortOrder: learningModule.sortOrder * 100 + lesson.sortOrder * 10 + quizIndex,
    isPublished: true,
    publishedAt: lesson.publishedAt,
    createdAt: lesson.createdAt,
    updatedAt: lesson.updatedAt,
    isLocked: !canAccessPlan(userPlan, requiredPlan),
  };
}

function loadLocalLearningQuestions(
  filter: LearningQuestionFilter = {}
): LearningQuestion[] {
  const userPlan = filter.userPlan || "free";
  const requestedCategory = filter.categorySlug
    ? LOCAL_LEARNING_CATEGORIES.find(
        (category) => category.slug === filter.categorySlug
      )
    : null;
  const requestedModule = filter.moduleSlug
    ? LOCAL_LEARNING_MODULES.find((module) => module.slug === filter.moduleSlug)
    : null;

  if (filter.questionType && filter.questionType !== "single_choice") {
    return [];
  }

  return LOCAL_LEARNING_LESSONS.flatMap((lesson) => {
    const learningModule = LOCAL_LEARNING_MODULES.find(
      (module) => module.id === lesson.moduleId
    );

    if (!learningModule) {
      return [];
    }

    if (requestedCategory && learningModule.categoryId !== requestedCategory.id) {
      return [];
    }

    if (filter.categorySlug && !requestedCategory) {
      return [];
    }

    if (requestedModule && learningModule.id !== requestedModule.id) {
      return [];
    }

    if (filter.moduleSlug && !requestedModule) {
      return [];
    }

    if (filter.lessonSlug && lesson.slug !== filter.lessonSlug) {
      return [];
    }

    return lesson.quizQuestions
      .map((_, quizIndex) =>
        convertLocalLessonQuestion(lesson, learningModule, quizIndex, userPlan)
      )
      .filter((question): question is LearningQuestion => Boolean(question));
  })
    .filter((question) => canAccessPlan(userPlan, question.requiredPlan))
    .filter((question) =>
      filter.difficulty ? question.difficulty === filter.difficulty : true
    )
    .filter((question) => includesAny(question.tags, filter.tags))
    .filter((question) =>
      includesAny(question.relatedFaultCodes, filter.faultCodes)
    )
    .filter((question) => includesAny(question.relatedParts, filter.parts))
    .filter((question) => includesAny(question.relatedSystems, filter.systems))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.question.localeCompare(b.question))
    .slice(0, normalizeLimit(filter.limit));
}

function loadLocalLearningQuestionById(
  questionId: string,
  userPlan: UserPlan = "free"
) {
  return (
    loadLocalLearningQuestions({
      userPlan,
      limit: 100,
    }).find((question) => question.id === questionId) || null
  );
}

export async function loadPublishedLearningQuestions(
  filter: LearningQuestionFilter = {}
): Promise<LearningQuestion[]> {
  const supabase = createSupabaseAdminClient();

  const userPlan = filter.userPlan || "free";
  const limit = normalizeLimit(filter.limit);
  const localQuestions = loadLocalLearningQuestions({
    ...filter,
    userPlan,
    limit,
  });
  let skipDatabaseQuery = false;

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
      skipDatabaseQuery = true;
    } else {
      query = query.eq("category_id", categoryData.id);
    }
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
      skipDatabaseQuery = true;
    } else {
      query = query.eq("module_id", moduleData.id);
    }
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
      skipDatabaseQuery = true;
    } else {
      query = query.eq("lesson_id", lessonData.id);
    }
  }

  let databaseQuestions: LearningQuestion[] = [];

  if (!skipDatabaseQuery) {
    const { data, error } = await query;

    if (error) {
      if (localQuestions.length > 0) {
        console.error("Fragen-Datenbank nicht erreichbar, lokale Lernfragen werden genutzt:", error);
        return localQuestions;
      }

      throw new Error(`Fragen konnten nicht geladen werden: ${error.message}`);
    }

    databaseQuestions = ((data || []) as LearningQuestionDatabaseRow[])
      .map((row) => convertQuestionRow(row, userPlan))
      .filter((question) => canAccessPlan(userPlan, question.requiredPlan));
  }

  const seenQuestionIds = new Set(databaseQuestions.map((question) => question.id));
  const mergedQuestions = [
    ...databaseQuestions,
    ...localQuestions.filter((question) => !seenQuestionIds.has(question.id)),
  ];

  return mergedQuestions
    .sort((a, b) => a.sortOrder - b.sortOrder || a.question.localeCompare(b.question))
    .slice(0, limit);
}

export async function loadLearningQuestionById(
  questionId: string,
  userPlan: UserPlan = "free"
): Promise<LearningQuestion | null> {
  if (questionId.startsWith("local-question-")) {
    return loadLocalLearningQuestionById(questionId, userPlan);
  }

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
    return loadLocalLearningQuestionById(questionId, userPlan);
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

  if (question.id.startsWith("local-question-")) {
    const selectedAnswerIndexes = normalizeNumberArray(
      params.selectedAnswerIndexes
    );

    return {
      id: `local-attempt-${question.id}-${Date.now()}`,
      userId: params.userId,
      questionId: params.questionId,
      selectedAnswerIndexes,
      isCorrect: arraysEqualAsSet(
        selectedAnswerIndexes,
        question.correctAnswerIndexes
      ),
      answeredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
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
