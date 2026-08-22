import { NextResponse } from "next/server";
import type { GoldPurity } from "@/lib/gold";
import { GOLD_PURITY_OPTIONS } from "@/lib/gold";
import { goldQuote } from "@/lib/market/gold";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const PURITIES = new Set(GOLD_PURITY_OPTIONS.map((option) => option.value));

/** Tamil Nadu (Chennai) jewellery gold rate per gram, falling back to India. */
export async function GET(request: Request) {
  try {
    await requireUnlockedUser();

    const purity = new URL(request.url).searchParams.get("purity") as GoldPurity | null;
    if (!purity || !PURITIES.has(purity)) {
      return NextResponse.json(
        { error: "Ask for a purity such as 22K or 24K." },
        { status: 400 },
      );
    }

    return NextResponse.json(await goldQuote(purity));
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "The gold price lookup failed.",
        },
        { status: 502 },
      )
    );
  }
}
