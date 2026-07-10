import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { isValidUserPlan, type UserPlan } from "@/config/plans";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";
import { getStripeClient } from "@/lib/supabase/stripe";

type AccountDeletePayload = {
  confirm?: unknown;
  confirmationText?: unknown;
};

type AccountBillingProfile = {
  plan: UserPlan;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeSubscriptionStatus: string;
};

type SubscriptionBillingRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
};

type DeleteOperationResult = {
  table: string;
  action: string;
  skipped?: boolean;
};

const DELETE_CONFIRMATION_TEXT = "ACCOUNT LÖSCHEN";

const ACTIVE_STRIPE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "Unbekannter Fehler.";
}

function isMissingDatabaseObject(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const supabaseError = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  const message = [supabaseError.message, supabaseError.details]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();

  return (
    supabaseError.code === "42P01" ||
    supabaseError.code === "42703" ||
    supabaseError.code === "PGRST200" ||
    supabaseError.code === "PGRST204" ||
    supabaseError.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function isMissingStripeResource(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const stripeError = error as {
    code?: unknown;
    statusCode?: unknown;
    type?: unknown;
  };

  return (
    stripeError.code === "resource_missing" ||
    stripeError.statusCode === 404 ||
    stripeError.type === "StripeInvalidRequestError"
  );
}

function isDeletedStripeCustomer(
  customer:
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | Stripe.Response<Stripe.Customer | Stripe.DeletedCustomer>
) {
  return "deleted" in customer && customer.deleted === true;
}

function normalizePlan(value: unknown): UserPlan {
  return isValidUserPlan(value) ? value : "free";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPaidPlan(plan: UserPlan) {
  return plan !== "free";
}

function isCancelableStripeSubscription(subscription: Pick<Stripe.Subscription, "status">) {
  return ACTIVE_STRIPE_STATUSES.has(subscription.status);
}

async function readPayload(request: Request): Promise<AccountDeletePayload> {
  return (await request.json().catch(() => ({}))) as AccountDeletePayload;
}

async function loadBillingProfile(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
): Promise<AccountBillingProfile> {
  const { data, error } = await adminClient
    .from("workshop_profiles")
    .select(
      "plan, stripe_customer_id, stripe_subscription_id, stripe_subscription_status"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (!isMissingDatabaseObject(error)) {
      throw error;
    }

    const fallback = await adminClient
      .from("workshop_profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();

    if (fallback.error && !isMissingDatabaseObject(fallback.error)) {
      throw fallback.error;
    }

    return {
      plan: normalizePlan(fallback.data && "plan" in fallback.data ? fallback.data.plan : "free"),
      stripeCustomerId: "",
      stripeSubscriptionId: "",
      stripeSubscriptionStatus: "",
    };
  }

  const row = (data || {}) as {
    plan?: unknown;
    stripe_customer_id?: unknown;
    stripe_subscription_id?: unknown;
    stripe_subscription_status?: unknown;
  };

  return {
    plan: normalizePlan(row.plan),
    stripeCustomerId: cleanText(row.stripe_customer_id),
    stripeSubscriptionId: cleanText(row.stripe_subscription_id),
    stripeSubscriptionStatus: cleanText(row.stripe_subscription_status),
  };
}

async function loadSubscriptionRows(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const { data, error } = await adminClient
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, status")
    .eq("user_id", userId);

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return [] as SubscriptionBillingRow[];
    }

    throw error;
  }

  return (data || []) as SubscriptionBillingRow[];
}

async function cancelStripeSubscription(
  stripe: Stripe,
  subscriptionId: string,
  canceledSubscriptionIds: Set<string>
) {
  if (!subscriptionId || canceledSubscriptionIds.has(subscriptionId)) {
    return;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (!isCancelableStripeSubscription(subscription)) {
      return;
    }

    await stripe.subscriptions.cancel(subscription.id);
    canceledSubscriptionIds.add(subscription.id);
  } catch (error) {
    if (isMissingStripeResource(error)) {
      return;
    }

    throw error;
  }
}

async function collectSubscriptionsForCustomer(
  stripe: Stripe,
  customerId: string,
  subscriptionIds: Set<string>
) {
  if (!customerId) {
    return;
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
  });

  for (const subscription of subscriptions.data) {
    if (isCancelableStripeSubscription(subscription)) {
      subscriptionIds.add(subscription.id);
    }
  }
}

async function collectCustomersByEmail(
  stripe: Stripe,
  email: string,
  customerIds: Set<string>
) {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    return;
  }

  const customers = await stripe.customers.list({
    email: cleanEmail,
    limit: 10,
  });

  for (const customer of customers.data) {
    if (!isDeletedStripeCustomer(customer)) {
      customerIds.add(customer.id);
    }
  }
}

