import { NextResponse } from "next/server";
import { getSiteUrl, getStripeClient } from "@/lib/supabase/stripe";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { loadSubscriptionForUser } from "@/lib/supabase/subscriptionStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);

    const subscription = await loadSubscriptionForUser(user.id);

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        {
          error:
            "Für diesen Account wurde noch kein Stripe-Kunde gefunden. Bitte zuerst Pro aktivieren.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const siteUrl = getSiteUrl();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${siteUrl}/dashboard?portal=returned`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error("Stripe Kundenportal konnte nicht geöffnet werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe Kundenportal konnte nicht geöffnet werden.",
      },
      { status: 500 }
    );
  }
}