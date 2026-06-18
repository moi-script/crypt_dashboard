"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { getOhlcv } from "@/services/agent.service.frontend";
import type { ChartSnapshot } from "@/services/agent.service.frontend";

const SYMBOL_MAP: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

function toBinance(sym?: string): string | null {
  if (!sym) return null;
  return SYMBOL_MAP[sym.toUpperCase()] ?? null;
}

function toSec(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp;
}

interface Props {
  snapshot?:      ChartSnapshot;   // full chartSignal analysis (optional)
  symbol?:        string;          // "BTC" | "ETH" — used when no snapshot
  timeframe:      string;
  height:         number;
  compact?:       boolean;
  // intent-level fallback lines (used when no snapshot)
  stopLoss?:      number;
  takeProfits?:   number[];
  entryZoneLow?:  number;
  entryZoneHigh?: number;
}

export function AgentChart({
  snapshot,
  symbol,
  timeframe,
  height,
  compact = false,
  stopLoss,
  takeProfits = [],
  entryZoneLow,
  entryZoneHigh,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const drawOverlays = useCallback((chart: IChartApi) => {
    // Resolve SL/TP/entry from snapshot first, then fallback to intent props
    const sl   = snapshot?.stopLoss      ?? stopLoss;
    const tps  = snapshot?.takeProfitLevels ?? takeProfits;
    const ezLo = snapshot?.entryZone?.low  ?? entryZoneLow;
    const ezHi = snapshot?.entryZone?.high ?? entryZoneHigh;

    // Entry zone — amber band
    if (ezHi != null) {
      chart.addSeries(LineSeries, { color: "#ffb02033", lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
        .createPriceLine({ price: ezHi, color: "#ffb020cc", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "Entry Hi" });
    }
    if (ezLo != null) {
      chart.addSeries(LineSeries, { color: "#ffb02033", lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
        .createPriceLine({ price: ezLo, color: "#ffb020cc", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "Entry Lo" });
    }

    // Stop loss — red dashed
    if (sl != null) {
      chart.addSeries(LineSeries, { color: "#ff557233", lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
        .createPriceLine({ price: sl, color: "#ff5572", lineWidth: 2, lineStyle: 1, axisLabelVisible: true, title: "SL" });
    }

    // Take profit levels — green dashed
    tps.forEach((tp, i) => {
      chart.addSeries(LineSeries, { color: "#00e5a033", lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
        .createPriceLine({ price: tp, color: "#00e5a0", lineWidth: 2, lineStyle: 1, axisLabelVisible: true, title: i === 0 ? "TP" : `TP${i + 1}` });
    });

    if (compact || !snapshot) return;  // mini / no-snapshot mode stops here

    const { overlays } = snapshot;

    // S/R zones
    overlays.supportResistance.forEach(sr => {
      const color = sr.type === "support" ? "#00e5a0" : "#ff5572";
      chart.addSeries(LineSeries, { color, lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
        .createPriceLine({ price: sr.price, color, lineWidth: sr.strength === "strong" ? 2 : 1, lineStyle: 0, axisLabelVisible: false, title: sr.type === "support" ? "S" : "R" });
    });

    // Trendlines — two-point LineSeries
    overlays.trendlines.forEach(tl => {
      const color = tl.direction === "up" ? "#00e5a060" : "#ff557260";
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, lineStyle: 3, lastValueVisible: false, priceLineVisible: false });
      s.setData([
        { time: toSec(tl.p1.time), value: tl.p1.price },
        { time: toSec(tl.p2.time), value: tl.p2.price },
      ]);
    });

    // Wyckoff range
    if (overlays.wyckoffRange) {
      const col = "#a78bfa";
      chart.addSeries(LineSeries, { color: col, lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
        .createPriceLine({ price: overlays.wyckoffRange.high, color: col, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: `Wyckoff ${overlays.wyckoffRange.phase} Hi` });
      chart.addSeries(LineSeries, { color: col, lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
        .createPriceLine({ price: overlays.wyckoffRange.low,  color: col, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: "Wyckoff Lo" });
    }

    // Elliott wave pivots
    if (overlays.elliottPivots && overlays.elliottPivots.length >= 2) {
      const s = chart.addSeries(LineSeries, { color: "#ffb020", lineWidth: 1, lineStyle: 3, lastValueVisible: false, priceLineVisible: false });
      s.setData(
        overlays.elliottPivots
          .filter(p => p.timestamp > 0)
          .map(p => ({ time: toSec(p.timestamp), value: p.price }))
      );
    }

    // Harmonic PRZ
    if (overlays.harmonicPattern) {
      const col = "#00e5a0";
      chart.addSeries(LineSeries, { color: col, lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
        .createPriceLine({ price: overlays.harmonicPattern.prz_high, color: col, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: `${overlays.harmonicPattern.name} PRZ Hi` });
      chart.addSeries(LineSeries, { color: col, lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
        .createPriceLine({ price: overlays.harmonicPattern.prz_low,  color: col, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: "PRZ Lo" });
    }
  }, [snapshot, compact, stopLoss, takeProfits, entryZoneLow, entryZoneHigh]);

  useEffect(() => {
    if (!containerRef.current) return;

    const binanceSymbol = snapshot?.binanceSymbol ?? toBinance(symbol);
    if (!binanceSymbol) {
      containerRef.current.innerHTML =
        '<p style="color:rgba(255,255,255,0.2);text-align:center;padding:30px 0;font-size:11px;font-family:monospace">Chart unavailable for this coin</p>';
      return;
    }

    const chart = createChart(containerRef.current, {
      height,
      layout:    { background: { color: "transparent" }, textColor: "rgba(255,255,255,0.45)" },
      grid:      { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      crosshair: { mode: 1 },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "rgba(255,255,255,0.06)" },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:         "#00e5a0",
      downColor:       "#ff5572",
      borderUpColor:   "#00e5a0",
      borderDownColor: "#ff5572",
      wickUpColor:     "#00e5a066",
      wickDownColor:   "#ff557266",
    });

    drawOverlays(chart);

    getOhlcv(binanceSymbol, timeframe)
      .then(({ candles }) => {
        const data = candles.map(c => ({
          time:  toSec(c.timestamp) as UTCTimestamp,
          open:  c.open,
          high:  c.high,
          low:   c.low,
          close: c.close,
        }));
        candleSeries.setData(data);
        chart.timeScale().fitContent();

        if (snapshot) {
          const snapshotSec = toSec(new Date(snapshot.snapshotAt).getTime());
          createSeriesMarkers(candleSeries, [{
            time:     snapshotSec,
            position: "aboveBar",
            color:    "#ffffff55",
            shape:    "arrowDown",
            text:     "Signal",
          }]);
        }
      })
      .catch(() => {
        if (containerRef.current) {
          containerRef.current.innerHTML =
            '<p style="color:rgba(255,85,114,0.6);text-align:center;padding:30px 0;font-size:11px;font-family:monospace">Chart data unavailable</p>';
        }
      });

    return () => { chart.remove(); };
  }, [snapshot, symbol, timeframe, height, drawOverlays]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
