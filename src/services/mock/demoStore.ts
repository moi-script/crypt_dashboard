/**
 * demoStore — a localStorage-backed stand-in for the protected portfolio &
 * alert endpoints, used only when the live backend is unreachable. Lets the
 * full app (including auth-gated CRUD) be explored without a running API.
 */
import type { Alert, CreateAlertInput } from "@/models/alert.model";
import type { Holding, Portfolio, UpsertHoldingInput } from "@/models/portfolio.model";
import type { AuthResponse } from "@/models/auth.model";

const KEY = "cd.demo";
const DEMO_USER_ID = "demo-user";

interface DemoState {
  holdings: Holding[];
  alerts: Alert[];
}

function read(): DemoState {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    /* ignore */
  }
  const s = seed();
  write(s);
  return s;
}

function write(s: DemoState) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(s));
}

function seed(): DemoState {
  return {
    holdings: [
      { coinId: "bitcoin", quantity: 0.85, avgCost: 58200, addedAt: new Date().toISOString() },
      { coinId: "ethereum", quantity: 9.5, avgCost: 2950, addedAt: new Date().toISOString() },
      { coinId: "solana", quantity: 120, avgCost: 102, addedAt: new Date().toISOString() },
      { coinId: "chainlink", quantity: 540, avgCost: 13.1, addedAt: new Date().toISOString() },
    ],
    alerts: [
      { id: "a1", userId: DEMO_USER_ID, coinId: "bitcoin", condition: "above", threshold: 70000, triggered: false, active: true, createdAt: new Date().toISOString() },
      { id: "a2", userId: DEMO_USER_ID, coinId: "ethereum", condition: "below", threshold: 3200, triggered: false, active: true, createdAt: new Date().toISOString() },
      { id: "a3", userId: DEMO_USER_ID, coinId: "solana", condition: "pct_change", threshold: 8, triggered: true, active: true, triggeredAt: new Date().toISOString(), createdAt: new Date().toISOString() },
    ],
  };
}

export const demoStore = {
  /* auth */
  authResponse(email: string): AuthResponse {
    return {
      accessToken: "demo.access." + btoa(email).replace(/=/g, ""),
      refreshToken: "demo.refresh." + btoa(email).replace(/=/g, ""),
      user: { id: DEMO_USER_ID, email },
    };
  },

  /* portfolio */
  getPortfolio(): Portfolio {
    return { userId: DEMO_USER_ID, holdings: read().holdings };
  },
  upsertHolding(input: UpsertHoldingInput): Portfolio {
    const s = read();
    const existing = s.holdings.find((h) => h.coinId === input.coinId);
    if (existing) {
      existing.quantity = input.quantity;
      existing.avgCost = input.avgCost;
    } else {
      s.holdings.push({ ...input, addedAt: new Date().toISOString() });
    }
    write(s);
    return { userId: DEMO_USER_ID, holdings: s.holdings };
  },
  removeHolding(coinId: string): Portfolio {
    const s = read();
    s.holdings = s.holdings.filter((h) => h.coinId !== coinId);
    write(s);
    return { userId: DEMO_USER_ID, holdings: s.holdings };
  },

  /* alerts */
  getAlerts(): Alert[] {
    return read().alerts.filter((a) => a.active);
  },
  createAlert(input: CreateAlertInput): Alert {
    const s = read();
    const alert: Alert = {
      id: "a" + Date.now(),
      userId: DEMO_USER_ID,
      ...input,
      triggered: false,
      active: true,
      createdAt: new Date().toISOString(),
    };
    s.alerts.unshift(alert);
    write(s);
    return alert;
  },
  toggleAlert(id: string, active: boolean): Alert {
    const s = read();
    const a = s.alerts.find((x) => x.id === id);
    if (a) a.active = active;
    write(s);
    return a!;
  },
  deleteAlert(id: string): void {
    const s = read();
    s.alerts = s.alerts.filter((x) => x.id !== id);
    write(s);
  },
};
