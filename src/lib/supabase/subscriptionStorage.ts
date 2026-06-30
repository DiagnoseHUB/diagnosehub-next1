import type { UserPlan } from "@/config/plans";
import { createSupabaseAdminClient } from "./supabaseAdmin";

export type SubscriptionDatabaseRow = {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan: UserPlan;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
};

type SaveStripeSubscriptionInput = {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

function isProSubscriptionStatus(status: string) {
  return status === "active" || status === "trialing";
}

function getPlanFromSubscriptionStatus(status: string): UserPlan {
  return isProSubscriptionStatus(status) ? "pro" : "free";
}

async function syncWorkshopProfilePlan(userId: string, plan: UserPlan) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("workshop_profiles")
    .update({
      plan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.warn(
      `Werkstattprofil-Plan konnte nicht synchronisiert werden: ${error.message}`
    );
  }
}

export async function loadSubscriptionForUser(userId: string) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Abo konnte nicht geladen werden: ${error.message}`);
  }

  return (data as SubscriptionDatabaseRow | null) || null;
}

export async function loadSubscriptionByStripeSubscriptionId(
  stripeSubscriptionId: string
) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Abo konnte nicht geladen werden: ${error.message}`);
  }

  return (data as SubscriptionDatabaseRow | null) || null;
}

export async function saveStripeSubscription(
  input: SaveStripeSubscriptionInput
) {
  const supabase = createSupabaseAdminClient();

  const now = new Date().toISOString();
  const plan = getPlanFromSubscriptionStatus(input.status);

  const payload = {
    user_id: input.userId,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    stripe_price_id: input.stripePriceId,
    plan,
    status: input.status,
    current_period_start: input.currentPeriodStart,
    current_period_end: input.currentPeriodEnd,
    cancel_at_period_end: input.cancelAtPeriodEnd,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(payload, {
      onConflict: "stripe_subscription_id",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Abo konnte nicht gespeichert werden: ${error.message}`);
  }

  await syncWorkshopProfilePlan(input.userId, plan);

  return data as SubscriptionDatabaseRow;
}