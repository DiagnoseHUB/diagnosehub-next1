import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";

function getSiteUrl() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "http://localhost:3000";

  if (siteUrl.startsWith("http://") || siteUrl.startsWith("https://")) {
    return siteUrl.replace(/\/$/, "");
  }

  return `https://${siteUrl.replace(/\/$/, "")}`;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  const redirectUrl = new URL("/service-erinnerung", getSiteUrl());

  if (!/^[0-9a-fA-F-]{36}$/.test(token)) {
    redirectUrl.searchParams.set("serviceMail", "invalid");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("service_reminder_notification_settings")
    .update({
      email_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("unsubscribe_token", token);

  redirectUrl.searchParams.set("serviceMail", error ? "error" : "disabled");

  return NextResponse.redirect(redirectUrl);
}
