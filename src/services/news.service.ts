import { apiClient, withFallback } from "./api.client";
import { mockNews } from "./mock/fixtures";
import type { NewsArticle } from "@/models/news.model";

export const newsService = {
  getLatest: (limit = 20) =>
    withFallback<NewsArticle[]>(
      () => apiClient.get<NewsArticle[]>(`/news?limit=${limit}`),
      () => mockNews(limit),
    ),

  getForCoin: (coinId: string, limit = 20) =>
    withFallback<NewsArticle[]>(
      () => apiClient.get<NewsArticle[]>(`/news/coin/${coinId}?limit=${limit}`),
      () => mockNews(limit, coinId),
    ),
};
