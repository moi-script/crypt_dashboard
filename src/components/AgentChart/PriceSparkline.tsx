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

const FOUR_H_SEC = 4 * 3600;

function toSec(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp;
}

export function PriceSparkline({
  snapshot,
  timeframe = "4h",
  height = 260,
}: SparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const FUTURE_BARS = 18; // blank bars on the right showing projection space

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { color: "rgb(8,18,32)" },
        textColor:  "rgba(255,255,255,0.5)",
        fontSize:   11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: { mode: 1 },
      timeScale: {
        timeVisible:    true,
        secondsVisible: false,
        borderColor:    "rgba(255,255,255,0.08)",
        rightOffset:    FUTURE_BARS,
        barSpacing:     11,
        fixRightEdge:   false,
        fixLeftEdge:    true,
      },
      rightPriceScale: {
        borderColor:  "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.06, bottom: 0.06 },
      },
      handleScroll: false,
      handleScale:  false,
    });

    let destroyed = false;

    getOhlcv(snapshot.binanceSymbol, timeframe, 30)
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

        const firstTime = data[0].time as number;
        const lastTime  = data[data.length - 1].time as number;
        const futureEnd = (lastTime + FUTURE_BARS * FOUR_H_SEC) as UTCTimestamp;

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
            color: sr.type === "support" ? "#00e5a050" : "#ff557250",
            lineWidth: 1, lineStyle: 0,
            axisLabelVisible: true,
            title: sr.type === "support" ? "S" : "R",
          });
        });

        // ── Trendlines — extrapolated into future projection space ──────────
        snapshot.overlays.trendlines?.forEach(tl => {
          const color = tl.direction === "up" ? "#ffb020bb" : "#ff5572bb";
          const t1 = toSec(tl.p1.time) as number;
          const t2 = toSec(tl.p2.time) as number;
          const span  = t2 - t1 || 1;
          const slope = (tl.p2.price - tl.p1.price) / span;

          // Start: clamp to firstTime if anchor is before chart range
          const tStart = Math.max(firstTime, t1) as UTCTimestamp;
          const pStart = tl.p1.price + slope * (tStart - t1);

          // End: always project into the future (beyond the last candle)
          const tEnd = futureEnd;
          const pEnd = tl.p1.price + slope * ((tEnd as number) - t1);

          const tlSeries: ISeriesApi<"Line"> = chart.addSeries(LineSeries, {
            color,
            lineWidth: 2,
            lineStyle: 0,
            lastValueVisible:       true,
            priceLineVisible:       false,
            crosshairMarkerVisible: false,
          });
          tlSeries.setData([
            { time: tStart, value: pStart },
            { time: tEnd,   value: pEnd   },
          ]);
        });

        // ── Order blocks (thin shaded bands) ───────────────────────────────
        snapshot.overlays.orderBlocks?.forEach(ob => {
          const color = ob.type === "bullish" ? "#00e5a055" : "#ff557255";
          candleSeries.createPriceLine({ price: ob.high, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: ob.type === "bullish" ? "OB+" : "OB-" });
          candleSeries.createPriceLine({ price: ob.low,  color, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });
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
