import type { LearningDifficulty, LearningProgressStatus } from "@/types/learning";

export type LocalLearningProgressEntry = {
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
  moduleId: string;
  moduleSlug: string;
  moduleTitle: string;
  difficulty: LearningDifficulty;
  status: LearningProgressStatus;
  progressPercent: number;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export type LocalLearningAchievement = {
  id: string;
  lessonId: string;
  moduleId: string;
  title: string;
  description: string;
  earnedAt: string;
};

export type LocalLearningProgressStore = {
  lessons: Record<string, LocalLearningProgressEntry>;
  achievements: Record<string, LocalLearningAchievement>;
};

export type LessonProgressInput = {
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
  moduleId: string;
  moduleSlug: string;
  moduleTitle: string;
  difficulty: LearningDifficulty;
};

export const LEARNING_PROGRESS_STORAGE_KEY = "diagnosehub-learning-progress-v1";
export const LEARNING_PROGRESS_EVENT = "diagnosehub-learning-progress-change";

const EMPTY_PROGRESS_STORE: LocalLearningProgressStore = {
  lessons: {},
  achievements: {},
};

const SERVER_SNAPSHOT = JSON.stringify(EMPTY_PROGRESS_STORE);

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeProgressStore(value: unknown): LocalLearningProgressStore {
  if (!value || typeof value !== "object") {
    return EMPTY_PROGRESS_STORE;
  }

  const candidate = value as Partial<LocalLearningProgressStore>;

  return {
    lessons:
      candidate.lessons && typeof candidate.lessons === "object"
        ? candidate.lessons
        : {},
    achievements:
      candidate.achievements && typeof candidate.achievements === "object"
        ? candidate.achievements
        : {},
  };
}

export function readLearningProgressStore(): LocalLearningProgressStore {
  if (!isBrowser()) {
    return EMPTY_PROGRESS_STORE;
  }

  const rawValue = window.localStorage.getItem(LEARNING_PROGRESS_STORAGE_KEY);

  if (!rawValue) {
    return EMPTY_PROGRESS_STORE;
  }

  try {
    return normalizeProgressStore(JSON.parse(rawValue));
  } catch {
    return EMPTY_PROGRESS_STORE;
  }
}

function writeLearningProgressStore(store: LocalLearningProgressStore) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(LEARNING_PROGRESS_STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(LEARNING_PROGRESS_EVENT));
}

export function getLearningProgressSnapshot() {
  return JSON.stringify(readLearningProgressStore());
}

export function getLearningProgressServerSnapshot() {
  return SERVER_SNAPSHOT;
}

export function subscribeLearningProgress(listener: () => void) {
  if (!isBrowser()) {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === LEARNING_PROGRESS_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(LEARNING_PROGRESS_EVENT, listener);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LEARNING_PROGRESS_EVENT, listener);
  };
}

export function parseLearningProgressSnapshot(
  snapshot: string,
): LocalLearningProgressStore {
  try {
    return normalizeProgressStore(JSON.parse(snapshot));
  } catch {
    return EMPTY_PROGRESS_STORE;
  }
}

export function saveLocalLessonProgress(
  lesson: LessonProgressInput,
  status: Extract<LearningProgressStatus, "in_progress" | "completed">,
) {
  const store = readLearningProgressStore();
  const now = new Date().toISOString();
  const currentEntry = store.lessons[lesson.lessonId];
  const isCompleted = status === "completed";

  const nextEntry: LocalLearningProgressEntry = {
    ...lesson,
    status,
    progressPercent: isCompleted ? 100 : Math.max(currentEntry?.progressPercent || 35, 35),
    startedAt: currentEntry?.startedAt || now,
    completedAt: isCompleted ? currentEntry?.completedAt || now : currentEntry?.completedAt || null,
    updatedAt: now,
  };

  const achievementId = `lesson-completed:${lesson.lessonId}`;
  const nextAchievements = { ...store.achievements };

  if (isCompleted && !nextAchievements[achievementId]) {
    nextAchievements[achievementId] = {
      id: achievementId,
      lessonId: lesson.lessonId,
      moduleId: lesson.moduleId,
      title: `Gelernt: ${lesson.lessonTitle}`,
      description: `${lesson.moduleTitle} abgeschlossen`,
      earnedAt: now,
    };
  }

  const nextStore = {
    lessons: {
      ...store.lessons,
      [lesson.lessonId]: nextEntry,
    },
    achievements: nextAchievements,
  };

  writeLearningProgressStore(nextStore);

  return nextStore;
}
