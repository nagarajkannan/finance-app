import type { SnapshotFrequency, SnapshotSchedule } from "./snapshots";

/**
 * Schedules are read in Indian Standard Time so "20:00 daily" means the same
 * clock time wherever the server runs. IST has no daylight saving, so a fixed
 * offset is exact.
 */
const SCHEDULE_OFFSET_MINUTES = 330;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export interface ScheduleTiming {
  frequency: SnapshotFrequency;
  timeOfDay: string;
  intervalDays: number;
  startDate: string;
  endDate: string;
  /** Used as the anchor when no start date is given. */
  createdAt: Date;
}

function civilOf(date: Date): CivilDate {
  const shifted = new Date(date.getTime() + SCHEDULE_OFFSET_MINUTES * MINUTE_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function parseYmd(value: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseTimeOfDay(value: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { hour: 20, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, Number(match[1]))),
    minute: Math.min(59, Math.max(0, Number(match[2]))),
  };
}

/** The instant a civil date + local time happens, as a real UTC date. */
function instantOf(date: CivilDate, hour: number, minute: number): Date {
  return new Date(
    Date.UTC(date.year, date.month - 1, date.day, hour, minute) -
      SCHEDULE_OFFSET_MINUTES * MINUTE_MS,
  );
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(date: CivilDate, months: number): CivilDate {
  const total = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

const MONTH_STEP: Partial<Record<SnapshotFrequency, number>> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

function dayStep(timing: ScheduleTiming): number | null {
  if (timing.frequency === "daily") return 1;
  if (timing.frequency === "weekly") return 7;
  if (timing.frequency === "custom") {
    return Math.max(1, Math.round(timing.intervalDays));
  }
  return null;
}

function anchorOf(timing: ScheduleTiming): CivilDate {
  return parseYmd(timing.startDate) ?? civilOf(timing.createdAt);
}

/** The last instant a snapshot may still be taken, or null when open ended. */
function endLimit(timing: ScheduleTiming): Date | null {
  const end = parseYmd(timing.endDate);
  if (!end) return null;
  return instantOf(end, 23, 59);
}

/** The instant of the nth scheduled slot, counting the first one as 0. */
function slotAt(timing: ScheduleTiming, index: number): Date {
  const { hour, minute } = parseTimeOfDay(timing.timeOfDay);
  const anchor = anchorOf(timing);
  const days = dayStep(timing);

  if (days !== null) {
    return new Date(
      instantOf(anchor, hour, minute).getTime() + index * days * DAY_MS,
    );
  }
  const months = MONTH_STEP[timing.frequency] ?? 1;
  return instantOf(addMonths(anchor, index * months), hour, minute);
}

function latestIndexAtOrBefore(timing: ScheduleTiming, now: Date): number | null {
  const first = slotAt(timing, 0);
  if (now.getTime() < first.getTime()) return null;

  const days = dayStep(timing);
  let index =
    days !== null
      ? Math.floor((now.getTime() - first.getTime()) / (days * DAY_MS))
      : Math.floor(
          ((now.getTime() - first.getTime()) / DAY_MS / 30.44) /
            (MONTH_STEP[timing.frequency] ?? 1),
        );

  index = Math.max(0, index);
  while (slotAt(timing, index).getTime() > now.getTime()) index -= 1;
  while (slotAt(timing, index + 1).getTime() <= now.getTime()) index += 1;
  return index;
}

/** The most recent slot that has already passed, or null when none is due. */
export function dueSlot(timing: ScheduleTiming, now: Date): Date | null {
  const index = latestIndexAtOrBefore(timing, now);
  if (index === null) return null;

  const slot = slotAt(timing, index);
  const limit = endLimit(timing);
  if (limit && slot.getTime() > limit.getTime()) return null;
  return slot;
}

/** When the next automatic snapshot will be taken, or null when the run is over. */
export function nextSlot(timing: ScheduleTiming, now: Date): Date | null {
  const index = latestIndexAtOrBefore(timing, now);
  const slot = index === null ? slotAt(timing, 0) : slotAt(timing, index + 1);
  const limit = endLimit(timing);
  if (limit && slot.getTime() > limit.getTime()) return null;
  return slot;
}

/**
 * Names the slot a snapshot belongs to. Stored with the snapshot and made
 * unique per schedule, so a slot can only ever be filled once.
 */
export function periodKeyFor(slot: Date): string {
  const shifted = new Date(slot.getTime() + SCHEDULE_OFFSET_MINUTES * MINUTE_MS);
  return shifted.toISOString().slice(0, 16);
}

export function timingFrom(
  schedule: Pick<
    SnapshotSchedule,
    "frequency" | "timeOfDay" | "intervalDays" | "startDate" | "endDate"
  >,
  createdAt: Date,
): ScheduleTiming {
  return {
    frequency: schedule.frequency,
    timeOfDay: schedule.timeOfDay,
    intervalDays: schedule.intervalDays,
    startDate: schedule.startDate,
    endDate: schedule.endDate,
    createdAt,
  };
}

export function describeSchedule(schedule: SnapshotSchedule): string {
  const time = schedule.timeOfDay || "20:00";
  switch (schedule.frequency) {
    case "daily":
      return `Every day at ${time}`;
    case "weekly":
      return `Every 7 days at ${time}`;
    case "monthly":
      return `Every month at ${time}`;
    case "quarterly":
      return `Every 3 months at ${time}`;
    case "yearly":
      return `Every year at ${time}`;
    case "custom":
      return `Every ${Math.max(1, Math.round(schedule.intervalDays))} days at ${time}`;
  }
}
