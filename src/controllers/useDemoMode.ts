"use client";

import { useSyncExternalStore } from "react";
import { demoMode } from "@/services/api.client";

export function useDemoMode() {
  return useSyncExternalStore(
    (cb) => demoMode.subscribe(cb),
    () => demoMode.value,
    () => demoMode.value,
  );
}
