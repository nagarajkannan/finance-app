import { NextResponse } from "next/server";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";
import { DEFAULT_SCHEDULE, readSchedule, writeSchedule } from "@/lib/server/snapshots";
import { isSnapshotFrequency, type SnapshotSchedule } from "@/lib/snapshots";

export const dynamic = "force-dynamic";

const TIME_PATTERN = /^\d{1,2}:\d{2}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeSchedule(payload: unknown): SnapshotSchedule {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Schedule payload must be an object.");
  }

  const value = payload as Record<string, unknown>;
  const timeOfDay =
    typeof value.timeOfDay === "string" && TIME_PATTERN.test(value.timeOfDay)
      ? value.timeOfDay
      : DEFAULT_SCHEDULE.timeOfDay;
  const startDate =
    typeof value.startDate === "string" && DATE_PATTERN.test(value.startDate)
      ? value.startDate
      : "";
  const endDate =
    typeof value.endDate === "string" && DATE_PATTERN.test(value.endDate)
      ? value.endDate
      : "";

  if (startDate && endDate && endDate < startDate) {
    throw new Error("The end date cannot be before the start date.");
  }

  return {
    enabled: value.enabled === true,
    frequency: isSnapshotFrequency(value.frequency)
      ? value.frequency
      : DEFAULT_SCHEDULE.frequency,
    timeOfDay,
    intervalDays: Math.min(
      366,
      Math.max(1, Math.round(Number(value.intervalDays ?? DEFAULT_SCHEDULE.intervalDays))),
    ),
    startDate,
    endDate,
  };
}

export async function GET() {
  try {
    const user = await requireUnlockedUser();
    return NextResponse.json(await readSchedule(user.id));
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unknown error" }, { status: 500 })
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUnlockedUser();
    const schedule = sanitizeSchedule(await request.json());
    return NextResponse.json(await writeSchedule(user.id, schedule));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: message }, { status: 400 })
    );
  }
}
