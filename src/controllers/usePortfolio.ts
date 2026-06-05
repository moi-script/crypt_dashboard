import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portfolioService } from "@/services/portfolio.service";
import type { UpsertHoldingInput } from "@/models/portfolio.model";

export function usePortfolio(enabled = true) {
  return useQuery({
    queryKey: ["portfolio"],
    queryFn: () => portfolioService.get(),
    enabled,
  });
}

export function useUpsertHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertHoldingInput) => portfolioService.upsertHolding(input),
    onSuccess: (data) => qc.setQueryData(["portfolio"], data),
  });
}

export function useRemoveHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (coinId: string) => portfolioService.removeHolding(coinId),
    onSuccess: (data) => qc.setQueryData(["portfolio"], data),
  });
}
