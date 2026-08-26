import { refreshAccessToken } from "@/lib/server/google";

/**
 * The little bit of Google Drive this app needs: one folder it owns, and files
 * uploaded into it. Everything goes through `drive.file`, so the app can only
 * ever see the exports it wrote itself.
 */

const FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const EXPORT_FOLDER_NAME = "My Money exports";

export interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
}

async function driveJson<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;

  if (!response.ok || !body) {
    throw new Error(
      body?.error?.message ?? `Google Drive refused the request (${response.status}).`,
    );
  }
  return body;
}

export function driveAccessToken(refreshToken: string): Promise<string> {
  return refreshAccessToken(refreshToken);
}

/** Finds the export folder the app created before, or makes it. */
export async function ensureExportFolder(
  accessToken: string,
  knownFolderId?: string | null,
): Promise<string> {
  if (knownFolderId) {
    const existing = await fetch(
      `${FILES_ENDPOINT}/${knownFolderId}?fields=id,trashed`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (existing.ok) {
      const folder = (await existing.json()) as { id: string; trashed?: boolean };
      if (!folder.trashed) return folder.id;
    }
  }

  const query = [
    `mimeType='${FOLDER_MIME}'`,
    `name='${EXPORT_FOLDER_NAME}'`,
    "trashed=false",
  ].join(" and ");
  const found = await driveJson<{ files?: { id: string }[] }>(
    `${FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive&pageSize=1`,
    accessToken,
  );
  const first = found.files?.[0]?.id;
  if (first) return first;

  const created = await driveJson<{ id: string }>(FILES_ENDPOINT, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: EXPORT_FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  return created.id;
}

/**
 * Uploads the workbook as a new file, so every export stays in Drive and the
 * folder becomes the history.
 */
export async function uploadWorkbook(options: {
  accessToken: string;
  folderId: string;
  fileName: string;
  content: Buffer;
}): Promise<DriveFile> {
  const boundary = `mm-${Date.now().toString(16)}`;
  const metadata = JSON.stringify({
    name: options.fileName,
    parents: [options.folderId],
    mimeType: XLSX_MIME,
  });

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\n\r\n`,
    ),
    options.content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const response = await fetch(
    `${UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,name,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: new Uint8Array(body),
    },
  );

  const uploaded = (await response.json().catch(() => null)) as
    | (Partial<DriveFile> & { error?: { message?: string } })
    | null;

  if (!response.ok || !uploaded?.id) {
    throw new Error(
      uploaded?.error?.message ??
        `Google Drive did not accept the file (${response.status}).`,
    );
  }

  return {
    id: uploaded.id,
    name: uploaded.name ?? options.fileName,
    webViewLink:
      uploaded.webViewLink ?? `https://drive.google.com/file/d/${uploaded.id}/view`,
  };
}
