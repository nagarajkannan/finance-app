import { db } from "@/lib/db";
import { deriveAsset } from "@/lib/derive";
import { DriveNotConnectedError, uploadExportToDrive } from "@/lib/server/exports";
import { normalizeAsset, normalizeGoal, normalizeLiability } from "@/lib/server/records";
import {
  buildSnapshotValues,
  type Snapshot,
  type SnapshotCategory,
  type SnapshotGoal,
  type SnapshotSchedule,
  type SnapshotSource,
  type SnapshotValues,
} from "@/lib/snapshots";
import {
  dueSlot,
  nextSlot,
  periodKeyFor,
  timingFrom,
} from "@/lib/snapshot-schedule";
import type { Prisma } from "@/generated/prisma/client";
import type {
  Snapshot as SnapshotRecord,
  SnapshotSchedule as SnapshotScheduleRecord,
} from "@/generated/prisma/client";

function asCategories(value: unknown): SnapshotCategory[] {
  return Array.isArray(value) ? (value as unknown as SnapshotCategory[]) : [];
}

export function normalizeSnapshot(record: SnapshotRecord): Snapshot {
  return {
    id: record.id,
    capturedAt: record.capturedAt.toISOString(),
    name: record.name ?? "",
    source: (record.source === "scheduled" ? "scheduled" : "manual") as SnapshotSource,
    totalAssets: Number(record.totalAssets),
    totalLiabilities: Number(record.totalLiabilities),
    netWorth: Number(record.netWorth),
    totalInvested: Number(record.totalInvested),
    assetCategories: asCategories(record.assetCategories),
    liabilityCategories: asCategories(record.liabilityCategories),
    goals: Array.isArray(record.goals) ? (record.goals as unknown as SnapshotGoal[]) : [],
    driveFileUrl: record.driveFileUrl ?? undefined,
    createdAt: record.createdAt.toISOString(),
  };
}

