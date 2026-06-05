export type AlertCondition = "above" | "below" | "pct_change";

export interface Alert {
  id: string;
  userId: string;
  coinId: string;
  condition: AlertCondition;
  threshold: number;
  triggered: boolean;
  active: boolean;
  triggeredAt?: string;
  createdAt?: string;
}

export interface CreateAlertInput {
  coinId: string;
  condition: AlertCondition;
  threshold: number;
}

export const CONDITION_LABEL: Record<AlertCondition, string> = {
  above: "Price rises above",
  below: "Price falls below",
  pct_change: "24h change exceeds ±",
};
