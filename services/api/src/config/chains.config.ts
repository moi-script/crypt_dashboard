/**
 * chains.config.ts
 *
 * Network configuration for phase-3 on-chain execution.
 * Referenced by onchain.ingest.ts and onchain.executor.ts.
 * Keys/private data never live here — only public network details.
 */

export interface ChainConfig {
  chainId: number
  name: string
  rpcUrl: string         // from env, never hardcoded
  nativeCurrency: string
  blockTimeMs: number
  routers: {
    uniswapV3?: string
    uniswapV2?: string
    aerodromeV2?: string // Base-native
    camelotV3?: string   // Arbitrum-native
  }
  explorer: string
}

export const CHAINS: Record<string, ChainConfig> = {
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
    nativeCurrency: 'ETH',
    blockTimeMs: 2_000,
    routers: {
      uniswapV3:    '0x2626664c2603336E57B271c5C0b26F421741e481',
      aerodromeV2:  '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43',
    },
    explorer: 'https://basescan.org',
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: process.env.ARBITRUM_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
    nativeCurrency: 'ETH',
    blockTimeMs: 400,
    routers: {
      uniswapV3:  '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      camelotV3:  '0x1F721E2E82F6676FCE4eA07A5958cF098D339e18',
    },
    explorer: 'https://arbiscan.io',
  },
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: process.env.ETH_RPC_URL ?? 'https://eth.llamarpc.com',
    nativeCurrency: 'ETH',
    blockTimeMs: 12_000,
    routers: {
      uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      uniswapV2: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    },
    explorer: 'https://etherscan.io',
  },
}

export function getChain(name: string): ChainConfig {
  const chain = CHAINS[name]
  if (!chain) throw new Error(`Unknown chain: ${name}. Valid: ${Object.keys(CHAINS).join(', ')}`)
  return chain
}