/** Reads the account's live records and freezes their totals. */
export async function currentValues(userId: string): Promise<SnapshotValues> {
  const [assets, liabilities, goals] = await Promise.all([
    db.asset.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.liability.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);

  return buildSnapshotValues(
    assets.map((asset) => deriveAsset(normalizeAsset(asset))),
    liabilities.map(normalizeLiability),
    goals.map(normalizeGoal),
  );
}

export interface CaptureOptions {
  name?: string;
  source?: SnapshotSource;
  capturedAt?: Date;
  scheduleId?: string;
  periodKey?: string;
  /** Also save the Excel export in the account's Google Drive. */
  uploadToDrive?: boolean;
}

/**
 * Saves the Excel export alongside the snapshot. A Drive problem must never
 * lose the snapshot itself, so it is logged and the snapshot is returned as it
 * is — the account can upload it again from the Snapshots page.
 */
async function attachDriveExport(
  snapshot: Snapshot,
  userId: string,
  capturedAt: Date,
): Promise<Snapshot> {
  try {
    const file = await uploadExportToDrive(userId, capturedAt);
    await db.snapshot.update({
      where: { id: snapshot.id },
      data: { driveFileId: file.id, driveFileUrl: file.webViewLink },
    });
    return { ...snapshot, driveFileUrl: file.webViewLink };
  } catch (error) {
    if (!(error instanceof DriveNotConnectedError)) {
      console.error("Uploading the export to Google Drive failed", error);
    }
    return snapshot;
  }
}

export async function captureSnapshot(
  userId: string,
  options: CaptureOptions = {},
): Promise<Snapshot> {
  const values = await currentValues(userId);
  const capturedAt = options.capturedAt ?? new Date();

  const record = await db.snapshot.create({
    data: {
      userId,
      capturedAt,
      name: options.name?.trim() ?? "",
      source: options.source ?? "manual",
      scheduleId: options.scheduleId ?? null,
      periodKey: options.periodKey ?? null,
      totalAssets: values.totalAssets,
      totalLiabilities: values.totalLiabilities,
      netWorth: values.netWorth,
      totalInvested: values.totalInvested,
      assetCategories: values.assetCategories as unknown as Prisma.InputJsonValue,
      liabilityCategories:
        values.liabilityCategories as unknown as Prisma.InputJsonValue,
      goals: values.goals as unknown as Prisma.InputJsonValue,
    },
  });

  const snapshot = normalizeSnapshot(record);
  if (!options.uploadToDrive) return snapshot;
  return attachDriveExport(snapshot, userId, capturedAt);
}

export async function listSnapshots(userId: string): Promise<Snapshot[]> {
  const records = await db.snapshot.findMany({
    where: { userId },
    orderBy: { capturedAt: "asc" },
  });
  return records.map(normalizeSnapshot);
}

export function normalizeSchedule(
  record: SnapshotScheduleRecord,
  now = new Date(),
): SnapshotSchedule {
  const schedule: SnapshotSchedule = {
    enabled: record.enabled,
    frequency: record.frequency as SnapshotSchedule["frequency"],
    timeOfDay: record.timeOfDay,
    intervalDays: record.intervalDays,
    startDate: record.startDate,
    endDate: record.endDate,
    exportToDrive: record.exportToDrive,
    lastRunAt: record.lastRunAt?.toISOString(),
  };
  const next = nextSlot(timingFrom(schedule, record.createdAt), now);

  return {
    ...schedule,
    nextRunAt: record.enabled && next ? next.toISOString() : undefined,
  };
}

export const DEFAULT_SCHEDULE: SnapshotSchedule = {
  enabled: false,
  frequency: "monthly",
  timeOfDay: "20:00",
  intervalDays: 14,
  startDate: "",
  endDate: "",
  exportToDrive: true,
};

export async function readSchedule(userId: string): Promise<SnapshotSchedule> {
  const record = await db.snapshotSchedule.findUnique({ where: { userId } });
  return record ? normalizeSchedule(record) : DEFAULT_SCHEDULE;
}

export async function writeSchedule(
  userId: string,
  schedule: SnapshotSchedule,
): Promise<SnapshotSchedule> {
  const data = {
    enabled: schedule.enabled,
    frequency: schedule.frequency,
    timeOfDay: schedule.timeOfDay,
    intervalDays: schedule.intervalDays,
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    exportToDrive: schedule.exportToDrive,
  };

  const record = await db.snapshotSchedule.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return normalizeSchedule(record);
}

function isDuplicateSlot(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export interface ScheduleRunResult {
  checked: number;
  created: number;
  skipped: number;
}

/**
 * Takes the snapshots that are due. The slot a snapshot belongs to is stored on
 * it and kept unique per schedule, so running this twice — or from two servers
 * at once — cannot produce a duplicate.
 */
export async function runDueSnapshots(
  now = new Date(),
): Promise<ScheduleRunResult> {
  const schedules = await db.snapshotSchedule.findMany({ where: { enabled: true } });
  const result: ScheduleRunResult = {
    checked: schedules.length,
    created: 0,
    skipped: 0,
  };

  for (const record of schedules) {
    const slot = dueSlot(
      timingFrom(normalizeSchedule(record, now), record.createdAt),
      now,
    );
    if (!slot) continue;

    if (record.lastRunAt && record.lastRunAt.getTime() >= slot.getTime()) {
      result.skipped += 1;
      continue;
    }

    try {
      await captureSnapshot(record.userId, {
        source: "scheduled",
        capturedAt: slot,
        scheduleId: record.id,
        periodKey: periodKeyFor(slot),
        name: "",
        uploadToDrive: record.exportToDrive,
      });
      result.created += 1;
    } catch (error) {
      if (!isDuplicateSlot(error)) throw error;
      result.skipped += 1;
    }

    await db.snapshotSchedule.update({
      where: { id: record.id },
      data: { lastRunAt: slot },
    });
  }

  return result;
}
