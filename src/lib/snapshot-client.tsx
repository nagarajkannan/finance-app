"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { RequestError, requestJson } from "./store";
import type { Snapshot, SnapshotSchedule } from "./snapshots";

interface SnapshotState {
  snapshots: Snapshot[];
  schedule: SnapshotSchedule | null;
  loaded: boolean;
  error?: string;
}

const EMPTY_STATE: SnapshotState = {
  snapshots: [],
  schedule: null,
  loaded: false,
};

let state: SnapshotState = EMPTY_STATE;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<SnapshotState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

async function loadFromDatabase(): Promise<void> {
  try {
    const [snapshots, schedule] = await Promise.all([
      requestJson<Snapshot[]>("/api/snapshots"),
      requestJson<SnapshotSchedule>("/api/snapshots/schedule"),
    ]);
    setState({ snapshots, schedule, loaded: true, error: undefined });
  } catch (error) {
    if (error instanceof RequestError && [401, 423].includes(error.status)) {
      setState({ ...EMPTY_STATE, loaded: true });
      return;
    }
    setState({
      loaded: true,
      error:
        error instanceof Error
          ? error.message
          : "Could not read your snapshot history.",
    });
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  loading ??= loadFromDatabase();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SnapshotState {
  return state;
}

function getServerSnapshot(): SnapshotState {
  return EMPTY_STATE;
}

/** Reads the snapshot history and schedule for the signed-in account. */
export function useSnapshots() {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const reload = useCallback(async () => {
    loading = loadFromDatabase();
    await loading;
  }, []);

  const takeSnapshot = useCallback(async (name: string) => {
    const created = await requestJson<Snapshot>("/api/snapshots", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setState({ snapshots: [...state.snapshots, created] });
    return created;
  }, []);

  const deleteSnapshot = useCallback(async (id: string) => {
    await requestJson(`/api/snapshots/${id}`, { method: "DELETE" });
    setState({
      snapshots: state.snapshots.filter((snapshot) => snapshot.id !== id),
    });
  }, []);

  const saveSchedule = useCallback(async (schedule: SnapshotSchedule) => {
    const saved = await requestJson<SnapshotSchedule>("/api/snapshots/schedule", {
      method: "PUT",
      body: JSON.stringify(schedule),
    });
    setState({ schedule: saved });
    return saved;
  }, []);

  return useMemo(
    () => ({ ...data, reload, takeSnapshot, deleteSnapshot, saveSchedule }),
    [data, reload, takeSnapshot, deleteSnapshot, saveSchedule],
  );
}
