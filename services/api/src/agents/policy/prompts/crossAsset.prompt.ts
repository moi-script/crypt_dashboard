
// ============================================================
// crossAsset.prompt.ts
// Injects BTC context into altcoin LLM analysis calls
// This is what makes altcoin analysis context-aware, not isolated
// ============================================================

import { BtcContext, DominanceData } from '@/agents/chartAnalysis.types';
// ─── Generate BTC Context Block for LLM ──────────────────────
export function buildBtcContextBlock(btcContext: BtcContext): string {
  const minutesLabel =
    btcContext.minutes_since_signal === 0 ? 'just now' :
    btcContext.minutes_since_signal < 60  ? `${btcContext.minutes_since_signal} minutes ago` :
    `${Math.floor(btcContext.minutes_since_signal / 60)} hours ago`;

  const dominanceSummary = buildDominanceSummary(btcContext.dominance);

  return `
<btc_context>
BTC Signal: ${btcContext.signal_type} | Fired: ${minutesLabel}
BTC Regime: ${btcContext.regime} | BTC Bias: ${btcContext.bias.toUpperCase()}
${btcContext.bos_direction ? `BTC BOS: ${btcContext.bos_direction} at ${btcContext.bos_level}` : ''}
${dominanceSummary}
</btc_context>
`;
}

// ─── Dominance summary ────────────────────────────────────────
function buildDominanceSummary(dominance: DominanceData): string {
  const phaseDescriptions = {
    btc_season:  'BTC SEASON active — alts underperforming, reduce altcoin position sizes',
    eth_season:  'ETH SEASON forming — L1/L2 tokens favored for outperformance',
    alt_season:  'ALT SEASON active — high-beta alts accelerating, expand universe',
    mixed:       'Mixed dominance — no clear sector rotation signal',
  };

  const trendArrow =
    dominance.btc_d_trend === 'rising'  ? '↑' :
    dominance.btc_d_trend === 'falling' ? '↓' : '→';

  return [
    `BTC Dominance: ${dominance.btc_dominance}% ${trendArrow}`,
    phaseDescriptions[dominance.market_phase],
    dominance.sector_leaders.length > 0
      ? `Leading sectors right now: ${dominance.sector_leaders.join(', ')}`
      : '',
  ].filter(Boolean).join(' | ');
}

// ─── Cross-Asset System Prompt Addon ─────────────────────────
// Prepended to the chart analyst prompt when analyzing altcoins
export const CROSS_ASSET_PROMPT_ADDON = `
## Cross-Asset Context Rules

You are analyzing an ALTCOIN. BTC context has been provided. Apply these rules:

1. **BTC Alignment Check**: Before confirming any bias, check if it aligns with BTC's current bias.
   - If they AGREE → confidence bonus: +10 points
   - If they CONFLICT → confidence penalty: -20 points minimum; flag the conflict explicitly in reasoning
   - If BTC is neutral → no adjustment

2. **Cascade Window**: If btc_context shows a signal fired recently:
   - Window open (< lag hours elapsed) → the altcoin SHOULD be reacting if correlated
   - No reaction yet despite window open → either setup is forming OR coin is decorrelating
   - Note this explicitly in reasoning

3. **Market Phase Adjustment**:
   - BTC Season: Only high-conviction, large-cap setups. Reduce confidence on small caps by 15.
   - Alt Season: Standard confidence. Sector leaders get +10 confidence if they're in the leading sector.
   - ETH Season: L1/L2 tokens get +10. DeFi is secondary. Others standard.

4. **Position Sizing Hint** (include in reasoning):
   - Correlated assets in same direction = 1 position risk, not 2
   - If BTC and altcoin both long → count as one correlated trade for portfolio risk purposes

5. **Override Rule**: If BTC regime is 'distribution' or 'trending_down' AND this altcoin shows a long setup:
   - Maximum confidence = 55 (never high conviction against HTF BTC trend)
   - Require minimum 3:1 R:R
   - Explicitly state: "Counter-trend to BTC — reduced confidence"
`;

// ─── Build full system prompt with cross-asset addon ─────────
export function buildCrossAssetSystemPrompt(basePrompt: string): string {
  return basePrompt + '\n\n' + CROSS_ASSET_PROMPT_ADDON;
}

// ─── Inject BTC context into user message ────────────────────
export function injectBtcContextIntoMessage(
  originalMessage: string,
  btcContext: BtcContext
): string {
  const contextBlock = buildBtcContextBlock(btcContext);
  return contextBlock + '\n' + originalMessage;
}



