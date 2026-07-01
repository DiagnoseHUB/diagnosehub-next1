import type { UserPlan } from "@/config/plans";
import type {
  LearningCategory,
  LearningCategoryWithModules,
  LearningContentBlock,
  LearningDifficulty,
  LearningLesson,
  LearningLessonDetail,
  LearningModule,
  LearningModuleDetail,
  LearningProgress,
  LearningProgressStatus,
  LearningQuizQuestion,
  RelatedLearningModule,
} from "@/types/learning";
import { createSupabaseAdminClient } from "./supabaseAdmin";

type LearningCategoryDatabaseRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type LearningModuleDatabaseRow = {
  id: string;
  category_id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: LearningDifficulty;
  required_plan: UserPlan;
  estimated_minutes: number;
  sort_order: number;
  tags: string[] | null;
  related_fault_codes: string[] | null;
  related_parts: string[] | null;
  related_systems: string[] | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type LearningLessonDatabaseRow = {
  id: string;
  module_id: string;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  difficulty: LearningDifficulty;
  required_plan: UserPlan;
  estimated_minutes: number;
  sort_order: number;
  content_blocks: unknown;
  checklist: unknown;
  quiz_questions: unknown;
  tags: string[] | null;
  related_fault_codes: string[] | null;
  related_parts: string[] | null;
  related_systems: string[] | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type LearningProgressDatabaseRow = {
  id: string;
  user_id: string;
  lesson_id: string;
  status: LearningProgressStatus;
  progress_percent: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type FindRelatedLearningModulesInput = {
  faultCodes?: string[];
  parts?: string[];
  systems?: string[];
  userPlan?: UserPlan;
  limit?: number;
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

function normalizeContentBlocks(value: unknown): LearningContentBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is LearningContentBlock => {
      return Boolean(entry) && typeof entry === "object";
    })
    .map((entry) => ({
      ...entry,
      type: typeof entry.type === "string" ? entry.type : "text",
    }));
}

function normalizeChecklist(value: unknown): string[] {
  return normalizeStringArray(value);
}

function normalizeQuizQuestions(value: unknown): LearningQuizQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): LearningQuizQuestion[] => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as {
      question?: unknown;
      answers?: unknown;
      correctIndex?: unknown;
      explanation?: unknown;
    };

    if (typeof candidate.question !== "string") {
      return [];
    }

    const answers = normalizeStringArray(candidate.answers);

    if (answers.length === 0) {
      return [];
    }

    const correctIndex = Number(candidate.correctIndex);

    return [
      {
        question: candidate.question,
        answers,
        correctIndex: Number.isInteger(correctIndex) ? correctIndex : 0,
        explanation:
          typeof candidate.explanation === "string"
            ? candidate.explanation
            : undefined,
      },
    ];
  });
}

function normalizeSearchToken(value: string) {
  return value.trim().toLowerCase();
}

function intersectionScore(sourceValues: string[], targetValues: string[]) {
  const sourceTokens = new Set(sourceValues.map(normalizeSearchToken));
  const targetTokens = new Set(targetValues.map(normalizeSearchToken));

  return Array.from(sourceTokens).filter((token) => targetTokens.has(token));
}

