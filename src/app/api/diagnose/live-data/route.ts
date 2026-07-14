import { NextResponse } from "next/server";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { interpretLiveData } from "@/services/liveDataInterpreter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LiveDataRequestBody = {
  rawText?: unknown;
};

function cleanText(value: unknown, maxLength = 12000) {
  return typeof value === "string"
    ? value.trim().replace(/\r\n/g, "\n").slice(0, maxLength)
    : "";
}

export async function POST(request: Request) {
  try {
    await loadAuthenticatedUserFromRequest(request);
    const body = (await request.json().catch(() => ({}))) as LiveDataRequestBody;
    const rawText = cleanText(body.rawText);

    if (!rawText) {
      return NextResponse.json(
        {
          error: "Bitte füge einen Messwertblock oder Live-Daten ein.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      interpretation: interpretLiveData(rawText),
    });
  } catch (error) {
    console.error("Live-Daten konnten nicht interpretiert werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Live-Daten konnten nicht interpretiert werden.",
      },
      { status: 500 },
    );
  }
}
