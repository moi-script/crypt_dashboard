import { apiClient } from "./api.client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenBalance {
  symbol:     string;
  amount:     number;
  valueUsd:   number;
  avgCostUsd: number;
  updatedAt:  string;
}

export interface PaperWallet {
  walletId:         string;
  mode:             "paper";
  balances:         TokenBalance[];
  totalValueUsd:    number;
  initialUsd:       number;
  realizedPnlUsd:   number;
  unrealizedPnlUsd: number;
  createdAt:        string;
  updatedAt:        string;
}

export interface TradeTransaction {
  txId:              string;
  runId:             string;
  orderId?:          string;
  walletId:          string;
  side:              "buy" | "sell";
  tokenIn:           string;
  tokenOut:          string;
  amountIn:          number;
  amountOut:         number;
  amountUsd:         number;
  priceUsd:          number;
  priceInUsd:        number;
  feesUsd:           number;
  slippagePct:       number;
  realizedPnlUsd?:   number;
  pnlPct?:           number;
  strategy:          string;
  rationale:         string;
  confidence:        number;
  portfolioValueUsd: number;
  cumulativePnlUsd:  number;
  status:            "filled" | "partial" | "rejected" | "cancelled";
  executedAt:        string;
}

export interface WalletStats {
  wallet: {
    totalValueUsd:  number;
    initialUsd:     number;
    realizedPnlUsd: number;
    returnPct:      number;
    balances:       TokenBalance[];
  };
  trades: {
    total:       number;
    buys:        number;
    sells:       number;
    winners:     number;
    losers:      number;
    winRate:     number;
    avgWinUsd:   number;
    avgLossUsd:  number;
    totalFees:   number;
    totalVolume: number;
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export const paperWalletService = {
  getWallet: () =>
    apiClient.get<PaperWallet>("/paper-wallet"),

  getTrades: (params?: { limit?: number; skip?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    if (params?.skip  !== undefined) q.set("skip",  String(params.skip));
    const qs = q.toString();
    return apiClient.get<{ trades: TradeTransaction[]; count: number; skip: number; limit: number }>(
      `/paper-wallet/trades${qs ? `?${qs}` : ""}`,
    );
  },

  getStats: () =>
    apiClient.get<WalletStats>("/paper-wallet/stats"),

  reset: () =>
    apiClient.post<{ ok: boolean; wallet: PaperWallet }>("/paper-wallet/reset", {}),
};
