import { NextRequest, NextResponse } from "next/server";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

export const runtime = "nodejs";

type StripeCheckoutResponse = {
  id?: string;
  url?: string;
  error?: {
    message?: string;
  };
};

type CheckoutPlan = "pro" | "service_reminder";

const SERVICE_REMINDER_PRICE_ID = "price_1TpVO842X13b5UMoMVnPM0Dd";

function getBaseUrl(request: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (envUrl) {
    const normalizedEnvUrl = envUrl.startsWith("//")
      ? `https:${envUrl}`
      : /^https?:\/\//i.test(envUrl)
        ? envUrl
        : `https://${envUrl}`;

    return new URL(normalizedEnvUrl).origin;
  }

  return new URL(request.nextUrl.origin).origin;
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} fehlt. Bitte in .env.local eintragen und Server neu starten.`);
  }

  return value;
}

function createAuthenticatedSupabaseClient(accessToken: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL fehlt in .env.local.");
  }

  if (!supabaseKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY oder NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt in .env.local."
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
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

async function loadUserFromAuthorizationHeader(
  request: NextRequest
): Promise<User | null> {
  const authorizationHeader = request.headers.get("authorization") || "";

  if (!authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const accessToken = authorizationHeader.slice("bearer ".length).trim();

  if (!accessToken) {
    return null;
  }

  const supabase = createAuthenticatedSupabaseClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    throw new Error(`Supabase-Session ungültig: ${error.message}`);
  }

  return data.user ?? null;
}

async function createStripeCheckoutSession({
  request,
  user,
  plan,
}: {
  request: NextRequest;
  user: User | null;
  plan: CheckoutPlan;
}) {
  const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");
  const priceId =
    plan === "service_reminder"
      ? process.env.STRIPE_SERVICE_REMINDER_PRICE_ID?.trim() ||
        SERVICE_REMINDER_PRICE_ID
      : getRequiredEnv("STRIPE_PRO_PRICE_ID");
  const baseUrl = getBaseUrl(request);

  const body = new URLSearchParams();

  body.set("mode", "subscription");
  body.set("line_items[0][price]", priceId);
  body.set("line_items[0][quantity]", "1");

  body.set(
    "success_url",
    `${baseUrl}/zahlung/erfolg?session_id={CHECKOUT_SESSION_ID}`
  );
  body.set("cancel_url", `${baseUrl}/preise`);

  body.set("allow_promotion_codes", "true");
  body.set("billing_address_collection", "required");
  body.set("locale", "de");
  body.set("automatic_tax[enabled]", "false");

  body.set("metadata[plan]", plan);
  body.set("metadata[source]", "diagnosehub_checkout");

  body.set("subscription_data[metadata][plan]", plan);
  body.set("subscription_data[metadata][source]", "diagnosehub_checkout");

  if (user) {
    body.set("client_reference_id", user.id);
    body.set("metadata[supabase_user_id]", user.id);
    body.set("subscription_data[metadata][supabase_user_id]", user.id);

    if (user.email) {
      body.set("customer_email", user.email);
      body.set("metadata[user_email]", user.email);
      body.set("subscription_data[metadata][user_email]", user.email);
    }
  } else {
    body.set("metadata[checkout_mode]", "legacy_without_user");
    body.set("subscription_data[metadata][checkout_mode]", "legacy_without_user");
  }

  const stripeResponse = await fetch(
    "https://api.stripe.com/v1/checkout/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  const stripeText = await stripeResponse.text();

  let stripeData: StripeCheckoutResponse = {};

  try {
    stripeData = JSON.parse(stripeText) as StripeCheckoutResponse;
  } catch {
    throw new Error(
      "Stripe hat keine gültige JSON-Antwort geliefert: " +
        stripeText.slice(0, 300)
    );
  }

  if (!stripeResponse.ok) {
    throw new Error(
      stripeData.error?.message ||
        `Stripe-Checkout konnte nicht erstellt werden. Status: ${stripeResponse.status}`
    );
  }

  if (!stripeData.url) {
    throw new Error("Stripe hat keine Checkout-URL zurückgegeben.");
  }

  return stripeData;
}

async function readPlanFromRequest(request: NextRequest) {
  const planFromSearch = request.nextUrl.searchParams.get("plan");

  if (planFromSearch) {
    return planFromSearch;
  }

  try {
    const body = (await request.json()) as {
      plan?: unknown;
    };

    if (typeof body.plan === "string") {
      return body.plan;
    }
  } catch {
    return null;
  }

  return null;
}

function validatePlan(plan: string | null) {
  if (plan !== "pro" && plan !== "service_reminder") {
    return NextResponse.json(
      { error: "Ungültiger Tarif." },
      { status: 400 }
    );
  }

  return null;
}

function toCheckoutPlan(plan: string | null): CheckoutPlan {
  return plan === "service_reminder" ? "service_reminder" : "pro";
}

export async function GET(request: NextRequest) {
  try {
    const plan = request.nextUrl.searchParams.get("plan");
    const planError = validatePlan(plan);

    if (planError) {
      return planError;
    }

    const stripeSession = await createStripeCheckoutSession({
      request,
      user: null,
      plan: toCheckoutPlan(plan),
    });

    return NextResponse.redirect(stripeSession.url as string, 303);
  } catch (error) {
    console.error("Stripe Checkout Fehler:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Interner Fehler beim Stripe-Checkout.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const plan = await readPlanFromRequest(request);
    const planError = validatePlan(plan);

    if (planError) {
      return planError;
    }

    const user = await loadUserFromAuthorizationHeader(request);

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Du musst eingeloggt sein, damit der Pro-Zugang deinem Account zugeordnet werden kann.",
        },
        { status: 401 }
      );
    }

    const stripeSession = await createStripeCheckoutSession({
      request,
      user,
      plan: toCheckoutPlan(plan),
    });

    return NextResponse.json({
      url: stripeSession.url,
    });
  } catch (error) {
    console.error("Stripe Checkout Fehler:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Interner Fehler beim Stripe-Checkout.",
      },
      { status: 500 }
    );
  }
}
