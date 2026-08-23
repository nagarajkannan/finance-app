"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { describeSchedule } from "@/lib/snapshot-schedule";
import {
  FREQUENCY_LABELS,
  SNAPSHOT_FREQUENCIES,
  type SnapshotSchedule,
} from "@/lib/snapshots";

const fieldClass =
  "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none";
const labelClass = "text-sm font-medium text-slate-700";

/** The one automatic snapshot rule for the account. */
export function ScheduleCard({
  schedule,
  onSave,
}: {
  schedule: SnapshotSchedule;
  onSave: (schedule: SnapshotSchedule) => Promise<SnapshotSchedule>;
}) {
  const [draft, setDraft] = useState<SnapshotSchedule>(schedule);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const update = (changes: Partial<SnapshotSchedule>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save the schedule.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            <span className="mr-2" aria-hidden>
              ⏰
            </span>
            Automatic snapshots
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            The server takes these on its own — the app does not need to be open.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
            className="size-4 rounded border-slate-300"
          />
          {draft.enabled ? "Enabled" : "Disabled"}
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="frequency">
            Frequency
          </label>
          <select
            id="frequency"
            value={draft.frequency}
            onChange={(event) =>
              update({ frequency: event.target.value as SnapshotSchedule["frequency"] })
            }
            className={`mt-1 ${fieldClass}`}
          >
            {SNAPSHOT_FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {FREQUENCY_LABELS[frequency]}
              </option>
            ))}
          </select>
        </div>

        {draft.frequency === "custom" ? (
          <div>
            <label className={labelClass} htmlFor="intervalDays">
              Every how many days
            </label>
            <input
              id="intervalDays"
              type="number"
              min={1}
              max={366}
              value={draft.intervalDays}
              onChange={(event) => update({ intervalDays: Number(event.target.value) })}
              className={`mt-1 ${fieldClass}`}
            />
          </div>
        ) : null}

        <div>
          <label className={labelClass} htmlFor="timeOfDay">
            Time (IST)
          </label>
          <input
            id="timeOfDay"
            type="time"
            value={draft.timeOfDay}
            onChange={(event) => update({ timeOfDay: event.target.value })}
            className={`mt-1 ${fieldClass}`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="startDate">
            Start date
          </label>
          <input
            id="startDate"
            type="date"
            value={draft.startDate}
            onChange={(event) => update({ startDate: event.target.value })}
            className={`mt-1 ${fieldClass}`}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="endDate">
            End date (optional)
          </label>
          <input
            id="endDate"
            type="date"
            value={draft.endDate}
            onChange={(event) => update({ endDate: event.target.value })}
            className={`mt-1 ${fieldClass}`}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save schedule"}
        </Button>
        <p className="text-sm text-slate-500">
          {describeSchedule(draft)}
          {schedule.nextRunAt
            ? ` · Next: ${formatDateTime(schedule.nextRunAt)}`
            : schedule.enabled
              ? " · No further runs"
              : ""}
          {schedule.lastRunAt ? ` · Last: ${formatDateTime(schedule.lastRunAt)}` : ""}
        </p>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
        {error ? <span className="text-sm text-rose-600">{error}</span> : null}
      </div>
    </Card>
  );
}
