"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { getOhlcv } from "@/services/agent.service.frontend";
import type { ChartSnapshot } from "@/services/agent.service.frontend";

export interface SparklineProps {
  snapshot:   ChartSnapshot;
  timeframe?: string;
  height?:    number;
}

function toSec(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp;
}

export function PriceSparkline({
  snapshot,
  timeframe = "4h",
  height = 180,
}: SparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { color: "rgb(8,18,32)" },
        textColor:  "rgba(255,255,255,0.45)",
        fontSize:   10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: { mode: 1 },
      timeScale: {
        timeVisible:     true,
        secondsVisible:  false,
        borderColor:     "rgba(255,255,255,0.08)",
        barSpacing:      4,
        fixLeftEdge:     true,
        fixRightEdge:    true,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      handleScroll: false,
      handleScale:  false,
    });

    let destroyed = false;

    getOhlcv(snapshot.binanceSymbol, timeframe, 80)
      .then(({ candles }) => {
        if (destroyed || !candles?.length) return;

        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor:         "#00e5a0",
          downColor:       "#ff5572",
          borderUpColor:   "#00e5a0",
          borderDownColor: "#ff5572",
          wickUpColor:     "#00e5a0",
          wickDownColor:   "#ff5572",
        });

        const data = candles.map(c => ({
          time:  toSec(c.timestamp),
          open:  c.open,
          high:  c.high,
          low:   c.low,
          close: c.close,
        }));
        candleSeries.setData(data);

        // ── Entry zone ──────────────────────────────────────────────────────
        candleSeries.createPriceLine({
          price: snapshot.entryZone.high,
          color: "#ffb020cc", lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: "Entry Hi",
        });
        candleSeries.createPriceLine({
          price: snapshot.entryZone.low,
          color: "#ffb020cc", lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: "Entry Lo",
        });

        // ── Stop loss ───────────────────────────────────────────────────────
        candleSeries.createPriceLine({
          price: snapshot.stopLoss,
          color: "#ff5572", lineWidth: 2, lineStyle: 2,
          axisLabelVisible: true, title: "SL",
        });

        // ── Take profit levels ──────────────────────────────────────────────
        snapshot.takeProfitLevels.forEach((tp, i) => {
          candleSeries.createPriceLine({
            price: tp,
            color: "#00e5a0", lineWidth: 2, lineStyle: 2,
            axisLabelVisible: true, title: i === 0 ? "TP1" : `TP${i + 1}`,
          });
        });

        // ── Support / resistance ────────────────────────────────────────────
        snapshot.overlays.supportResistance?.forEach(sr => {
          candleSeries.createPriceLine({
            price: sr.price,
            color: sr.type === "support" ? "#00e5a060" : "#ff557260",
            lineWidth: sr.strength === "strong" ? 2 : 1,
            lineStyle: 0,
            axisLabelVisible: true,
            title: sr.type === "support" ? "S" : "R",
          });
        });

        // ── Trendlines ──────────────────────────────────────────────────────
        const firstTime = data[0].time;
        const lastTime  = data[data.length - 1].time;

        snapshot.overlays.trendlines?.forEach(tl => {
          const color = tl.direction === "up" ? "#ffb02090" : "#ff557260";
          const t1 = toSec(tl.p1.time);
          const t2 = toSec(tl.p2.time);
          const tStart = Math.max(firstTime, Math.min(t1, t2)) as UTCTimestamp;
          const tEnd   = Math.min(lastTime,  Math.max(t1, t2)) as UTCTimestamp;
          const span   = t2 - t1 || 1;
          const slope  = (tl.p2.price - tl.p1.price) / span;
          const pStart = tl.p1.price + slope * (tStart - t1);
          const pEnd   = tl.p1.price + slope * (tEnd   - t1);

          const tlSeries: ISeriesApi<"Line"> = chart.addSeries(LineSeries, {
            color, lineWidth: 2, lineStyle: 0,
            lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
          });
          tlSeries.setData([
            { time: tStart, value: pStart },
            { time: tEnd,   value: pEnd   },
          ]);
        });

        chart.timeScale().fitContent();
      })
      .catch(() => {
        if (!destroyed && containerRef.current) {
          containerRef.current.innerHTML =
            '<p style="color:rgba(255,85,114,0.7);text-align:center;padding:20px;font-size:11px;font-family:monospace">chart data unavailable</p>';
        }
      });

    return () => {
      destroyed = true;
      chart.remove();
    };
  }, [snapshot, timeframe, height]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
