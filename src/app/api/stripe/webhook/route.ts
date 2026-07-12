import { handleStripeWebhookRequest } from "@/lib/supabase/stripeWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleStripeWebhookRequest(request);
}
