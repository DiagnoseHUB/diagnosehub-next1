import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MobileAuthBody = {
  email?: unknown;
  password?: unknown;
};

type MobileSession = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
} | null;

type MobileUser = {
  id?: string;
  email?: string;
} | null;

function getSupabaseUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL fehlt.");
  }

  return supabaseUrl;
}

function getSupabaseAnonKey() {
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY oder NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt."
    );
  }

  return supabaseKey;
}

function cleanEmail(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase().slice(0, 320);
}

function cleanPassword(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.slice(0, 200);
}

function createMobileSupabaseClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function serializeMobileSession(session: MobileSession, user: MobileUser) {
  if (!session?.access_token || !session.refresh_token) {
    throw new Error("Supabase hat keine vollständige Session geliefert.");
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
    expiresIn: session.expires_in ?? null,
    tokenType: session.token_type ?? "bearer",
    user: {
      id: user?.id ?? null,
      email: user?.email ?? null,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as MobileAuthBody;
    const email = cleanEmail(body.email);
    const password = cleanPassword(body.password);

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-Mail und Passwort sind erforderlich." },
        { status: 400 }
      );
    }

    const supabase = createMobileSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: `Anmeldung fehlgeschlagen: ${error.message}` },
        { status: 401 }
      );
    }

    return NextResponse.json(serializeMobileSession(data.session, data.user));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mobile Anmeldung konnte nicht verarbeitet werden.",
      },
      { status: 500 }
    );
  }
}