async function cancelAccountSubscriptions({
  userEmail,
  profile,
  subscriptionRows,
}: {
  userEmail: string;
  profile: AccountBillingProfile;
  subscriptionRows: SubscriptionBillingRow[];
}) {
  const subscriptionIds = new Set<string>();
  const customerIds = new Set<string>();
  const activeStatusHints = new Set<string>();

  if (profile.stripeSubscriptionId) {
    subscriptionIds.add(profile.stripeSubscriptionId);
  }

  if (profile.stripeCustomerId) {
    customerIds.add(profile.stripeCustomerId);
  }

  if (profile.stripeSubscriptionStatus) {
    activeStatusHints.add(profile.stripeSubscriptionStatus);
  }

  for (const row of subscriptionRows) {
    const subscriptionId = cleanText(row.stripe_subscription_id);
    const customerId = cleanText(row.stripe_customer_id);
    const status = cleanText(row.status);

    if (subscriptionId) {
      subscriptionIds.add(subscriptionId);
    }

    if (customerId) {
      customerIds.add(customerId);
    }

    if (status) {
      activeStatusHints.add(status);
    }
  }

  const looksPaid =
    isPaidPlan(profile.plan) ||
    [...activeStatusHints].some((status) => ACTIVE_STRIPE_STATUSES.has(status));
  const shouldCheckStripe =
    looksPaid || subscriptionIds.size > 0 || customerIds.size > 0;

  if (!shouldCheckStripe && !process.env.STRIPE_SECRET_KEY) {
    return {
      canceledSubscriptions: [] as string[],
      checkedStripe: false,
    };
  }

  if (shouldCheckStripe && !process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Das Konto sieht nach einem bezahlten Tarif aus, aber STRIPE_SECRET_KEY fehlt. Das Abo wurde deshalb nicht gekündigt und der Account wurde nicht gelöscht."
    );
  }

  const stripe = getStripeClient();

  if (process.env.STRIPE_SECRET_KEY) {
    await collectCustomersByEmail(stripe, userEmail, customerIds);
  }

  for (const customerId of customerIds) {
    await collectSubscriptionsForCustomer(stripe, customerId, subscriptionIds);
  }

  const canceledSubscriptionIds = new Set<string>();

  for (const subscriptionId of subscriptionIds) {
    await cancelStripeSubscription(stripe, subscriptionId, canceledSubscriptionIds);
  }

  return {
    canceledSubscriptions: [...canceledSubscriptionIds],
    checkedStripe: true,
  };
}

async function deleteFromTable(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  column: string,
  userId: string
): Promise<DeleteOperationResult> {
  const { error } = await adminClient.from(table).delete().eq(column, userId);

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return { table, action: "delete", skipped: true };
    }

    throw error;
  }

  return { table, action: "delete" };
}

async function updateReferencesToNull(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  column: string,
  userId: string
): Promise<DeleteOperationResult> {
  const { error } = await adminClient
    .from(table)
    .update({ [column]: null })
    .eq(column, userId);

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return { table, action: "anonymize", skipped: true };
    }

    throw error;
  }

  return { table, action: "anonymize" };
}

