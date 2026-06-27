"use client";

import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "diagnosehub-theme";

function applyTheme(theme: ThemeMode) {
  if (theme === "light") {
    document.documentElement.classList.add("diagnosehub-light");
  } else {
    document.documentElement.classList.remove("diagnosehub-light");
  }
}

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return "dark";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const initialTheme = getInitialTheme();

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-lg text-slate-300 transition hover:bg-slate-800 hover:text-white"
      aria-label={isLight ? "Dunkelmodus aktivieren" : "Hellmodus aktivieren"}
      title={isLight ? "Dunkelmodus aktivieren" : "Hellmodus aktivieren"}
    >
      {isLight ? "🌙" : "☀️"}
    </button>
  );
}