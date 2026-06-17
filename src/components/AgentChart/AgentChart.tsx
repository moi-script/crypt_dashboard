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

interface Props {
  snapshot:  ChartSnapshot;
  timeframe: string;
  height:    number;
  compact?:  boolean;   // true = mini mode: only entry/SL/TP lines
}

const FRAMEWORK_COLORS: Record<string, string> = {
  SmartMoney:  "#36b6ff",
  Wyckoff:     "#a78bfa",
  ElliottWave: "#ffb020",
  Harmonic:    "#00e5a0",
};

function toSec(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp;
}

export function AgentChart({ snapshot, timeframe, height, compact = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);

  const drawOverlays = useCallback((chart: IChartApi) => {
    const { overlays, entryZone, stopLoss, takeProfitLevels } = snapshot;

    // Entry zone — amber band (two horizontal price lines via invisible LineSeries hosts)
    chart.addSeries(LineSeries, { color: "#ffb020aa", lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
      .createPriceLine({ price: entryZone.high, color: "#ffb020", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "Entry Hi" });
    chart.addSeries(LineSeries, { color: "#ffb020aa", lineWidth: 1, lastValueVisible: false, priceLineVisible: false })
      .createPriceLine({ price: entryZone.low,  color: "#ffb020", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "Entry Lo" });

    // Stop loss — red
    const slSeries = chart.addSeries(LineSeries, { color: "#ff5572", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    slSeries.createPriceLine({ price: stopLoss, color: "#ff5572", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "SL" });

    // Take profit levels — green
    takeProfitLevels.forEach((tp, i) => {
      const tpSeries = chart.addSeries(LineSeries, { color: "#00e5a0", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
      tpSeries.createPriceLine({ price: tp, color: "#00e5a0", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: i === 0 ? "TP" : `TP${i + 1}` });
    });

    if (compact) return;  // mini mode stops here

    // S/R zones
    overlays.supportResistance.forEach(sr => {
      const color = sr.type === "support" ? "#00e5a0" : "#ff5572";
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
      s.createPriceLine({ price: sr.price, color, lineWidth: sr.strength === "strong" ? 2 : 1, lineStyle: 0, axisLabelVisible: false, title: sr.type === "support" ? "S" : "R" });
    });

    // Trendlines — each as a two-point LineSeries
    overlays.trendlines.forEach(tl => {
      const color = tl.direction === "up" ? "#00e5a060" : "#ff557260";
      const tlSeries = chart.addSeries(LineSeries, { color, lineWidth: 1, lineStyle: 3 });
      tlSeries.setData([
        { time: toSec(tl.p1.time), value: tl.p1.price },
        { time: toSec(tl.p2.time), value: tl.p2.price },
      ]);
    });

    // Wyckoff range rectangle (two horizontal lines)
    if (overlays.wyckoffRange) {
      const wHigh = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
      const wLow  = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
      wHigh.createPriceLine({ price: overlays.wyckoffRange.high, color: "#a78bfa80", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: `Wyckoff ${overlays.wyckoffRange.phase} Hi` });
      wLow.createPriceLine(  { price: overlays.wyckoffRange.low,  color: "#a78bfa80", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: "Wyckoff Lo" });
    }

    // Elliott wave pivot markers — rendered as a connected line through pivot prices
    if (overlays.elliottPivots && overlays.elliottPivots.length >= 2) {
      const eSeries = chart.addSeries(LineSeries, { color: "#ffb020", lineWidth: 1, lineStyle: 3 });
      eSeries.setData(
        overlays.elliottPivots
          .filter(p => p.timestamp > 0)
          .map(p => ({ time: toSec(p.timestamp), value: p.price }))
      );
    }

    // Harmonic PRZ band
    if (overlays.harmonicPattern) {
      const hHigh = chart.addSeries(LineSeries, { color: "#00e5a0", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
      const hLow  = chart.addSeries(LineSeries, { color: "#00e5a0", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
      hHigh.createPriceLine({ price: overlays.harmonicPattern.prz_high, color: "#00e5a080", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: `${overlays.harmonicPattern.name} PRZ Hi` });
      hLow.createPriceLine(  { price: overlays.harmonicPattern.prz_low,  color: "#00e5a080", lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: "PRZ Lo" });
    }
  }, [snapshot, compact]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      height,
      layout:     { background: { color: "rgb(8,18,32)" }, textColor: "rgba(255,255,255,0.5)" },
      grid:       { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      crosshair:  { mode: 1 },
      timeScale:  { timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:   "#00e5a0",
      downColor: "#ff5572",
      borderUpColor:   "#00e5a0",
      borderDownColor: "#ff5572",
      wickUpColor:     "#00e5a0",
      wickDownColor:   "#ff5572",
    });

    drawOverlays(chart);

    // Snapshot-at vertical marker — a single candle overlay at snapshotAt time
    const snapshotSec = toSec(new Date(snapshot.snapshotAt).getTime());

    // Load live candles
    getOhlcv(snapshot.binanceSymbol, timeframe)
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

        // Mark the snapshot timestamp with a vertical line via a custom marker
        createSeriesMarkers(candleSeries, [{
          time:     snapshotSec,
          position: "aboveBar",
          color:    "#ffffff40",
          shape:    "arrowDown",
          text:     "Signal",
        }]);
      })
      .catch(() => {/* ignore — chart still renders with overlays */});

    return () => { chart.remove(); chartRef.current = null; };
  }, [snapshot, timeframe, height, drawOverlays]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
