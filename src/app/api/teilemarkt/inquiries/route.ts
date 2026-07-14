import { NextResponse } from "next/server";
import { loadAuthenticatedUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InquiryBody = {
  listingId?: unknown;
  requestedPart?: unknown;
  vehicleData?: unknown;
  symptomContext?: unknown;
  message?: unknown;
};

function cleanText(value: unknown, maxLength = 2000) {
  return typeof value === "string"
    ? value.trim().replace(/\r\n/g, "\n").slice(0, maxLength)
    : "";
}

function cleanUuid(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : "";
}

export async function POST(request: Request) {
  try {
    const { user } = await loadAuthenticatedUserFromRequest(request);
    const body = (await request.json()) as InquiryBody;
    const listingId = cleanUuid(body.listingId);
    const requestedPart = cleanText(body.requestedPart, 180);
    const vehicleData = cleanText(body.vehicleData, 1600);
    const symptomContext = cleanText(body.symptomContext, 1600);
    const message = cleanText(body.message, 2000);

    if (!requestedPart && !listingId) {
      return NextResponse.json(
        {
          error: "Bitte gib ein Teil oder ein konkretes Inserat an.",
        },
        { status: 400 }
      );
    }

    if (!vehicleData) {
      return NextResponse.json(
        {
          error:
            "Bitte gib Fahrzeugdaten an. Je genauer die Daten, desto besser kann der Anbieter prüfen.",
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    let sellerId: string | null = null;

    if (listingId) {
      const { data: listing, error: listingError } = await supabase
        .from("used_part_listings")
        .select("id, seller_id, title, status")
        .eq("id", listingId)
        .maybeSingle();

      if (listingError) {
        throw new Error(`Inserat konnte nicht geprüft werden: ${listingError.message}`);
      }

      if (!listing) {
        return NextResponse.json(
          {
            error: "Dieses Inserat wurde nicht gefunden.",
          },
          { status: 404 }
        );
      }

      sellerId = typeof listing.seller_id === "string" ? listing.seller_id : null;
    }

    const { data, error } = await supabase
      .from("used_part_inquiries")
      .insert({
        listing_id: listingId || null,
        buyer_id: user.id,
        seller_id: sellerId,
        requested_part: requestedPart,
        vehicle_data: vehicleData,
        symptom_context: symptomContext,
        message,
        status: "new",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Teileanfrage konnte nicht gespeichert werden: ${error.message}`);
    }

    return NextResponse.json({
      inquiry: data,
      message: "Teileanfrage wurde gespeichert.",
    });
  } catch (error) {
    console.error("Teileanfrage konnte nicht gespeichert werden:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Teileanfrage konnte nicht gespeichert werden.",
      },
      { status: 500 }
    );
  }
}
