import { NextResponse } from "next/server";
import { bondQuote } from "@/lib/market/bonds";
import { fundQuote } from "@/lib/market/funds";
import { stockQuote } from "@/lib/market/stocks";
import type { InstrumentKind } from "@/lib/market/types";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const KINDS: InstrumentKind[] = ["mutual-fund", "stock", "etf", "bond"];

/** Today's NAV, last traded share/ETF price, or Bond Central / BSE bond quote. */
export async function GET(request: Request) {
  try {
    await requireUnlockedUser();

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") as InstrumentKind | null;
    const id = url.searchParams.get("id") ?? "";

    if (!kind || !KINDS.includes(kind) || !id) {
      return NextResponse.json(
        { error: "Ask for a kind and the scheme code, symbol or ISIN as id." },
        { status: 400 },
      );
    }

    const quote =
      kind === "mutual-fund"
        ? await fundQuote(id)
        : kind === "bond"
          ? await bondQuote(id)
          : await stockQuote(id, kind);

    return NextResponse.json(quote);
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "The price lookup failed.",
        },
        { status: 502 },
      )
    );
  }
}
