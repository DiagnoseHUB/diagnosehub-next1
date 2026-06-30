import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getStripeClient,
  getStripeWebhookSecret,
} from "@/lib/supabase/stripe";
import {
  loadSubscriptionByStripeSubscriptionId,
  saveStripeSubscription,
} from "@/lib/supabase/subscriptionStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStringId(value: string | { id?: string } | null | undefined) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return value.id || "";
}

function unixTimestampToIso(value: number | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

async function resolveUserIdFromSubscription(subscription: Stripe.Subscription) {
  const metadataUserId = subscription.metadata?.user_id;

  if (metadataUserId) {
    return metadataUserId;
  }

  const existingSubscription = await loadSubscriptionByStripeSubscriptionId(
    subscription.id
  );

  return existingSubscription?.user_id || "";
}

async function saveSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const userId = await resolveUserIdFromSubscription(subscription);

  if (!userId) {
    throw new Error(
      `Stripe Subscription ${subscription.id} enthält keine user_id.`
    );
  }

  const customerId = getStringId(subscription.customer);
  const priceId = subscription.items.data[0]?.price?.id || "";

  if (!customerId) {
    throw new Error(`Stripe Subscription ${subscription.id} hat keine customer_id.`);
  }

  if (!priceId) {
    throw new Error(`Stripe Subscription ${subscription.id} hat keine price_id.`);
  }

  const subscriptionAny = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  await saveStripeSubscription({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    status: subscription.status,
    currentPeriodStart: unixTimestampToIso(
      subscriptionAny.current_period_start
    ),
    currentPeriodEnd: unixTimestampToIso(subscriptionAny.current_period_end),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  });
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const stripe = getStripeClient();

  const subscriptionId = getStringId(session.subscription);

  if (!subscriptionId) {
    throw new Error("Checkout Session enthält keine Subscription-ID.");
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (!subscription.metadata?.user_id && session.client_reference_id) {
    subscription.metadata.user_id = session.client_reference_id;
  }

  await saveSubscriptionFromStripe(subscription);
}

export async function POST(request: Request) {
  const stripe = getStripeClient();

  try {
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        {
          error: "Stripe-Signatur fehlt.",
        },
        { status: 400 }
      );
    }

    const rawBody = await request.text();

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret()
    );

    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await saveSubscriptionFromStripe(
          event.data.object as Stripe.Subscription
        );
        break;
      }

      default:
        break;
    }

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error("Stripe Webhook Fehler:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe Webhook konnte nicht verarbeitet werden.",
      },
      { status: 400 }
    );
  }
}