import { NextResponse } from "next/server";
import { getSiteUrl, getStripeClient, getStripeProPriceId } from "@/lib/supabase/stripe";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { loadSubscriptionForUser } from "@/lib/supabase/subscriptionStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);

    if (!user.email) {
      return NextResponse.json(
        {
          error:
            "Für Stripe Checkout muss im Supabase-Account eine E-Mail-Adresse hinterlegt sein.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const siteUrl = getSiteUrl();
    const priceId = getStripeProPriceId();

    const existingSubscription = await loadSubscriptionForUser(user.id);

    const checkoutSessionParams = {
      mode: "subscription" as const,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/dashboard?checkout=success`,
      cancel_url: `${siteUrl}/dashboard?checkout=cancelled`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan: "pro",
        source: "diagnosehub_checkout",
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: "pro",
          source: "diagnosehub_checkout",
        },
      },
      automatic_tax: {
        enabled: false,
      },
      allow_promotion_codes: false,
      custom_text: {
        submit: {
          message:
            "Endpreis 49 € pro Monat. Keine Umsatzsteuerberechnung gemäß § 19 UStG.",
        },
      },
    };

    const session = await stripe.checkout.sessions.create({
      ...checkoutSessionParams,
      ...(existingSubscription?.stripe_customer_id
        ? {
            customer: existingSubscription.stripe_customer_id,
          }
        : {
            customer_email: user.email,
          }),
    });

    if (!session.url) {
      return NextResponse.json(
        {
          error: "Stripe Checkout URL konnte nicht erstellt werden.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe Checkout konnte nicht erstellt werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe Checkout konnte nicht erstellt werden.",
      },
      { status: 500 }
    );
  }
}