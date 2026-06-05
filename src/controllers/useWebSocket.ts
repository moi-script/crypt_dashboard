"use client";

import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { WS_URL, demoMode } from "@/services/api.client";
import type { Coin } from "@/models/coin.model";

interface PriceTick {
  coinId: string;
  price: number;
  change24h?: number;
}

/** Apply a price tick to every cached query that contains the coin. */
function applyTick(qc: QueryClient, tick: PriceTick) {
  qc.setQueryData<Coin[]>(["coins"], (prev) =>
    prev?.map((c) =>
      c.id === tick.coinId
        ? { ...c, price: tick.price, change24h: tick.change24h ?? c.change24h }
        : c,
    ),
  );
  qc.setQueryData<Coin>(["coin", tick.coinId], (prev) =>
    prev ? { ...prev, price: tick.price, change24h: tick.change24h ?? prev.change24h } : prev,
  );
}

/** Nudge cached prices on an interval so the terminal feels live without a feed. */
function startSimulator(qc: QueryClient): () => void {
  const id = setInterval(() => {
    const coins = qc.getQueryData<Coin[]>(["coins"]);
    if (!coins?.length) return;
    // tick a handful of random coins each cycle
    for (let i = 0; i < 5; i++) {
      const coin = coins[Math.floor(Math.random() * coins.length)];
      if (!coin || coin.symbol === "USDT") continue;
      const drift = (Math.random() - 0.49) * 0.004;
      applyTick(qc, {
        coinId: coin.id,
        price: +(coin.price * (1 + drift)).toFixed(coin.price < 1 ? 5 : 2),
        change24h: +(coin.change24h + drift * 100).toFixed(2),
      });
    }
  }, 2200);
  return () => clearInterval(id);
}

/**
 * useLivePrices — keeps cached coin prices fresh in real time.
 * Prefers the backend WebSocket feed; transparently falls back to a local
 * simulator when the socket can't be established (e.g. backend offline).
 */
export function useLivePrices() {
  const qc = useQueryClient();

  useEffect(() => {
    let socket: WebSocket | null = null;
    let stopSim: (() => void) | null = null;
    let opened = false;

    if (!demoMode.value) {
      try {
        socket = new WebSocket(`${WS_URL}/ws`);
        socket.onopen = () => {
          opened = true;
        };
        socket.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            const ticks: PriceTick[] = Array.isArray(msg)
              ? msg
              : msg.type === "price" || msg.coinId
                ? [msg]
                : msg.data
                  ? [].concat(msg.data)
                  : [];
            ticks.forEach((t) => t?.coinId && applyTick(qc, t));
          } catch {
            /* ignore malformed frames */
          }
        };
        socket.onerror = () => socket?.close();
      } catch {
        socket = null;
      }
    }

    // If the socket isn't live shortly, run the simulator instead.
    const fallbackTimer = setTimeout(() => {
      if (!opened) {
        demoMode.enable();
        stopSim = startSimulator(qc);
      }
    }, 2500);

    return () => {
      clearTimeout(fallbackTimer);
      stopSim?.();
      socket?.close();
    };
  }, [qc]);
}
