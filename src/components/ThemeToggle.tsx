"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "diagnosehub-theme";

const legacyThemeStorageKeys = [
  "theme",
  "diagnosehub-color-theme",
  "diagnosehub-theme-mode",
];

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

function readStoredTheme(): ThemeMode | null {
  try {
    const currentTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (isThemeMode(currentTheme)) {
      return currentTheme;
    }

    for (const key of legacyThemeStorageKeys) {
      const legacyTheme = localStorage.getItem(key);

      if (isThemeMode(legacyTheme)) {
        localStorage.setItem(THEME_STORAGE_KEY, legacyTheme);
        return legacyTheme;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getSystemTheme(): ThemeMode {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

function getInitialTheme(): ThemeMode {
  return readStoredTheme() || getSystemTheme();
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;

  root.classList.toggle("dark", theme === "dark");
  root.classList.remove("diagnosehub-light");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function saveTheme(theme: ThemeMode) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);

  for (const key of legacyThemeStorageKeys) {
    localStorage.removeItem(key);
  }
}

function dispatchThemeEvent(theme: ThemeMode) {
  window.dispatchEvent(
    new CustomEvent("diagnosehub-theme-updated", {
      detail: {
        theme,
      },
    })
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initialTheme = getInitialTheme();

    applyTheme(initialTheme);
    setTheme(initialTheme);
    setMounted(true);

    function handleStorageChange(event: StorageEvent) {
      if (
        event.key &&
        event.key !== THEME_STORAGE_KEY &&
        !legacyThemeStorageKeys.includes(event.key)
      ) {
        return;
      }

      const nextTheme = getInitialTheme();

      applyTheme(nextTheme);
      setTheme(nextTheme);
    }

    function handleThemeUpdated(event: Event) {
      const customEvent = event as CustomEvent<{ theme?: unknown }>;
      const nextTheme = customEvent.detail?.theme;

      if (!isThemeMode(nextTheme)) {
        return;
      }

      applyTheme(nextTheme);
      setTheme(nextTheme);
    }

    const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange() {
      const storedTheme = readStoredTheme();

      if (storedTheme) {
        return;
      }

      const nextTheme = getSystemTheme();

      applyTheme(nextTheme);
      setTheme(nextTheme);
    }

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("diagnosehub-theme-updated", handleThemeUpdated);
    systemThemeQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "diagnosehub-theme-updated",
        handleThemeUpdated
      );
      systemThemeQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";

    saveTheme(nextTheme);
    applyTheme(nextTheme);
    setTheme(nextTheme);
    dispatchThemeEvent(nextTheme);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Hellmodus aktivieren" : "Dunkelmodus aktivieren"}
      aria-pressed={isDark}
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      <span className="text-base">{mounted && isDark ? "☀️" : "🌙"}</span>

      <span className="hidden sm:inline">
        {mounted ? (isDark ? "Hell" : "Dunkel") : "Theme"}
      </span>
    </button>
  );
}