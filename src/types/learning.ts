import type { UserPlan } from "@/config/plans";

export type LearningDifficulty = "basic" | "intermediate" | "advanced";

export type LearningProgressStatus =
  | "not_started"
  | "in_progress"
  | "completed";

export type LearningQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "text";

export type LearningContentBlock = {
  type: string;
  title?: string;
  content?: string;
  items?: string[];
  [key: string]: unknown;
};

export type LearningQuizQuestion = {
  question: string;
  answers: string[];
  correctIndex: number;
  explanation?: string;
};

export type LearningCategory = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LearningModule = {
  id: string;
  categoryId: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: LearningDifficulty;
  requiredPlan: UserPlan;
  estimatedMinutes: number;
  sortOrder: number;
  tags: string[];
  relatedFaultCodes: string[];
  relatedParts: string[];
  relatedSystems: string[];
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isLocked?: boolean;
};

export type LearningLesson = {
  id: string;
  moduleId: string;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  difficulty: LearningDifficulty;
  requiredPlan: UserPlan;
  estimatedMinutes: number;
  sortOrder: number;
  contentBlocks: LearningContentBlock[];
  checklist: string[];
  quizQuestions: LearningQuizQuestion[];
  tags: string[];
  relatedFaultCodes: string[];
  relatedParts: string[];
  relatedSystems: string[];
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isLocked?: boolean;
};

export type LearningProgress = {
  id: string;
  userId: string;
  lessonId: string;
  status: LearningProgressStatus;
  progressPercent: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LearningQuestion = {
  id: string;
  categoryId: string | null;
  moduleId: string | null;
  lessonId: string | null;
  slug: string | null;
  question: string;
  questionType: LearningQuestionType;
  difficulty: LearningDifficulty;
  requiredPlan: UserPlan;
  answers: string[];
  correctAnswerIndexes: number[];
  explanation: string;
  examArea: string;
  competenceArea: string;
  tags: string[];
  relatedFaultCodes: string[];
  relatedParts: string[];
  relatedSystems: string[];
  sortOrder: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isLocked?: boolean;
};

export type LearningQuestionAttempt = {
  id: string;
  userId: string;
  questionId: string;
  selectedAnswerIndexes: number[];
  isCorrect: boolean;
  answeredAt: string;
  createdAt: string;
};

export type LearningCategoryWithModules = LearningCategory & {
  modules: LearningModule[];
};

export type LearningModuleDetail = {
  category: LearningCategory;
  module: LearningModule;
  lessons: LearningLesson[];
  hasAccess: boolean;
};

export type LearningLessonDetail = {
  category: LearningCategory;
  module: LearningModule;
  lesson: LearningLesson;
  hasAccess: boolean;
};

export type RelatedLearningModule = LearningModule & {
  score: number;
  matchedFaultCodes: string[];
  matchedParts: string[];
  matchedSystems: string[];
};

export type LearningQuestionFilter = {
  userPlan?: UserPlan;
  categorySlug?: string;
  moduleSlug?: string;
  lessonSlug?: string;
  difficulty?: LearningDifficulty;
  questionType?: LearningQuestionType;
  tags?: string[];
  faultCodes?: string[];
  parts?: string[];
  systems?: string[];
  limit?: number;
};

export type LearningQuestionAnswerResult = {
  questionId: string;
  selectedAnswerIndexes: number[];
  correctAnswerIndexes: number[];
  isCorrect: boolean;
  explanation: string;
};