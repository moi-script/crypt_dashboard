import { useQuery } from "@tanstack/react-query";
import { coinService } from "@/services/coin.service";
import type { OHLCVRange } from "@/models/coin.model";

export function useCoinDetail(id: string) {
  return useQuery({
    queryKey: ["coin", id],
    queryFn: () => coinService.getOne(id),
    refetchInterval: 15_000,
    enabled: !!id,
  });
}

export function useOHLCV(id: string, range: OHLCVRange) {
  return useQuery({
    queryKey: ["ohlcv", id, range],
    queryFn: () => coinService.getOHLCV(id, range),
    refetchInterval: 30_000,
    enabled: !!id,
  });
}

export function useIndicators(id: string, limit = 100) {
  return useQuery({
    queryKey: ["indicators", id, limit],
    queryFn: () => coinService.getIndicators(id, limit),
    refetchInterval: 60_000,
    enabled: !!id,
  });
}
