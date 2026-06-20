import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { paperWalletService } from "@/services/paperWallet.service_frontend";

export function useWallet() {
  return useQuery({
    queryKey: ["paper-wallet"],
    queryFn: () => paperWalletService.getWallet(),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

export function useWalletStats() {
  return useQuery({
    queryKey: ["paper-wallet-stats"],
    queryFn: () => paperWalletService.getStats(),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

export function useWalletTrades(params?: { limit?: number; skip?: number }) {
  return useQuery({
    queryKey: ["paper-wallet-trades", params],
    queryFn: () => paperWalletService.getTrades(params),
    staleTime: 15_000,
  });
}

export function useResetWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => paperWalletService.reset(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paper-wallet"] });
      qc.invalidateQueries({ queryKey: ["paper-wallet-stats"] });
      qc.invalidateQueries({ queryKey: ["paper-wallet-trades"] });
    },
  });
}
