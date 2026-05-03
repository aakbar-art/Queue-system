import { useSyncExternalStore } from "react";
import { getQueueState, subscribeQueue } from "./store";
import type { QueueState } from "./schema";

export function useQueueState<T>(selector: (s: QueueState) => T): T {
  return useSyncExternalStore(
    subscribeQueue,
    () => selector(getQueueState()),
    () => selector(getQueueState()),
  );
}
