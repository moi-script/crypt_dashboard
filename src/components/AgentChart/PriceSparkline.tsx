"use client";

/**
 * PriceSparkline
 *
 * A compact, chrome-free chart for trade proposal cards.
 * Shows: neon-green price area  ·  purple linear-regression trendline
 *        red dashed SL line      ·  green dashed TP line  ·  amber entry mid
 *
 * Powered by lightweight-charts (already in the bundle).
 * No axes, no grid, no crosshair — pure signal.
 */

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  type UTCTimestamp,
} from "lightweight-charts";
import { getOhlcv } from "@/services/agent.service.frontend";

export interface SparklineProps {
  binanceSymbol:    string;
  stopLoss:         number;
  takeProfitLevels: number[];
  entryZone:        { high: number; low: number };
  height?:          number;
}

// ── Simple linear regression over an array of y-values ─────────────────────
function linReg(ys: number[]): { start: number; end: number } {
  const n = ys.length;
  if (n < 2) return { start: ys[0] ?? 0, end: ys[0] ?? 0 };
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  for (let i = 0; i < n; i++) {
    sx  += i; sy += ys[i]; sxy += i * ys[i]; sx2 += i * i;
  }
  const d   = n * sx2 - sx * sx || 1;
  const m   = (n * sxy - sx * sy) / d;
  const b   = (sy - m * sx) / n;
  return { start: b, end: b + m * (n - 1) };
}

export function PriceSparkline({
  binanceSymbol,
  stopLoss,
  takeProfitLevels,
  entryZone,
  height = 96,
}: SparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background:  { color: "transparent" },
        textColor:   "rgba(0,0,0,0)",          // hide all labels
      },
      grid:            { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair:       { mode: 0 },             // hide crosshair
      timeScale:       { visible: false },
      rightPriceScale: { visible: false },
      leftPriceScale:  { visible: false },
      handleScroll:    false,
      handleScale:     false,
    });

    let destroyed = false;

    getOhlcv(binanceSymbol, "4h")
      .then(({ candles }) => {
        if (destroyed || !candles?.length) return;

        const slice  = candles.slice(-60);
        const toSec  = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp;

        // ── Price line (neon green) ────────────────────────────────────────
        const priceSeries = chart.addSeries(LineSeries, {
          color:                  "#00e5a0",
          lineWidth:              2,
          lineStyle:              0,
          priceLineVisible:       false,
          lastValueVisible:       false,
          crosshairMarkerVisible: false,
        });
        const priceData = slice.map(c => ({
          time:  toSec(c.timestamp),
          value: c.close,
        }));
        priceSeries.setData(priceData);

        // ── Linear regression trendline (purple) ──────────────────────────
        const { start, end } = linReg(slice.map(c => c.close));
        const trendSeries = chart.addSeries(LineSeries, {
          color:                  "#a78bfa",
          lineWidth:              2,
          lineStyle:              0,
          priceLineVisible:       false,
          lastValueVisible:       false,
          crosshairMarkerVisible: false,
        });
        trendSeries.setData([
          { time: toSec(slice[0].timestamp),                value: start },
          { time: toSec(slice[slice.length - 1].timestamp), value: end   },
        ]);

        // ── Stop loss (red dashed) ─────────────────────────────────────────
        priceSeries.createPriceLine({
          price: stopLoss, color: "#ff5572bb",
          lineWidth: 1, lineStyle: 2,
          axisLabelVisible: false, title: "",
        });

        // ── TP1 (green dashed) ────────────────────────────────────────────
        if (takeProfitLevels[0]) {
          priceSeries.createPriceLine({
            price: takeProfitLevels[0], color: "#00e5a0bb",
            lineWidth: 1, lineStyle: 2,
            axisLabelVisible: false, title: "",
          });
        }

        // ── Entry zone midpoint (amber dotted) ────────────────────────────
        priceSeries.createPriceLine({
          price: (entryZone.high + entryZone.low) / 2,
          color: "#ffb020bb", lineWidth: 1, lineStyle: 3,
          axisLabelVisible: false, title: "",
        });

        chart.timeScale().fitContent();
      })
      .catch(() => {
        if (!destroyed && containerRef.current) {
          containerRef.current.innerHTML =
            '<p style="color:rgba(255,255,255,0.15);text-align:center;padding:12px;font-size:10px;font-family:monospace">chart unavailable</p>';
        }
      });

    return () => {
      destroyed = true;
      chart.remove();
    };
  }, [binanceSymbol, stopLoss, takeProfitLevels, entryZone, height]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
