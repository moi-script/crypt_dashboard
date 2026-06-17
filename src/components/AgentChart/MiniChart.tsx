"use client";

import { useState } from "react";
import { AgentChart }  from "./AgentChart";
import { ChartModal }  from "./ChartModal";
import type { ChartSnapshot } from "@/services/agent.service.frontend";

type TF = "15m" | "1h" | "4h" | "1d" | "1w";

interface Props {
  snapshot: ChartSnapshot;
}

export function MiniChart({ snapshot }: Props) {
  const [open, setOpen]           = useState(false);
  const [timeframe, setTimeframe] = useState<TF>("4h");

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        title="Click to expand chart"
        style={{ cursor: "pointer", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <AgentChart snapshot={snapshot} timeframe="4h" height={180} compact={true} />
      </div>

      {open && (
        <ChartModal
          snapshot={snapshot}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
