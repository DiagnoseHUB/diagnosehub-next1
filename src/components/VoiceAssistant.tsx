"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type EditableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type VoiceAssistantProps = {
  placement?: "floating" | "inline";
  targetElementId?: string;
  targetLabel?: string;
};

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

const TEXT_INPUT_TYPES = new Set([
  "",
  "email",
  "number",
  "search",
  "tel",
  "text",
  "url",
]);

const DICTATION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bneue zeile\b/gi, "\n"],
  [/\bneuer absatz\b/gi, "\n\n"],
  [/\bkomma\b/gi, ","],
  [/\bpunkt\b/gi, "."],
  [/\bfragezeichen\b/gi, "?"],
  [/\bausrufezeichen\b/gi, "!"],
  [/\bdoppelpunkt\b/gi, ":"],
  [/\bstrichpunkt\b/gi, ";"],
];

function isTextInput(element: Element): element is HTMLInputElement {
  return (
    element instanceof HTMLInputElement &&
    TEXT_INPUT_TYPES.has(element.type.toLowerCase()) &&
    !element.readOnly &&
    !element.disabled
  );
}

function isEditableElement(element: EventTarget | null): element is EditableElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element instanceof HTMLTextAreaElement) {
    return !element.readOnly && !element.disabled;
  }

  if (isTextInput(element)) {
    return true;
  }

  return element.isContentEditable;
}

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  const box = element.getBoundingClientRect();

  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    box.width > 0 &&
    box.height > 0
  );
}

function findFallbackEditable() {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        "textarea",
        "input[type='search']",
        "input[type='text']",
        "input[type='email']",
        "input[type='tel']",
        "input[type='number']",
        "[contenteditable='true']",
      ].join(","),
    ),
  );

  return candidates.find((element) => isEditableElement(element) && isVisible(element)) ?? null;
}

function normalizeDictationText(value: string) {
  return DICTATION_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value.trim(),
  );
}

