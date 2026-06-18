"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { getOhlcv } from "@/services/agent.service.frontend";
import type { ChartSnapshot } from "@/services/agent.service.frontend";

interface Props {
  snapshot:  ChartSnapshot;
  timeframe: string;
  height:    number;
  compact?:  boolean;
}

function toSec(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp;
}

export function AgentChart({ snapshot, timeframe, height, compact = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout:    { background: { color: "rgb(8,18,32)" }, textColor: "rgba(255,255,255,0.5)" },
      grid:      { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      crosshair: { mode: 1 },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "rgba(255,255,255,0.08)" },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:         "#00e5a0",
      downColor:       "#ff5572",
      borderUpColor:   "#00e5a0",
      borderDownColor: "#ff5572",
      wickUpColor:     "#00e5a0",
      wickDownColor:   "#ff5572",
    });

    getOhlcv(snapshot.binanceSymbol, timeframe)
      .then(({ candles }) => {
        if (!candles?.length) return;

        const data = candles.map(c => ({
          time:  toSec(c.timestamp) as UTCTimestamp,
          open:  c.open,
          high:  c.high,
          low:   c.low,
          close: c.close,
        }));

        candleSeries.setData(data);

        // ── Horizontal price lines on the candle series ──────────────────────
        // Entry zone
        candleSeries.createPriceLine({
          price: snapshot.entryZone.high,
          color: "#ffb020",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Entry Hi",
        });
        candleSeries.createPriceLine({
          price: snapshot.entryZone.low,
          color: "#ffb020",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Entry Lo",
        });

        // Stop loss
        candleSeries.createPriceLine({
          price: snapshot.stopLoss,
          color: "#ff5572",
          lineWidth: 2,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "SL",
        });

        // Take profit levels
        snapshot.takeProfitLevels.forEach((tp, i) => {
          candleSeries.createPriceLine({
            price: tp,
            color: "#00e5a0",
            lineWidth: 2,
            lineStyle: 2,
            axisLabelVisible: true,
            title: i === 0 ? "TP1" : `TP${i + 1}`,
          });
        });

        if (!compact) {
          // Support / Resistance
          snapshot.overlays.supportResistance.forEach(sr => {
            const color = sr.type === "support" ? "#00e5a080" : "#ff557280";
            candleSeries.createPriceLine({
              price: sr.price,
              color,
              lineWidth: sr.strength === "strong" ? 2 : 1,
              lineStyle: 0,
              axisLabelVisible: true,
              title: sr.type === "support" ? "S" : "R",
            });
          });

          // Wyckoff range
          if (snapshot.overlays.wyckoffRange) {
            candleSeries.createPriceLine({ price: snapshot.overlays.wyckoffRange.high, color: "#a78bfa80", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: `Wyckoff ${snapshot.overlays.wyckoffRange.phase}` });
            candleSeries.createPriceLine({ price: snapshot.overlays.wyckoffRange.low,  color: "#a78bfa80", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: "Wyckoff Lo" });
          }

          // Harmonic PRZ
          if (snapshot.overlays.harmonicPattern) {
            candleSeries.createPriceLine({ price: snapshot.overlays.harmonicPattern.prz_high, color: "#00e5a080", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: `${snapshot.overlays.harmonicPattern.name} Hi` });
            candleSeries.createPriceLine({ price: snapshot.overlays.harmonicPattern.prz_low,  color: "#00e5a080", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: "PRZ Lo" });
          }

          // Trendlines — extend across the visible time range
          const firstTime = data[0].time;
          const lastTime  = data[data.length - 1].time;

          snapshot.overlays.trendlines.forEach(tl => {
            const color = tl.direction === "up" ? "#ffb02090" : "#ff557260";
            const t1 = toSec(tl.p1.time);
            const t2 = toSec(tl.p2.time);

            // Clamp to the candle range so the line is always visible
            const tStart = Math.max(firstTime, Math.min(t1, t2)) as UTCTimestamp;
            const tEnd   = Math.min(lastTime, Math.max(t1, t2)) as UTCTimestamp;

            // Interpolate prices at the clamped range
            const span  = t2 - t1 || 1;
            const slope = (tl.p2.price - tl.p1.price) / span;
            const pStart = tl.p1.price + slope * (tStart - t1);
            const pEnd   = tl.p1.price + slope * (tEnd   - t1);

            const tlSeries: ISeriesApi<"Line"> = chart.addSeries(LineSeries, {
              color,
              lineWidth: 2,
              lineStyle: 0,
              lastValueVisible: false,
              priceLineVisible: false,
              crosshairMarkerVisible: false,
            });
            tlSeries.setData([
              { time: tStart, value: pStart },
              { time: tEnd,   value: pEnd   },
            ]);
          });

          // Elliott wave pivots
          if (snapshot.overlays.elliottPivots && snapshot.overlays.elliottPivots.length >= 2) {
            const eSeries: ISeriesApi<"Line"> = chart.addSeries(LineSeries, {
              color: "#ffb02090",
              lineWidth: 1,
              lineStyle: 3,
              lastValueVisible: false,
              priceLineVisible: false,
              crosshairMarkerVisible: false,
            });
            eSeries.setData(
              snapshot.overlays.elliottPivots
                .filter(p => p.timestamp > 0)
                .map(p => ({ time: toSec(p.timestamp), value: p.price }))
            );
          }

          // Order blocks as shaded horizontal price lines
          snapshot.overlays.orderBlocks?.forEach(ob => {
            const color = ob.type === "bullish" ? "#00e5a050" : "#ff557250";
            candleSeries.createPriceLine({ price: ob.high, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: ob.type === "bullish" ? "OB+" : "OB-" });
            candleSeries.createPriceLine({ price: ob.low,  color, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });
          });
        }

        chart.timeScale().fitContent();

        // Signal marker — snap to the nearest candle at or before the snapshot time
        const snapshotSec = toSec(new Date(snapshot.snapshotAt).getTime());
        const markerCandle = data.reduce((best, d) =>
          (d.time as number) <= (snapshotSec as number) &&
          (d.time as number) > ((best?.time ?? 0) as number) ? d : best,
          data[0],
        );
        if (markerCandle) {
          createSeriesMarkers(candleSeries, [{
            time:     markerCandle.time,
            position: "aboveBar",
            color:    "#ffffff60",
            shape:    "arrowDown",
            text:     "Signal",
          }]);
        }
      })
      .catch(() => {
        if (containerRef.current) {
          containerRef.current.innerHTML =
            '<p style="color:rgba(255,85,114,0.7);text-align:center;padding:20px;font-size:12px;font-family:monospace">Chart data unavailable</p>';
        }
      });

    return () => { chart.remove(); };
  }, [snapshot, timeframe, height, compact]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
