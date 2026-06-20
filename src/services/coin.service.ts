import { apiClient, withFallback } from "./api.client";
import { mockCoin, mockCoins, mockIndicators, mockOHLCV } from "./mock/fixtures";
import type { Coin, Indicator, OHLCVBar, OHLCVRange } from "@/models/coin.model";

export const coinService = {
  getAll: async () => {
    try {
      return await apiClient.get<Coin[]>("/coins");
    } catch {
      // Backend unreachable OR returning an error (e.g. CoinGecko rate limit) —
      // always show coins rather than an empty table.
      return mockCoins();
    }
  },

  getOne: (id: string) =>
    withFallback<Coin>(
      () => apiClient.get<Coin>(`/coins/${id}`),
      () => {
        const c = mockCoin(id);
        if (!c) throw new Error("Coin not found");
        return c;
      },
    ),

  getOHLCV: (id: string, range: OHLCVRange) =>
    withFallback<OHLCVBar[]>(
      () => apiClient.get<OHLCVBar[]>(`/coins/${id}/ohlcv?range=${range}`),
      () => mockOHLCV(id, range),
    ),

  getIndicators: (id: string, limit = 100) =>
    withFallback<Indicator[]>(
      () => apiClient.get<Indicator[]>(`/coins/${id}/indicators?limit=${limit}`),
      () => mockIndicators(id, limit),
    ),
};
