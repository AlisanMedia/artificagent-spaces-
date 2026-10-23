"use client";
import { useCallback, useState } from "react";
import { StudioFunnel, type StudioFunnelEvent } from "@/domain/studio-funnel";
import type { z } from "zod";
export function useStudioFunnel() {
  const [funnel] = useState(() => new StudioFunnel()),
    [, setTick] = useState(0),
    [enabled, setEnabled] = useState(false);
  const record = useCallback(
    (name: z.infer<typeof StudioFunnelEvent>["name"]) => {
      if (funnel.record({ name })) setTick((t) => t + 1);
    },
    [funnel],
  );
  const consent = useCallback(
    (value: boolean) => {
      setEnabled(value);
      funnel.consent(value);
      setTick((t) => t + 1);
    },
    [funnel],
  );
  return {
    record,
    consent,
    enabled,
    snapshot: funnel.snapshot(),
  };
}
