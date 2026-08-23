"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { deriveAsset } from "./derive";
import { mergeGrowwHoldings } from "./groww/merge";
import { mergeMfHoldings, type MfImportResult } from "./groww/mf-import";
import type {
  GrowwConnection,
  GrowwImport,
  GrowwSyncResult,
} from "./groww/types";
import type { Asset, Goal, Liability } from "./types";

export interface StoredData {
  assets: Asset[];
  liabilities: Liability[];
  goals: Goal[];
  groww?: GrowwConnection;
  growwImport?: GrowwImport;
}

interface StoreState extends StoredData {
  loaded: boolean;
  error?: string;
}

const EMPTY_STATE: StoreState = {
  assets: [],
  liabilities: [],
  goals: [],
  loaded: false,
};

let state: StoreState = EMPTY_STATE;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(changes: Partial<StoreState>): void {
  state = { ...state, ...changes };
  for (const listener of listeners) listener();
}

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok || body === null) {
    if (response.status === 401 || response.status === 423) {
      window.dispatchEvent(new Event("auth-changed"));
    }
    throw new RequestError(
      body?.error ?? "The database request failed.",
      response.status,
    );
  }
  return body;
}

async function loadFromDatabase(): Promise<void> {
  try {
    const data = await requestJson<StoredData>("/api/state");
    setState({
      assets: data.assets.map((asset) => deriveAsset(asset)),
      liabilities: data.liabilities,
      goals: data.goals,
      groww: data.groww,
      growwImport: data.growwImport,
      loaded: true,
      error: undefined,
    });
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
          : "Could not read your data from the database.",
    });
  }
}

/** Signing out or locking must not leave another account's numbers on screen. */
export function resetStore(): void {
  loading = null;
  setState(EMPTY_STATE);
}

/** Reloads everything for the account that just unlocked. */
export async function reloadStore(): Promise<void> {
  loading = loadFromDatabase();
  await loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  loading ??= loadFromDatabase();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): StoreState {
  return state;
}

function getServerSnapshot(): StoreState {
  return EMPTY_STATE;
}

/** Ids for holdings created by a merge; the database keeps whatever id it is given. */
function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function saveGroww(groww: GrowwConnection | undefined): Promise<void> {
  await requestJson("/api/app-state", {
    method: "PUT",
    body: JSON.stringify({ key: "groww", value: groww ?? null }),
  });
  setState({ groww });
}

