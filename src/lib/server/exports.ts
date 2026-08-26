import { db } from "@/lib/db";
import { deriveAsset } from "@/lib/derive";
import {
  driveAccessToken,
  ensureExportFolder,
  uploadWorkbook,
  type DriveFile,
} from "@/lib/server/drive";
import { buildWorkbook, exportFileName, type ExportRecords } from "@/lib/server/excel";
import { normalizeAsset, normalizeGoal, normalizeLiability } from "@/lib/server/records";
import { decryptSecret } from "@/lib/server/secrets";

/** Reads the account's live records — the same ones a snapshot freezes. */
export async function exportRecords(userId: string): Promise<ExportRecords> {
  const [assets, liabilities, goals] = await Promise.all([
    db.asset.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.liability.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    assets: assets.map((asset) => deriveAsset(normalizeAsset(asset))),
    liabilities: liabilities.map(normalizeLiability),
    goals: goals.map(normalizeGoal),
  };
}

export interface ExportFile {
  fileName: string;
  content: Buffer;
}

export async function buildExport(
  userId: string,
  capturedAt = new Date(),
): Promise<ExportFile> {
  return {
    fileName: exportFileName(capturedAt),
    content: await buildWorkbook(await exportRecords(userId)),
  };
}

export class DriveNotConnectedError extends Error {
  constructor() {
    super("Google Drive is not connected. Sign in again to allow the upload.");
  }
}

export interface DriveConnection {
  connected: boolean;
  connectedAt?: string;
  lastExportAt?: string;
  lastFileUrl?: string;
  folderName: string;
}

/**
 * Builds the workbook and puts it in the "My Money exports" folder of the
 * Google account that is signed in, so the folder becomes the history.
 */
export async function uploadExportToDrive(
  userId: string,
  capturedAt = new Date(),
): Promise<DriveFile> {
  const user = await db.user.findUnique({ where: { id: userId } });
  const refreshToken = decryptSecret(user?.driveRefreshToken);
  if (!user || !refreshToken) throw new DriveNotConnectedError();

  const accessToken = await driveAccessToken(refreshToken);
  const folderId = await ensureExportFolder(accessToken, user.driveFolderId);
  const file = await buildExport(userId, capturedAt);

  const uploaded = await uploadWorkbook({
    accessToken,
    folderId,
    fileName: file.fileName,
    content: file.content,
  });

  await db.user.update({
    where: { id: userId },
    data: {
      driveFolderId: folderId,
      driveLastExportAt: new Date(),
      driveLastFileUrl: uploaded.webViewLink,
    },
  });

  return uploaded;
}

export async function disconnectDrive(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { driveRefreshToken: null, driveConnectedAt: null, driveFolderId: null },
  });
}
