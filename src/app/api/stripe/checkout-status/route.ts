import { NextRequest, NextResponse } from "next/server";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

export const runtime = "nodejs";

type UserPlan = "free" | "pro";
type CheckoutPlan = "pro" | "service_reminder";

type StripeObject = Record<string, unknown>;

type StripeCheckoutSession = StripeObject & {
  id?: string;
  mode?: string;
  status?: string;
  payment_status?: string;
  client_reference_id?: string;
  customer?: string | StripeObject | null;
  customer_email?: string | null;
  subscription?: string | StripeObject | null;
  metadata?: Record<string, string> | null;
  error?: {
    message?: string;
  };
};

type ProfileUpdateInput = {
  supabaseUserId: string;
  plan: UserPlan;
  email?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionStatus?: string | null;
  stripePriceId?: string | null;
  stripeCurrentPeriodEnd?: string | null;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} fehlt in .env.local.`);
  }

  return value;
}

function getOptionalEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function createAuthenticatedSupabaseClient(accessToken: string): SupabaseClient {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey =
    getOptionalEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    getOptionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

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

function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
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

function getStringValue(object: StripeObject | null | undefined, key: string) {
  if (!object) {
    return null;
  }

  const value = object[key];

  if (typeof value === "string") {
    return value;
  }

  return null;
}

function getNumberValue(object: StripeObject | null | undefined, key: string) {
  if (!object) {
    return null;
  }

  const value = object[key];

  if (typeof value === "number") {
    return value;
  }

  return null;
}

function getObjectValue(
  object: StripeObject | null | undefined,
  key: string
): StripeObject | null {
  if (!object) {
    return null;
  }

  const value = object[key];

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as StripeObject;
  }

  return null;
}

function getCustomerId(session: StripeCheckoutSession) {
  const customer = session.customer;

  if (typeof customer === "string") {
    return customer;
  }

  if (customer && typeof customer === "object" && !Array.isArray(customer)) {
    return getStringValue(customer as StripeObject, "id");
  }

  return null;
}

function getSubscriptionObject(session: StripeCheckoutSession) {
  if (
    session.subscription &&
    typeof session.subscription === "object" &&
    !Array.isArray(session.subscription)
  ) {
    return session.subscription as StripeObject;
  }

  return null;
}

function getSubscriptionId(session: StripeCheckoutSession) {
  const subscription = session.subscription;

  if (typeof subscription === "string") {
    return subscription;
  }

  if (
    subscription &&
    typeof subscription === "object" &&
    !Array.isArray(subscription)
  ) {
    return getStringValue(subscription as StripeObject, "id");
  }

  return null;
}

function getPriceIdFromSession(session: StripeCheckoutSession) {
  const lineItems = getObjectValue(session, "line_items");
  const data = lineItems?.data;

  if (Array.isArray(data) && data.length > 0) {
    const firstItem = data[0];

    if (firstItem && typeof firstItem === "object" && !Array.isArray(firstItem)) {
      const price = (firstItem as StripeObject).price;

      if (price && typeof price === "object" && !Array.isArray(price)) {
        const priceId = getStringValue(price as StripeObject, "id");

        if (priceId) {
          return priceId;
        }
      }
    }
  }

  const subscription = getSubscriptionObject(session);
  const items = getObjectValue(subscription, "items");
  const itemData = items?.data;

  if (Array.isArray(itemData) && itemData.length > 0) {
    const firstSubscriptionItem = itemData[0];

    if (
      firstSubscriptionItem &&
      typeof firstSubscriptionItem === "object" &&
      !Array.isArray(firstSubscriptionItem)
    ) {
      const price = (firstSubscriptionItem as StripeObject).price;

      if (price && typeof price === "object" && !Array.isArray(price)) {
        return getStringValue(price as StripeObject, "id");
      }
    }
  }

  return process.env.STRIPE_PRO_PRICE_ID || null;
}

function convertUnixTimestampToIso(timestamp: number | null) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

function getSubscriptionStatus(session: StripeCheckoutSession) {
  const subscription = getSubscriptionObject(session);

  if (!subscription) {
    return "active";
  }

  return getStringValue(subscription, "status") || "active";
}

function getSubscriptionPeriodEnd(session: StripeCheckoutSession) {
  const subscription = getSubscriptionObject(session);

  if (!subscription) {
    return null;
  }

  return convertUnixTimestampToIso(
    getNumberValue(subscription, "current_period_end")
  );
}

function getSessionSupabaseUserId(session: StripeCheckoutSession) {
  const metadataUserId = session.metadata?.supabase_user_id;

  if (metadataUserId) {
    return metadataUserId;
  }

  if (typeof session.client_reference_id === "string") {
    return session.client_reference_id;
  }

  return null;
}

function getCheckoutPlan(session: StripeCheckoutSession): CheckoutPlan {
  return session.metadata?.plan === "service_reminder" ? "service_reminder" : "pro";
}

async function retrieveStripeCheckoutSession(sessionId: string) {
  const stripeSecretKey = getRequiredEnv("STRIPE_SECRET_KEY");

  const params = new URLSearchParams();

  params.append("expand[]", "subscription");
  params.append("expand[]", "subscription.items.data.price");
  params.append("expand[]", "line_items.data.price");

  const stripeResponse = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(
      sessionId
    )}?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
      },
      cache: "no-store",
    }
  );

  const stripeText = await stripeResponse.text();

  let stripeData: StripeCheckoutSession = {};

  try {
    stripeData = JSON.parse(stripeText) as StripeCheckoutSession;
  } catch {
    throw new Error(
      "Stripe hat keine gültige JSON-Antwort geliefert: " +
        stripeText.slice(0, 300)
    );
  }

  if (!stripeResponse.ok) {
    throw new Error(
      stripeData.error?.message ||
        `Stripe Checkout Session konnte nicht gelesen werden. Status: ${stripeResponse.status}`
    );
  }

  return stripeData;
}

async function updateWorkshopProfile(input: ProfileUpdateInput) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const updatePayload = {
    plan: input.plan,
    updated_at: now,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    stripe_subscription_status: input.stripeSubscriptionStatus,
    stripe_price_id: input.stripePriceId,
    stripe_current_period_end: input.stripeCurrentPeriodEnd,
  };

  const { data: updatedRows, error: updateError } = await supabase
    .from("workshop_profiles")
    .update(updatePayload)
    .eq("id", input.supabaseUserId)
    .select("id");

  if (updateError) {
    throw new Error(`Supabase Update fehlgeschlagen: ${updateError.message}`);
  }

  if (updatedRows && updatedRows.length > 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("workshop_profiles")
    .insert({
      id: input.supabaseUserId,
      full_name: "Supabase Nutzer",
      workshop_name: "Profil noch nicht gespeichert",
      email: input.email || "nicht hinterlegt",
      role: "Werkstatt",
      plan: input.plan,
      created_at: now,
      updated_at: now,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      stripe_subscription_status: input.stripeSubscriptionStatus,
      stripe_price_id: input.stripePriceId,
      stripe_current_period_end: input.stripeCurrentPeriodEnd,
    });

  if (insertError) {
    throw new Error(`Supabase Insert fehlgeschlagen: ${insertError.message}`);
  }
}

function validatePaidCheckoutSession({
  session,
  user,
}: {
  session: StripeCheckoutSession;
  user: User;
}) {
  const sessionUserId = getSessionSupabaseUserId(session);

  if (!sessionUserId) {
    throw new Error(
      "Diese Stripe-Zahlung enthaelt keine Supabase-User-ID. Bitte Checkout erneut ueber die Preise-Seite starten."
    );
  }

  if (sessionUserId !== user.id) {
    throw new Error(
      "Diese Stripe-Zahlung gehoert nicht zum aktuell eingeloggten DiagnoseHUB-Account."
    );
  }

  if (session.mode !== "subscription") {
    throw new Error("Diese Stripe-Session ist kein Abo-Checkout.");
  }

  if (session.status !== "complete") {
    throw new Error("Diese Stripe-Zahlung ist noch nicht abgeschlossen.");
  }

  if (session.payment_status !== "paid") {
    throw new Error("Diese Stripe-Zahlung ist noch nicht bezahlt.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await loadUserFromAuthorizationHeader(request);

    if (!user) {
      return NextResponse.json(
        { error: "Du musst eingeloggt sein." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      sessionId?: unknown;
    };

    if (typeof body.sessionId !== "string" || !body.sessionId.trim()) {
      return NextResponse.json(
        { error: "Stripe session_id fehlt." },
        { status: 400 }
      );
    }

    const session = await retrieveStripeCheckoutSession(body.sessionId.trim());

    validatePaidCheckoutSession({
      session,
      user,
    });

    const subscriptionStatus = getSubscriptionStatus(session);
    const checkoutPlan = getCheckoutPlan(session);

    if (checkoutPlan === "service_reminder") {
      return NextResponse.json({
        ok: true,
        plan: checkoutPlan,
        subscriptionStatus,
      });
    }

    await updateWorkshopProfile({
      supabaseUserId: user.id,
      plan: "pro",
      email: user.email || session.customer_email || null,
      stripeCustomerId: getCustomerId(session),
      stripeSubscriptionId: getSubscriptionId(session),
      stripeSubscriptionStatus: subscriptionStatus,
      stripePriceId: getPriceIdFromSession(session),
      stripeCurrentPeriodEnd: getSubscriptionPeriodEnd(session),
    });

    return NextResponse.json({
      ok: true,
      plan: "pro",
      subscriptionStatus,
    });
  } catch (error) {
    console.error("Stripe Checkout Status Fehler:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe Checkout Status konnte nicht geprüft werden.",
      },
      { status: 500 }
    );
  }
}