function convertCategoryRow(row: LearningCategoryDatabaseRow): LearningCategory {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || "",
    icon: row.icon || "book",
    sortOrder: row.sort_order ?? 100,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function convertModuleRow(
  row: LearningModuleDatabaseRow,
  userPlan: UserPlan = "free"
): LearningModule {
  return {
    id: row.id,
    categoryId: row.category_id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle || "",
    description: row.description || "",
    difficulty: row.difficulty || "basic",
    requiredPlan: row.required_plan || "free",
    estimatedMinutes: row.estimated_minutes ?? 15,
    sortOrder: row.sort_order ?? 100,
    tags: normalizeStringArray(row.tags),
    relatedFaultCodes: normalizeStringArray(row.related_fault_codes),
    relatedParts: normalizeStringArray(row.related_parts),
    relatedSystems: normalizeStringArray(row.related_systems),
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isLocked: !canAccessPlan(userPlan, row.required_plan || "free"),
  };
}

function convertLessonRow(
  row: LearningLessonDatabaseRow,
  userPlan: UserPlan = "free",
  includeProtectedContent = true
): LearningLesson {
  const isLocked = !canAccessPlan(userPlan, row.required_plan || "free");

  return {
    id: row.id,
    moduleId: row.module_id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle || "",
    summary: row.summary || "",
    difficulty: row.difficulty || "basic",
    requiredPlan: row.required_plan || "free",
    estimatedMinutes: row.estimated_minutes ?? 10,
    sortOrder: row.sort_order ?? 100,
    contentBlocks:
      isLocked && !includeProtectedContent
        ? []
        : normalizeContentBlocks(row.content_blocks),
    checklist:
      isLocked && !includeProtectedContent
        ? []
        : normalizeChecklist(row.checklist),
    quizQuestions:
      isLocked && !includeProtectedContent
        ? []
        : normalizeQuizQuestions(row.quiz_questions),
    tags: normalizeStringArray(row.tags),
    relatedFaultCodes: normalizeStringArray(row.related_fault_codes),
    relatedParts: normalizeStringArray(row.related_parts),
    relatedSystems: normalizeStringArray(row.related_systems),
    isPublished: Boolean(row.is_published),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isLocked,
  };
}

function convertProgressRow(row: LearningProgressDatabaseRow): LearningProgress {
  return {
    id: row.id,
    userId: row.user_id,
    lessonId: row.lesson_id,
    status: row.status || "not_started",
    progressPercent: row.progress_percent ?? 0,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadLearningCategories() {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("learning_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    throw new Error(`Lernkategorien konnten nicht geladen werden: ${error.message}`);
  }

  return ((data || []) as LearningCategoryDatabaseRow[]).map(convertCategoryRow);
}

export async function loadPublishedLearningModules(
  userPlan: UserPlan = "free"
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("learning_modules")
    .select("*")
    .eq("is_published", true)
    .not("published_at", "is", null)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    throw new Error(`Lernmodule konnten nicht geladen werden: ${error.message}`);
  }

  return ((data || []) as LearningModuleDatabaseRow[]).map((row) =>
    convertModuleRow(row, userPlan)
  );
}

export async function loadLearningOverview(
  userPlan: UserPlan = "free"
): Promise<LearningCategoryWithModules[]> {
  const [categories, modules] = await Promise.all([
    loadLearningCategories(),
    loadPublishedLearningModules(userPlan),
  ]);

  return categories.map((category) => ({
    ...category,
    modules: modules.filter((module) => module.categoryId === category.id),
  }));
}

export async function loadLearningModuleBySlug(
  slug: string,
  userPlan: UserPlan = "free"
): Promise<LearningModuleDetail | null> {
  const supabase = createSupabaseAdminClient();

  const { data: moduleData, error: moduleError } = await supabase
    .from("learning_modules")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .not("published_at", "is", null)
    .maybeSingle();

  if (moduleError) {
    throw new Error(`Lernmodul konnte nicht geladen werden: ${moduleError.message}`);
  }

  if (!moduleData) {
    return null;
  }

  const module = convertModuleRow(
    moduleData as LearningModuleDatabaseRow,
    userPlan
  );

  const { data: categoryData, error: categoryError } = await supabase
    .from("learning_categories")
    .select("*")
    .eq("id", module.categoryId)
    .eq("is_active", true)
    .maybeSingle();

  if (categoryError) {
    throw new Error(
      `Lernkategorie konnte nicht geladen werden: ${categoryError.message}`
    );
  }

  if (!categoryData) {
    return null;
  }

  const { data: lessonsData, error: lessonsError } = await supabase
    .from("learning_lessons")
    .select("*")
    .eq("module_id", module.id)
    .eq("is_published", true)
    .not("published_at", "is", null)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (lessonsError) {
    throw new Error(`Lektionen konnten nicht geladen werden: ${lessonsError.message}`);
  }

  const lessons = ((lessonsData || []) as LearningLessonDatabaseRow[]).map(
    (row) => convertLessonRow(row, userPlan, false)
  );

  return {
    category: convertCategoryRow(categoryData as LearningCategoryDatabaseRow),
    module,
    lessons,
    hasAccess: !module.isLocked,
  };
}

export async function loadLearningLessonBySlug(
  slug: string,
  userPlan: UserPlan = "free"
): Promise<LearningLessonDetail | null> {
  const supabase = createSupabaseAdminClient();

  const { data: lessonData, error: lessonError } = await supabase
    .from("learning_lessons")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .not("published_at", "is", null)
    .maybeSingle();

  if (lessonError) {
    throw new Error(`Lektion konnte nicht geladen werden: ${lessonError.message}`);
  }

  if (!lessonData) {
    return null;
  }

  const lessonRow = lessonData as LearningLessonDatabaseRow;

  const { data: moduleData, error: moduleError } = await supabase
    .from("learning_modules")
    .select("*")
    .eq("id", lessonRow.module_id)
    .eq("is_published", true)
    .not("published_at", "is", null)
    .maybeSingle();

  if (moduleError) {
    throw new Error(`Lernmodul konnte nicht geladen werden: ${moduleError.message}`);
  }

  if (!moduleData) {
    return null;
  }

  const module = convertModuleRow(
    moduleData as LearningModuleDatabaseRow,
    userPlan
  );

  const { data: categoryData, error: categoryError } = await supabase
    .from("learning_categories")
    .select("*")
    .eq("id", module.categoryId)
    .eq("is_active", true)
    .maybeSingle();

  if (categoryError) {
    throw new Error(
      `Lernkategorie konnte nicht geladen werden: ${categoryError.message}`
    );
  }

  if (!categoryData) {
    return null;
  }

  const lesson = convertLessonRow(lessonRow, userPlan, false);
  const hasAccess = !module.isLocked && !lesson.isLocked;

  return {
    category: convertCategoryRow(categoryData as LearningCategoryDatabaseRow),
    module,
    lesson,
    hasAccess,
  };
}

export async function findRelatedLearningModules({
  faultCodes = [],
  parts = [],
  systems = [],
  userPlan = "free",
  limit = 6,
}: FindRelatedLearningModulesInput): Promise<RelatedLearningModule[]> {
  const modules = await loadPublishedLearningModules(userPlan);

  const scoredModules = modules
    .map((module) => {
      const matchedFaultCodes = intersectionScore(
        faultCodes,
        module.relatedFaultCodes
      );
      const matchedParts = intersectionScore(parts, module.relatedParts);
      const matchedSystems = intersectionScore(systems, module.relatedSystems);

      const score =
        matchedFaultCodes.length * 10 +
        matchedParts.length * 6 +
        matchedSystems.length * 4;

      return {
        ...module,
        score,
        matchedFaultCodes,
        matchedParts,
        matchedSystems,
      };
    })
    .filter((module) => module.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scoredModules;
}

export async function loadLearningProgressForUser(userId: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("learning_progress")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      `Lernfortschritt konnte nicht geladen werden: ${error.message}`
    );
  }

  return ((data || []) as LearningProgressDatabaseRow[]).map(convertProgressRow);
}

export async function saveLearningProgress(params: {
  userId: string;
  lessonId: string;
  status: LearningProgressStatus;
  progressPercent: number;
}) {
  const supabase = createSupabaseAdminClient();

  const now = new Date().toISOString();
  const progressPercent = Math.min(Math.max(params.progressPercent, 0), 100);
  const completedAt = params.status === "completed" ? now : null;

  const { data, error } = await supabase
    .from("learning_progress")
    .upsert(
      {
        user_id: params.userId,
        lesson_id: params.lessonId,
        status: params.status,
        progress_percent: progressPercent,
        started_at: now,
        completed_at: completedAt,
        updated_at: now,
      },
      {
        onConflict: "user_id,lesson_id",
      }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Lernfortschritt konnte nicht gespeichert werden: ${error.message}`
    );
  }

  return convertProgressRow(data as LearningProgressDatabaseRow);
}