async function anonymizeApprovedTorqueSpecs(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
): Promise<DeleteOperationResult> {
  const { error } = await adminClient
    .from("torque_specs")
    .update({ user_id: null })
    .eq("user_id", userId)
    .eq("status", "approved")
    .eq("visibility", "shared");

  if (error) {
    if (isMissingDatabaseObject(error)) {
      return { table: "torque_specs", action: "anonymize", skipped: true };
    }

    throw new Error(
      "Freigegebene Drehmomentwerte konnten nicht anonymisiert werden. Bitte zuerst die Migration 20260710_account_deletion_and_torque_anonymization.sql ausführen."
    );
  }

  return { table: "torque_specs", action: "anonymize" };
}

async function cleanupAccountDataBeforeAuthDelete(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const results: DeleteOperationResult[] = [];

  results.push(
    await deleteFromTable(adminClient, "service_reminder_notification_log", "user_id", userId)
  );
  results.push(await deleteFromTable(adminClient, "safety_access_logs", "user_id", userId));
  results.push(await anonymizeApprovedTorqueSpecs(adminClient, userId));
  results.push(
    await deleteFromTable(adminClient, "torque_specs", "user_id", userId)
  );
  results.push(
    await updateReferencesToNull(adminClient, "component_knowledge_entries", "created_by", userId)
  );
  results.push(
    await updateReferencesToNull(adminClient, "component_knowledge_entries", "reviewed_by", userId)
  );
  results.push(
    await updateReferencesToNull(adminClient, "torque_specs", "reviewed_by", userId)
  );
  results.push(
    await updateReferencesToNull(adminClient, "hv_access_requests", "reviewed_by", userId)
  );

  return results;
}

async function cleanupAccountDataAfterAuthDelete(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const results: DeleteOperationResult[] = [];

  results.push(await deleteFromTable(adminClient, "subscriptions", "user_id", userId));
  results.push(await deleteFromTable(adminClient, "diagnosis_cases", "user_id", userId));
  results.push(await deleteFromTable(adminClient, "diagnosis_usage", "user_id", userId));
  results.push(await deleteFromTable(adminClient, "device_registrations", "user_id", userId));
  results.push(await deleteFromTable(adminClient, "hv_access_requests", "user_id", userId));
  results.push(
    await deleteFromTable(adminClient, "service_reminder_notification_settings", "user_id", userId)
  );
  results.push(
    await deleteFromTable(adminClient, "service_reminder_vehicles", "user_id", userId)
  );
  results.push(await deleteFromTable(adminClient, "workshop_profiles", "id", userId));

  return results;
}

export async function DELETE(request: Request) {
  try {
    const payload = await readPayload(request);

    if (
      payload.confirm !== true ||
      cleanText(payload.confirmationText) !== DELETE_CONFIRMATION_TEXT
    ) {
      return jsonError(
        "Account-Löschung nicht bestätigt. Bitte die Sicherheitsabfrage erneut ausfüllen.",
        400
      );
    }

    const { user } = await loadAuthenticatedUserFromRequest(request);
    const adminClient = createSupabaseAdminClient();
    const profile = await loadBillingProfile(adminClient, user.id);
    const subscriptionRows = await loadSubscriptionRows(adminClient, user.id);
    const stripeResult = await cancelAccountSubscriptions({
      userEmail: user.email || "",
      profile,
      subscriptionRows,
    });

    const beforeDeleteCleanup = await cleanupAccountDataBeforeAuthDelete(
      adminClient,
      user.id
    );

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(
      user.id
    );

    if (deleteUserError) {
      throw deleteUserError;
    }

    const afterDeleteCleanup = await cleanupAccountDataAfterAuthDelete(
      adminClient,
      user.id
    );

    return NextResponse.json({
      ok: true,
      canceledSubscriptions: stripeResult.canceledSubscriptions.length,
      checkedStripe: stripeResult.checkedStripe,
      cleanup: [...beforeDeleteCleanup, ...afterDeleteCleanup],
    });
  } catch (error) {
    console.error("Account konnte nicht gelöscht werden:", error);

    return jsonError(
      `Account konnte nicht gelöscht werden: ${getErrorMessage(error)}`,
      500
    );
  }
}
