"use client";

import { useEffect, useRef } from "react";
import type { OHLCVBar } from "@/models/coin.model";

export function CandlestickChart({
  data,
  height = 380,
  loading,
}: {
  data: OHLCVBar[];
  height?: number;
  loading?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{
    chart: import("lightweight-charts").IChartApi;
    candles: import("lightweight-charts").ISeriesApi<"Candlestick">;
    volume: import("lightweight-charts").ISeriesApi<"Histogram">;
  } | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const lc = await import("lightweight-charts");
      if (disposed || !containerRef.current) return;

      const chart = lc.createChart(containerRef.current, {
        autoSize: true,
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: "rgba(148,163,184,0.7)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.028)" },
          horzLines: { color: "rgba(255,255,255,0.028)" },
        },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: { color: "rgba(0,212,255,0.3)", width: 1, labelBackgroundColor: "rgba(4,11,20,0.95)" },
          horzLine: { color: "rgba(0,212,255,0.3)", width: 1, labelBackgroundColor: "rgba(4,11,20,0.95)" },
        },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
        timeScale: { borderColor: "rgba(255,255,255,0.06)", timeVisible: true, secondsVisible: false },
      });

      const candles = chart.addSeries(lc.CandlestickSeries, {
        upColor:      "#00e5a0",
        downColor:    "#ff5572",
        wickUpColor:  "rgba(0,229,160,0.5)",
        wickDownColor:"rgba(255,85,114,0.5)",
        borderVisible: false,
      });

      const volume = chart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

      apiRef.current = { chart, candles, volume };
      paint();
      cleanup = () => chart.remove();
    })();

    return () => { disposed = true; cleanup(); apiRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function paint() {
    const api = apiRef.current;
    if (!api || !data?.length) return;
    type T = import("lightweight-charts").UTCTimestamp;
    api.candles.setData(data.map(b => ({ time: b.time as T, open: b.open, high: b.high, low: b.low, close: b.close })));
    api.volume.setData(data.map(b => ({
      time: b.time as T, value: b.volume,
      color: b.close >= b.open ? "rgba(0,229,160,0.28)" : "rgba(255,85,114,0.28)",
    })));
    api.chart.timeScale().fitContent();
  }

  return (
    <div className="relative" style={{ height }}>
      {loading && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
          style={{ background: "rgba(4,11,20,0.7)", backdropFilter: "blur(8px)", borderRadius: 10 }}
        >
          <div
            className="w-6 h-6 rounded-full spin"
            style={{ border: "2px solid rgba(0,212,255,0.2)", borderTopColor: "var(--cyan)" }}
          />
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-muted)" }}
          >
            loading feed
          </span>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}