import { apiClient, withFallback } from "./api.client";
import { demoStore } from "./mock/demoStore";
import type { Portfolio, UpsertHoldingInput } from "@/models/portfolio.model";

export const portfolioService = {
  get: () =>
    withFallback<Portfolio>(
      () => apiClient.get<Portfolio>("/portfolio"),
      () => demoStore.getPortfolio(),
    ),

  upsertHolding: (input: UpsertHoldingInput) =>
    withFallback<Portfolio>(
      () => apiClient.put<Portfolio>("/portfolio/holdings", input),
      () => demoStore.upsertHolding(input),
    ),

  removeHolding: (coinId: string) =>
    withFallback<Portfolio>(
      () => apiClient.del<Portfolio>(`/portfolio/holdings/${coinId}`),
      () => demoStore.removeHolding(coinId),
    ),
};
