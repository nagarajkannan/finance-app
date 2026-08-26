"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { requestJson } from "@/lib/store";

interface DriveConnection {
  connected: boolean;
  connectedAt?: string;
  lastExportAt?: string;
  lastFileUrl?: string;
  folderName: string;
}

interface UploadResult {
  fileName: string;
  webViewLink: string;
}

const UNKNOWN: DriveConnection = {
  connected: false,
  folderName: "My Money exports",
};

let connection: DriveConnection = UNKNOWN;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

async function loadConnection(): Promise<void> {
  try {
    connection = await requestJson<DriveConnection>("/api/export/drive");
  } catch {
    connection = UNKNOWN;
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  loading ??= loadConnection();
  return () => {
    listeners.delete(listener);
  };
}

function getConnection(): DriveConnection {
  return connection;
}

function getServerConnection(): DriveConnection {
  return UNKNOWN;
}

/**
 * Downloads the workbook, or saves it in the Drive of the Google account that is
 * signed in. Drive access is granted at sign-in, so reconnecting is a sign-in.
 */
export function ExportCard() {
  const drive = useSyncExternalStore(
    subscribe,
    getConnection,
    getServerConnection,
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadResult | null>(null);

  const upload = async () => {
    setUploading(true);
    setError(null);
    setUploaded(null);
    try {
      setUploaded(
        await requestJson<UploadResult>("/api/export/drive", { method: "POST" }),
      );
      await loadConnection();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not save the export to Google Drive.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">
        <span className="mr-2" aria-hidden>
          📊
        </span>
        Excel export
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        One workbook with a sheet each for assets, liabilities and goals. Uploads
        go to the “{drive.folderName}” folder in the Google account you signed in
        with.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <a
          href="/api/export"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Download Excel
        </a>

        {drive.connected ? (
          <Button type="button" onClick={() => void upload()} disabled={uploading}>
            {uploading ? "Saving…" : "Save to Drive now"}
          </Button>
        ) : (
          <a
            href="/api/auth/google/start"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Connect Google Drive
          </a>
        )}

        <p className="text-sm text-slate-500">
          {drive.connected
            ? drive.lastExportAt
              ? `Last upload: ${formatDateTime(drive.lastExportAt)}`
              : "Nothing uploaded yet."
            : "Sign in again to allow uploads — Drive access is asked for at sign-in."}
        </p>

        {uploaded ? (
          <a
            href={uploaded.webViewLink}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-emerald-600 hover:underline"
          >
            Saved · open {uploaded.fileName}
          </a>
        ) : drive.lastFileUrl ? (
          <a
            href={drive.lastFileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-slate-600 hover:underline"
          >
            Open the last file
          </a>
        ) : null}

        {error ? <span className="text-sm text-rose-600">{error}</span> : null}
      </div>
    </Card>
  );
}