function withReadableSpacing(currentValue: string, insertValue: string, start: number) {
  const before = currentValue.slice(0, start);
  const after = currentValue.slice(start);
  const needsSpaceBefore =
    before.length > 0 &&
    !/[\s([{/"']$/.test(before) &&
    !/^[,.;:!?]/.test(insertValue);
  const needsSpaceAfter =
    after.length > 0 && !/^\s/.test(after) && !/[\n,.;:!?]/.test(insertValue);

  return `${needsSpaceBefore ? " " : ""}${insertValue}${needsSpaceAfter ? " " : ""}`;
}

function dispatchInputEvents(element: EditableElement) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function insertIntoTextControl(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const start = element.selectionStart ?? element.value.length;
  const end = element.selectionEnd ?? element.value.length;
  const insertion = withReadableSpacing(element.value, value, start);
  const nextValue = `${element.value.slice(0, start)}${insertion}${element.value.slice(end)}`;
  const nextCaret = start + insertion.length;

  element.value = nextValue;
  element.setSelectionRange(nextCaret, nextCaret);
  dispatchInputEvents(element);
}

function insertIntoContentEditable(element: HTMLElement, value: string) {
  element.focus();

  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    element.textContent = `${element.textContent || ""} ${value}`.trim();
    dispatchInputEvents(element);
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(value));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  dispatchInputEvents(element);
}

function insertDictation(element: EditableElement, transcript: string) {
  const normalizedText = normalizeDictationText(transcript);

  if (!normalizedText) {
    return;
  }

  element.focus();

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    insertIntoTextControl(element, normalizedText);
    return;
  }

  insertIntoContentEditable(element, normalizedText);
}

function getElementText(element: EditableElement | null) {
  if (!element) {
    return "";
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value.trim();
  }

  return (element.innerText || element.textContent || "").trim();
}

function getReadablePageText(activeElement: EditableElement | null) {
  const selectedText = window.getSelection()?.toString().trim();

  if (selectedText) {
    return selectedText;
  }

  const latestReadable = Array.from(
    document.querySelectorAll<HTMLElement>("[data-diagnosehub-read-aloud='answer']"),
  )
    .filter(isVisible)
    .at(-1);

  if (latestReadable) {
    return latestReadable.innerText.trim();
  }

  return getElementText(activeElement);
}

function getRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export default function VoiceAssistant({
  placement = "floating",
  targetElementId,
  targetLabel = "Textfeld",
}: VoiceAssistantProps) {
  const [mounted, setMounted] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState("");
  const activeElementRef = useRef<EditableElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const isInline = placement === "inline";

  useEffect(() => {
    const initializationId = window.setTimeout(() => {
      setMounted(true);
      setRecognitionSupported(Boolean(getRecognitionConstructor()));
      setSpeechSupported(
        "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
      );
    }, 0);

    function rememberActiveElement(event: FocusEvent) {
      if (isEditableElement(event.target)) {
        activeElementRef.current = event.target;
      }
    }

    document.addEventListener("focusin", rememberActiveElement);

    return () => {
      window.clearTimeout(initializationId);
      document.removeEventListener("focusin", rememberActiveElement);
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const getActiveEditable = useCallback(() => {
    if (targetElementId) {
      const targetElement = document.getElementById(targetElementId);

      if (isEditableElement(targetElement) && isVisible(targetElement)) {
        activeElementRef.current = targetElement;
        return targetElement;
      }
    }

    const activeElement = activeElementRef.current;

    if (activeElement && document.contains(activeElement) && isVisible(activeElement)) {
      return activeElement;
    }

    const fallback = findFallbackEditable();
    activeElementRef.current = fallback;
    return fallback;
  }, [targetElementId]);

  const stopDictation = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    setStatus("Diktat gestoppt.");
  }, []);

  const startDictation = useCallback(() => {
    const Recognition = getRecognitionConstructor();

    if (!Recognition) {
      setStatus("Spracheingabe wird von diesem Browser nicht unterstützt.");
      return;
    }

    const target = getActiveEditable();

    if (!target) {
      setStatus(`Bitte zuerst das ${targetLabel} antippen oder anklicken.`);
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      target.focus();
      activeElementRef.current = target;
      setListening(true);
      setStatus(`Ich höre zu. Gesprochener Text wird in das ${targetLabel} geschrieben.`);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = (event) => {
      setListening(false);
      setStatus(
        event.error === "not-allowed"
          ? "Mikrofonzugriff wurde blockiert."
          : "Spracheingabe konnte nicht gestartet werden.",
      );
    };

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript || "";

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript.trim()) {
        const currentTarget = getActiveEditable();

        if (currentTarget) {
          insertDictation(currentTarget, finalTranscript);
          setStatus("Text übernommen.");
        }
      } else if (interimTranscript.trim()) {
        setStatus(interimTranscript.trim());
      }
    };

    recognitionRef.current?.abort();
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setStatus("Spracheingabe läuft bereits oder konnte nicht gestartet werden.");
    }
  }, [getActiveEditable, targetLabel]);

  const toggleDictation = useCallback(() => {
    if (listening) {
      stopDictation();
      return;
    }

    startDictation();
  }, [listening, startDictation, stopDictation]);

  const readAloud = useCallback(() => {
    if (!speechSupported) {
      setStatus("Vorlesen wird von diesem Browser nicht unterstützt.");
      return;
    }

    const text = getReadablePageText(activeElementRef.current);

    if (!text) {
      setStatus("Zum Vorlesen bitte Text markieren oder ein Feld mit Text aktivieren.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text.slice(0, 5000));
    utterance.lang = "de-DE";
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.onstart = () => {
      setSpeaking(true);
      setStatus("Vorlesen läuft.");
    };
    utterance.onend = () => {
      setSpeaking(false);
      setStatus("Vorlesen beendet.");
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setStatus("Vorlesen konnte nicht gestartet werden.");
    };

    window.speechSynthesis.speak(utterance);
  }, [speechSupported]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setStatus("Vorlesen gestoppt.");
  }, []);

  const clearActiveField = useCallback(() => {
    const target = getActiveEditable();

    if (!target) {
      setStatus(`Bitte zuerst das ${targetLabel} antippen oder anklicken.`);
      return;
    }

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.value = "";
      dispatchInputEvents(target);
      target.focus();
    } else {
      target.textContent = "";
      dispatchInputEvents(target);
      target.focus();
    }

    setStatus("Feld geleert.");
  }, [getActiveEditable, targetLabel]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={
        isInline
          ? "mt-3 w-full"
          : "fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))]"
      }
    >
      <div
        className={
          isInline
            ? "rounded-2xl border border-slate-700 bg-slate-950/70 p-3 text-slate-100 shadow-inner shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-950/80"
            : "rounded-2xl border border-slate-700 bg-slate-950/95 p-3 text-slate-100 shadow-2xl shadow-slate-950/30 backdrop-blur dark:border-slate-700 dark:bg-slate-950/95"
        }
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleDictation}
            disabled={!recognitionSupported}
            className={
              listening
                ? "rounded-xl bg-red-600 px-3 py-2 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                : "rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            }
          >
            {listening ? "Diktat stoppen" : "Diktieren"}
          </button>

          <button
            type="button"
            onClick={readAloud}
            disabled={!speechSupported}
            className="rounded-xl border border-slate-600 px-3 py-2 text-sm font-bold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {speaking ? "Liest..." : "Vorlesen"}
          </button>

          <button
            type="button"
            onClick={stopSpeaking}
            disabled={!speaking}
            className="rounded-xl border border-slate-600 px-3 py-2 text-sm font-bold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Stopp
          </button>

          <button
            type="button"
            onClick={clearActiveField}
            className="rounded-xl border border-slate-600 px-3 py-2 text-sm font-bold text-slate-100 transition hover:bg-slate-800"
          >
            Feld leeren
          </button>
        </div>

        <p aria-live="polite" className="mt-2 text-xs leading-5 text-slate-300">
          {status ||
            (recognitionSupported
              ? `${targetLabel} anklicken und diktieren.`
              : "Spracheingabe ist in diesem Browser nicht verfügbar.")}
        </p>
      </div>
    </div>
  );
}
