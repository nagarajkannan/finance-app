import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";
import { normalizeSnapshot } from "@/lib/server/snapshots";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUnlockedUser();
    const { id } = await params;
    const record = await db.snapshot.findFirst({ where: { id, userId: user.id } });

    if (!record) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    return NextResponse.json(normalizeSnapshot(record));
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unknown error" }, { status: 500 })
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUnlockedUser();
    const { id } = await params;
    const deleted = await db.snapshot.deleteMany({ where: { id, userId: user.id } });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unknown error" }, { status: 500 })
    );
  }
}
