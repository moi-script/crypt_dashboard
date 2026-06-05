import { useQuery } from "@tanstack/react-query";
import { newsService } from "@/services/news.service";

export function useNewsFeed(limit = 20) {
  return useQuery({
    queryKey: ["news", "all", limit],
    queryFn: () => newsService.getLatest(limit),
    refetchInterval: 120_000,
  });
}

export function useCoinNews(coinId: string, limit = 8) {
  return useQuery({
    queryKey: ["news", coinId, limit],
    queryFn: () => newsService.getForCoin(coinId, limit),
    refetchInterval: 120_000,
    enabled: !!coinId,
  });
}
