import { produce, type Draft } from "immer";
import { queueStateSchema, type QueueState } from "./schema";
import { createSeedState } from "./seed";

const STORAGE_KEY = "arcedge-queue-state-v1";
const CHANNEL_NAME = "arcedge-queue-sync";

const listeners = new Set<() => void>();
const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function loadInitial(): QueueState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      const res = queueStateSchema.safeParse(parsed);
      if (res.success) return res.data;
    }
  } catch {
    /* ignore */
  }
  return createSeedState();
}

let state = loadInitial();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function scheduleApiSave() {
  if (import.meta.env.VITE_QUEUE_BACKEND !== "1") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const base = import.meta.env.VITE_API_BASE_URL ?? "/api";
    void fetch(`${base}/queue/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    }).catch(() => {
      /* offline */
    });
  }, 800);
}

if (bc) {
  bc.onmessage = (ev: MessageEvent<{ rev: number; state: QueueState }>) => {
    const data = ev.data;
    if (!data?.state) return;
    if (data.rev <= state.rev) return;
    const res = queueStateSchema.safeParse(data.state);
    if (!res.success) return;
    state = res.data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    emit();
  };
}

export function getQueueState(): QueueState {
  return state;
}

export function subscribeQueue(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function patchQueue(recipe: (draft: Draft<QueueState>) => void): void {
  state = produce(state, recipe);
  state = { ...state, rev: state.rev + 1 };
  persist();
  bc?.postMessage({ rev: state.rev, state });
  scheduleApiSave();
  emit();
}

export function replaceQueue(next: QueueState): void {
  const res = queueStateSchema.safeParse(next);
  if (!res.success) return;
  state = { ...res.data, rev: res.data.rev + 1 };
  persist();
  bc?.postMessage({ rev: state.rev, state });
  scheduleApiSave();
  emit();
}

export async function hydrateFromApi(): Promise<void> {
  if (import.meta.env.VITE_QUEUE_BACKEND !== "1") return;
  const base = import.meta.env.VITE_API_BASE_URL ?? "/api";
  try {
    const r = await fetch(`${base}/queue/state`);
    if (!r.ok) return;
    const body = (await r.json()) as { state?: QueueState };
    if (!body.state) return;
    const res = queueStateSchema.safeParse(body.state);
    if (!res.success) return;
    state = res.data;
    persist();
    emit();
  } catch {
    /* ignore */
  }
}

export function resetQueueDemo(): void {
  state = createSeedState();
  persist();
  bc?.postMessage({ rev: state.rev, state });
  emit();
}
