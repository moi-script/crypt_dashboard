"use client";

import { useEffect, useRef } from "react";
import type { OHLCVBar } from "@/models/coin.model";

/**
 * TradingView lightweight-charts candlestick + volume panel.
 * The library is browser-only, so it is dynamically imported inside an effect.
 */
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
  // chart instance + series kept across renders without forcing re-render
  const apiRef = useRef<{
    chart: import("lightweight-charts").IChartApi;
    candles: import("lightweight-charts").ISeriesApi<"Candlestick">;
    volume: import("lightweight-charts").ISeriesApi<"Histogram">;
  } | null>(null);

  // Create the chart once.
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
          textColor: "#6b7785",
          fontFamily: "var(--font-jb), monospace",
          fontSize: 11,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "rgba(27,35,45,0.5)" },
          horzLines: { color: "rgba(27,35,45,0.5)" },
        },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: { color: "#283340", width: 1, labelBackgroundColor: "#0f141b" },
          horzLine: { color: "#283340", width: 1, labelBackgroundColor: "#0f141b" },
        },
        rightPriceScale: { borderColor: "#1b232d" },
        timeScale: { borderColor: "#1b232d", timeVisible: true, secondsVisible: false },
      });

      const candles = chart.addSeries(lc.CandlestickSeries, {
        upColor: "#00e08a",
        downColor: "#ff4d5e",
        wickUpColor: "#0a7d52",
        wickDownColor: "#8f2630",
        borderVisible: false,
      });

      const volume = chart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      chart.priceScale("vol").applyOptions({
        scaleMargins: { top: 0.82, bottom: 0 },
      });

      apiRef.current = { chart, candles, volume };
      paint();

      cleanup = () => chart.remove();
    })();

    return () => {
      disposed = true;
      cleanup();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repaint whenever data changes.
  useEffect(() => {
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function paint() {
    const api = apiRef.current;
    if (!api || !data?.length) return;
    type T = import("lightweight-charts").UTCTimestamp;
    api.candles.setData(
      data.map((b) => ({
        time: b.time as T,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );
    api.volume.setData(
      data.map((b) => ({
        time: b.time as T,
        value: b.volume,
        color: b.close >= b.open ? "rgba(0,224,138,0.32)" : "rgba(255,77,94,0.32)",
      })),
    );
    api.chart.timeScale().fitContent();
  }

  return (
    <div className="relative" style={{ height }}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-panel/60">
          <span className="font-mono text-xs text-muted cursor-blink">loading feed</span>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
