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
    var theme = localStorage.getItem(storageKey);

    if (theme !== "light" && theme !== "dark") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    var root = document.documentElement;

    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("diagnosehub-light", theme === "light");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch (error) {
    var fallbackRoot = document.documentElement;

    fallbackRoot.classList.add("dark");
    fallbackRoot.classList.remove("diagnosehub-light");
    fallbackRoot.dataset.theme = "dark";
    fallbackRoot.style.colorScheme = "dark";
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
