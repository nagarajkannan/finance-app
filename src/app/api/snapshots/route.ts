import { NextResponse } from "next/server";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";
import { captureSnapshot, listSnapshots, readSchedule } from "@/lib/server/snapshots";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUnlockedUser();
    return NextResponse.json(await listSnapshots(user.id));
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unknown error" }, { status: 500 })
    );
  }
}

/** Takes a snapshot of the account's current assets, liabilities and goals. */
export async function POST(request: Request) {
  try {
    const user = await requireUnlockedUser();
    const payload = (await request.json().catch(() => ({}))) as {
      name?: unknown;
    };
    const name = typeof payload.name === "string" ? payload.name.slice(0, 120) : "";
    const schedule = await readSchedule(user.id);

    return NextResponse.json(
      await captureSnapshot(user.id, { name, uploadToDrive: schedule.exportToDrive }),
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: message }, { status: 400 })
    );
  }
}
