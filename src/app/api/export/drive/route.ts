import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EXPORT_FOLDER_NAME } from "@/lib/server/drive";
import {
  disconnectDrive,
  uploadExportToDrive,
  type DriveConnection,
} from "@/lib/server/exports";
import { decryptSecret } from "@/lib/server/secrets";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function failed(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    authErrorResponse(error) ??
    NextResponse.json({ error: message }, { status: 400 })
  );
}

/** Whether this account has given Drive access, and when it last exported. */
export async function GET() {
  try {
    const user = await requireUnlockedUser();
    const stored = await db.user.findUnique({ where: { id: user.id } });

    const connection: DriveConnection = {
      connected: Boolean(decryptSecret(stored?.driveRefreshToken)),
      connectedAt: stored?.driveConnectedAt?.toISOString(),
      lastExportAt: stored?.driveLastExportAt?.toISOString(),
      lastFileUrl: stored?.driveLastFileUrl ?? undefined,
      folderName: EXPORT_FOLDER_NAME,
    };
    return NextResponse.json(connection);
  } catch (error) {
    return failed(error);
  }
}

/** Builds the workbook now and puts it in the signed-in account's Drive. */
export async function POST() {
  try {
    const user = await requireUnlockedUser();
    const file = await uploadExportToDrive(user.id);
    return NextResponse.json({ fileName: file.name, webViewLink: file.webViewLink });
  } catch (error) {
    return failed(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireUnlockedUser();
    await disconnectDrive(user.id);
    return NextResponse.json({ connected: false });
  } catch (error) {
    return failed(error);
  }
}
