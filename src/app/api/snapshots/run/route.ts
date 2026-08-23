import { NextResponse } from "next/server";
import { runDueSnapshots } from "@/lib/server/snapshots";

export const dynamic = "force-dynamic";

/**
 * Runs every schedule that is due. The app already runs this on a timer of its
 * own; this route is for an external cron (Render, GitHub Actions) that wants
 * to drive it instead. It only answers when `CRON_SECRET` is set and sent back
 * in the `x-cron-secret` header.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runDueSnapshots());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
