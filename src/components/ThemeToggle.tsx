"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "diagnosehub-theme";
const THEME_CHANGE_EVENT = "diagnosehub-theme-changed";

function getSystemTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return null;
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("diagnosehub-light", theme === "light");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function dispatchThemeChanged(theme: ThemeMode) {
  window.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, {
      detail: theme,
    })
  );
}

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const initialThemeTimer = window.setTimeout(() => {
      const initialTheme = getStoredTheme() ?? getSystemTheme();

      setTheme(initialTheme);
      applyTheme(initialTheme);
      setMounted(true);
    }, 0);

    function handleThemeChanged(event: Event) {
      const customEvent = event as CustomEvent<ThemeMode>;
      const nextTheme = customEvent.detail;

      if (nextTheme === "light" || nextTheme === "dark") {
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      const nextTheme = getStoredTheme() ?? getSystemTheme();

      setTheme(nextTheme);
      applyTheme(nextTheme);
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange(event: MediaQueryListEvent) {
      const storedTheme = getStoredTheme();

      if (storedTheme) {
        return;
      }

      const nextTheme: ThemeMode = event.matches ? "dark" : "light";

      setTheme(nextTheme);
      applyTheme(nextTheme);
      dispatchThemeChanged(nextTheme);
    }

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChanged);
    window.addEventListener("storage", handleStorageChange);
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      window.clearTimeout(initialThemeTimer);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChanged);
      window.removeEventListener("storage", handleStorageChange);
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    dispatchThemeChanged(nextTheme);
  }

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Design wird geladen"
        className="h-11 w-11 rounded-xl border border-slate-300 bg-white text-slate-700 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Helles Design aktivieren" : "Dunkles Design aktivieren"}
      title={isDark ? "Helles Design aktivieren" : "Dunkles Design aktivieren"}
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        {isDark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
