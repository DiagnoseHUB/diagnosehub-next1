import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const themeScript = `
(function () {
  try {
    var storageKey = "diagnosehub-theme";
    var legacyKeys = ["theme", "diagnosehub-color-theme", "diagnosehub-theme-mode"];
    var theme = localStorage.getItem(storageKey);

    if (theme !== "light" && theme !== "dark") {
      for (var i = 0; i < legacyKeys.length; i++) {
        var legacyTheme = localStorage.getItem(legacyKeys[i]);

        if (legacyTheme === "light" || legacyTheme === "dark") {
          theme = legacyTheme;
          localStorage.setItem(storageKey, theme);
          break;
        }
      }
    }

    if (theme !== "light" && theme !== "dark") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.remove("diagnosehub-light");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("diagnosehub-light");
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;

export const metadata: Metadata = {
  title: "DiagnoseHUB",
  description:
    "KI-Diagnose, Prüfprotokolle und Lernplattform für Kfz-Werkstätten.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>

      <body className="flex min-h-full flex-col bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}