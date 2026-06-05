import { useQuery } from '@tanstack/react-query'
import { coinService } from '@/services/coin.service'

export function useCoinList() {
  return useQuery({
    queryKey: ['coins'],
    queryFn: coinService.getAll,
    refetchInterval: 15_000,   // poll every 15s
    staleTime: 10_000,
  })
}