export function useStore() {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addAsset = useCallback(
    async (asset: Omit<Asset, "id" | "createdAt">) => {
      const created = deriveAsset(
        await requestJson<Asset>("/api/assets", {
          method: "POST",
          body: JSON.stringify(asset),
        }),
      );
      setState({ assets: [...state.assets, created] });
      return created;
    },
    [],
  );

  const updateAsset = useCallback(
    async (id: string, changes: Partial<Omit<Asset, "id">>) => {
      const updated = deriveAsset(
        await requestJson<Asset>(`/api/assets/${id}`, {
          method: "PATCH",
          body: JSON.stringify(changes),
        }),
      );
      setState({
        assets: state.assets.map((a) => (a.id === id ? updated : a)),
      });
      return updated;
    },
    [],
  );

  const deleteAsset = useCallback(async (id: string) => {
    await requestJson(`/api/assets/${id}`, { method: "DELETE" });
    setState({
      assets: state.assets.filter((a) => a.id !== id),
      goals: state.goals.map((goal) => ({
        ...goal,
        linkedAssetIds: goal.linkedAssetIds.filter((assetId) => assetId !== id),
      })),
    });
  }, []);

  const addLiability = useCallback(
    async (liability: Omit<Liability, "id" | "createdAt">) => {
      const created = await requestJson<Liability>("/api/liabilities", {
        method: "POST",
        body: JSON.stringify(liability),
      });
      setState({ liabilities: [...state.liabilities, created] });
      return created;
    },
    [],
  );

  const updateLiability = useCallback(
    async (id: string, changes: Partial<Omit<Liability, "id">>) => {
      const updated = await requestJson<Liability>(`/api/liabilities/${id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setState({
        liabilities: state.liabilities.map((l) => (l.id === id ? updated : l)),
      });
      return updated;
    },
    [],
  );

  const deleteLiability = useCallback(async (id: string) => {
    await requestJson(`/api/liabilities/${id}`, { method: "DELETE" });
    setState({ liabilities: state.liabilities.filter((l) => l.id !== id) });
  }, []);

  const addGoal = useCallback(async (goal: Omit<Goal, "id" | "createdAt">) => {
    const created = await requestJson<Goal>("/api/goals", {
      method: "POST",
      body: JSON.stringify(goal),
    });
    setState({ goals: [...state.goals, created] });
    return created;
  }, []);

  const updateGoal = useCallback(
    async (id: string, changes: Partial<Omit<Goal, "id">>) => {
      const updated = await requestJson<Goal>(`/api/goals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setState({ goals: state.goals.map((g) => (g.id === id ? updated : g)) });
      return updated;
    },
    [],
  );

  const deleteGoal = useCallback(async (id: string) => {
    await requestJson(`/api/goals/${id}`, { method: "DELETE" });
    setState({ goals: state.goals.filter((g) => g.id !== id) });
  }, []);

  const connectGroww = useCallback(async () => {
    if (state.groww) return;
    await saveGroww({ connectedAt: new Date().toISOString() });
  }, []);

  const disconnectGroww = useCallback(async () => {
    await saveGroww(undefined);
  }, []);

  /** Updates matching assets, adds new holdings and flags ones Groww no longer returns. */
  const applyGrowwSync = useCallback(async (result: GrowwSyncResult) => {
    const merged = mergeGrowwHoldings(state.assets, result, newId);
    const saved = await requestJson<Asset[]>("/api/assets/bulk", {
      method: "POST",
      body: JSON.stringify({ assets: merged.assets }),
    });
    setState({ assets: saved.map((asset) => deriveAsset(asset)) });
    await saveGroww({
      connectedAt: state.groww?.connectedAt ?? result.syncedAt,
      lastSyncedAt: result.syncedAt,
      lastResult: { ...merged.report, gaps: result.gaps },
    });
  }, []);

  const recordGrowwError = useCallback(async (message: string) => {
    await saveGroww({
      connectedAt: state.groww?.connectedAt ?? new Date().toISOString(),
      lastSyncedAt: state.groww?.lastSyncedAt,
      lastResult: state.groww?.lastResult,
      lastError: message,
    });
  }, []);

  /** Applies an uploaded mutual fund file, keeping the problems it reported. */
  const applyMfImport = useCallback(
    async (result: MfImportResult, fileName: string) => {
      const importedAt = new Date().toISOString();
      const merged = mergeMfHoldings(
        state.assets,
        result.holdings,
        importedAt,
        newId,
      );
      const saved = await requestJson<Asset[]>("/api/assets/bulk", {
        method: "POST",
        body: JSON.stringify({ assets: merged.assets }),
      });
      const growwImport: GrowwImport = {
        importedAt,
        fileName,
        added: merged.added,
        updated: merged.updated,
        problems: result.problems,
      };
      await requestJson("/api/app-state", {
        method: "PUT",
        body: JSON.stringify({ key: "growwImport", value: growwImport }),
      });
      setState({
        assets: saved.map((asset) => deriveAsset(asset)),
        growwImport,
      });
    },
    [],
  );

  return useMemo(
    () => ({
      ...data,
      addAsset,
      updateAsset,
      deleteAsset,
      addLiability,
      updateLiability,
      deleteLiability,
      addGoal,
      updateGoal,
      deleteGoal,
      connectGroww,
      disconnectGroww,
      applyGrowwSync,
      recordGrowwError,
      applyMfImport,
    }),
    [
      data,
      addAsset,
      updateAsset,
      deleteAsset,
      addLiability,
      updateLiability,
      deleteLiability,
      addGoal,
      updateGoal,
      deleteGoal,
      connectGroww,
      disconnectGroww,
      applyGrowwSync,
      recordGrowwError,
      applyMfImport,
    ],
  );
}
