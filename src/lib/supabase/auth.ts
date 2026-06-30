import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

type AuthenticatedRequestUser = {
  accessToken: string;
  user: User;
  supabase: SupabaseClient;
};

function getSupabaseUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL fehlt.");
  }

  return supabaseUrl;
}

function getSupabaseAnonKey() {
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY oder NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt."
    );
  }

  return supabaseKey;
}

function getBearerToken(request: Request) {
  const authorizationHeader = request.headers.get("authorization") || "";

  if (!authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorizationHeader.slice("bearer ".length).trim();
}

function createAuthenticatedSupabaseClient(accessToken: string) {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function loadAuthenticatedUserFromRequest(
  request: Request
): Promise<AuthenticatedRequestUser> {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    throw new Error("Nicht eingeloggt. Supabase Access Token fehlt.");
  }

  const supabase = createAuthenticatedSupabaseClient(accessToken);

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    throw new Error(`Supabase-Session ungültig: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("Keine gültige Supabase-Session gefunden.");
  }

  return {
    accessToken,
    user: data.user,
    supabase,
  };
}