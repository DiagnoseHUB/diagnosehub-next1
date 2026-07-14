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

export class AuthenticatedRequestError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthenticatedRequestError";
    this.status = status;
  }
}

export function getAuthenticatedRequestErrorStatus(error: unknown, fallback = 500) {
  return error instanceof AuthenticatedRequestError ? error.status : fallback;
}

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
    throw new AuthenticatedRequestError(
      "Nicht eingeloggt. Supabase Access Token fehlt.",
      401
    );
  }

  const supabase = createAuthenticatedSupabaseClient(accessToken);

  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    throw new AuthenticatedRequestError(`Supabase-Session ungültig: ${error.message}`, 401);
  }

  if (!data.user) {
    throw new AuthenticatedRequestError("Keine gültige Supabase-Session gefunden.", 401);
  }

  return {
    accessToken,
    user: data.user,
    supabase,
  };
}
