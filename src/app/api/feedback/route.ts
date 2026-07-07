import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedbackRequestBody = {
  name?: string;
  email?: string;
  message?: string;
  page?: string;
  company?: string;
  feedbackType?: string;
  rating?: string;
  missingInfo?: boolean;
  caseTitle?: string;
  caseContext?: string;
};

type ResendEmailResponse = {
  id?: string;
  message?: string;
  error?: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} ist nicht gesetzt.`);
  }

  return value;
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildFeedbackText(input: {
  name: string;
  email: string;
  page: string;
  message: string;
  feedbackType: string;
  rating: string;
  missingInfo: boolean;
  caseTitle: string;
  caseContext: string;
}) {
  return [
    "Neues DiagnoseHUB Feedback",
    "",
    `Typ: ${input.feedbackType}`,
    `Bewertung: ${input.rating || "Nicht angegeben"}`,
    `Fehlende Info gemeldet: ${input.missingInfo ? "Ja" : "Nein"}`,
    `Fall: ${input.caseTitle || "Nicht angegeben"}`,
    `Name: ${input.name || "Nicht angegeben"}`,
    `E-Mail: ${input.email || "Nicht angegeben"}`,
    `Seite: ${input.page || "Nicht angegeben"}`,
    "",
    "Feedback:",
    input.message,
    "",
    "Fallkontext:",
    input.caseContext || "Nicht angegeben",
  ].join("\n");
}

function buildFeedbackHtml(input: {
  name: string;
  email: string;
  page: string;
  message: string;
  feedbackType: string;
  rating: string;
  missingInfo: boolean;
  caseTitle: string;
  caseContext: string;
}) {
  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h1>Neues DiagnoseHUB Feedback</h1>
      <p><strong>Typ:</strong> ${escapeHtml(input.feedbackType)}</p>
      <p><strong>Bewertung:</strong> ${escapeHtml(input.rating || "Nicht angegeben")}</p>
      <p><strong>Fehlende Info gemeldet:</strong> ${input.missingInfo ? "Ja" : "Nein"}</p>
      <p><strong>Fall:</strong> ${escapeHtml(input.caseTitle || "Nicht angegeben")}</p>
      <p><strong>Name:</strong> ${escapeHtml(input.name || "Nicht angegeben")}</p>
      <p><strong>E-Mail:</strong> ${escapeHtml(input.email || "Nicht angegeben")}</p>
      <p><strong>Seite:</strong> ${escapeHtml(input.page || "Nicht angegeben")}</p>
      <hr />
      <p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>
      <hr />
      <h2>Fallkontext</h2>
      <p style="white-space:pre-wrap">${escapeHtml(input.caseContext || "Nicht angegeben")}</p>
    </div>
  `;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeedbackRequestBody;

    if (body.company) {
      return NextResponse.json({ ok: true });
    }

    const name = sanitizeText(body.name, 120);
    const email = sanitizeText(body.email, 180).toLowerCase();
    const page = sanitizeText(body.page, 300);
    const rawMessage = sanitizeText(body.message, 4000);
    const feedbackType = body.feedbackType === "case" ? "Fallfeedback" : "Allgemein";
    const rating =
      body.rating === "up"
        ? "Daumen hoch"
        : body.rating === "down"
          ? "Daumen runter"
          : "";
    const missingInfo = Boolean(body.missingInfo);
    const caseTitle = sanitizeText(body.caseTitle, 240);
    const caseContext = sanitizeText(body.caseContext, 3500);
    const message =
      rawMessage ||
      (rating || missingInfo
        ? "Fallfeedback ohne weiteren Kommentar."
        : "");

    if (message.length < 5) {
      return NextResponse.json(
        { error: "Bitte schreibe kurz, worum es geht." },
        { status: 400 }
      );
    }

    if (email && !email.includes("@")) {
      return NextResponse.json(
        { error: "Die E-Mail-Adresse ist nicht gültig." },
        { status: 400 }
      );
    }

    const resendApiKey = getRequiredEnv("RESEND_API_KEY");
    const from =
      process.env.FEEDBACK_EMAIL_FROM?.trim() ||
      getRequiredEnv("SERVICE_REMINDER_EMAIL_FROM");
    const to = process.env.FEEDBACK_EMAIL_TO?.trim() || "info@diagnosehub.de";
    const payload = {
      name,
      email,
      page,
      message,
      feedbackType,
      rating,
      missingInfo,
      caseTitle,
      caseContext,
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject:
          feedbackType === "Fallfeedback"
            ? "DiagnoseHUB Fallfeedback"
            : "DiagnoseHUB Feedback",
        html: buildFeedbackHtml(payload),
        text: buildFeedbackText(payload),
      }),
    });
    const responseText = await response.text();
    let responseJson: ResendEmailResponse = {};

    try {
      responseJson = JSON.parse(responseText) as ResendEmailResponse;
    } catch {
      responseJson = { message: responseText };
    }

    if (!response.ok) {
      throw new Error(
        responseJson.message ||
          responseJson.error ||
          `Feedback konnte nicht gesendet werden. Status: ${response.status}`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Feedback konnte nicht gesendet werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Feedback konnte nicht gesendet werden.",
      },
      { status: 500 }
    );
  }
}
