export interface Holding {
  coinId: string;
  quantity: number;
  avgCost: number; // USD cost basis per unit
  addedAt?: string;
}

export interface Portfolio {
  userId: string;
  holdings: Holding[];
}

export interface UpsertHoldingInput {
  coinId: string;
  quantity: number;
  avgCost: number;
}

/** A holding enriched with live market data for display. */
export interface HoldingRow extends Holding {
  name: string;
  symbol: string;
  image?: string;
  price: number;
  change24h: number;
  value: number; // quantity * price
  cost: number; // quantity * avgCost
  pnl: number; // value - cost
  pnlPct: number; // pnl / cost
  weight: number; // value / portfolio total
}
