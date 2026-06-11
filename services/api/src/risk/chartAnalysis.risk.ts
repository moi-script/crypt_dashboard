
// ============================================================
// chartAnalysis.risk.ts
// Risk rules specific to structure-based trading setups
// Applied AFTER LLM synthesis, BEFORE execution.gateway.ts
// ============================================================

import {
  ChartAnalysisResult,
  MarketPrimitives,
  BtcContext,
} from '../agents/chartAnalysis.types';

// ─── Risk Rule Result ─────────────────────────────────────────
export interface RiskCheckResult {
  approved: boolean;
  rejection_reason?: string;
  warnings: string[];
  adjusted_confidence: number;
  adjusted_stop_loss?: number;
  adjusted_size_multiplier: number; // 0.25 | 0.5 | 0.75 | 1.0
}

// ─── Minimum R:R by framework ─────────────────────────────────
const MIN_RR: Record<string, number> = {
  SmartMoney:   2.0,
  Wyckoff:      3.0,
  ElliottWave:  3.0,
  Harmonic:     2.0,
  Hybrid:       2.5,
};

// ─── Minimum confidence to execute ───────────────────────────
const MIN_CONFIDENCE_TO_EXECUTE = 40;
const MIN_CONFIDENCE_FULL_SIZE  = 70;

// ─── Core Risk Check ─────────────────────────────────────────
export function validateChartAnalysisTrade(
  result: ChartAnalysisResult,
  primitives: MarketPrimitives,
  btcContext?: BtcContext
): RiskCheckResult {
  const warnings: string[] = [];
  let adjustedConfidence = result.confidence;
  let adjustedSizeMultiplier = 1.0;
  let rejectionReason: string | undefined;

  // ── Rule 1: Minimum confidence ─────────────────────────────
  if (result.confidence < MIN_CONFIDENCE_TO_EXECUTE) {
    rejectionReason = `Confidence ${result.confidence} below minimum ${MIN_CONFIDENCE_TO_EXECUTE}`;
    return {
      approved: false,
      rejection_reason: rejectionReason,
      warnings,
      adjusted_confidence: adjustedConfidence,
      adjusted_size_multiplier: 0,
    };
  }

  // ── Rule 2: Minimum R:R by framework ──────────────────────
  const minRR = MIN_RR[result.primary_framework] || 2.0;
  if (result.risk_reward < minRR) {
    rejectionReason = `R:R ${result.risk_reward.toFixed(2)} below minimum ${minRR} for ${result.primary_framework}`;
    return {
      approved: false,
      rejection_reason: rejectionReason,
      warnings,
      adjusted_confidence: adjustedConfidence,
      adjusted_size_multiplier: 0,
    };
  }

  // ── Rule 3: Never enter into unmitigated opposing OB ──────
  const opposingOBs = primitives.smart_money.order_blocks.filter(ob => {
    if (result.bias === 'long'  && ob.type === 'bearish' && ob.status === 'unmitigated') return true;
    if (result.bias === 'short' && ob.type === 'bullish' && ob.status === 'unmitigated') return true;
    return false;
  });

  if (opposingOBs.length > 0) {
    const obPrices = opposingOBs.map(ob => `${ob.price_low}-${ob.price_high}`).join(', ');
    warnings.push(`Unmitigated opposing OBs overhead: ${obPrices} — watch for rejection`);
    adjustedConfidence = Math.max(adjustedConfidence - 10, 0);
    adjustedSizeMultiplier *= 0.75;
  }

  // ── Rule 4: HTF contradiction check ───────────────────────
  if (primitives.mtfa) {
   const rawHtfBias = primitives.mtfa['1D']?.bias;
  // normalize bullish/bearish → long/short
  const htfBias = rawHtfBias === 'bullish' ? 'long'
                : rawHtfBias === 'bearish' ? 'short'
                : rawHtfBias;
  const tradeBias = result.bias;
    if (htfBias && htfBias !== 'neutral' && tradeBias !== 'neutral' && htfBias !== tradeBias) {
      warnings.push(`HTF (1D) is ${htfBias} but trade is ${tradeBias} — counter-trend setup`);
      adjustedConfidence = Math.max(adjustedConfidence - 20, 0);
      adjustedSizeMultiplier *= 0.5;

      if (result.risk_reward < minRR + 1.0) {
        rejectionReason = `Counter-trend trade requires R:R > ${minRR + 1.0}, got ${result.risk_reward.toFixed(2)}`;
        return {
          approved: false,
          rejection_reason: rejectionReason,
          warnings,
          adjusted_confidence: adjustedConfidence,
          adjusted_size_multiplier: 0,
        };
      }
    }
  }

  // ── Rule 5: BTC context conflict ─────────────────────────
  if (btcContext && btcContext.bias !== 'neutral' && result.bias !== 'neutral') {
    const btcBiasAsDirection = btcContext.bias === 'long' ? 'long' : 'short';
    if (btcBiasAsDirection !== result.bias) {
      warnings.push(`BTC context is ${btcContext.bias} — this trade is counter-BTC direction`);
      adjustedConfidence = Math.max(adjustedConfidence - 15, 0);
      adjustedSizeMultiplier *= 0.75;
    }
  }

  // ── Rule 6: Wyckoff — never front-run Spring ──────────────
  if (primitives.wyckoff && primitives.wyckoff.phase === 'C' && !primitives.wyckoff.spring_confirmed) {
    if (result.bias === 'long') {
      rejectionReason = 'Wyckoff Phase C: Spring not confirmed — cannot enter long before Spring';
      return {
        approved: false,
        rejection_reason: rejectionReason,
        warnings,
        adjusted_confidence: adjustedConfidence,
        adjusted_size_multiplier: 0,
      };
    }
  }

  // ── Rule 7: Distribution with long signal ─────────────────
  if (primitives.wyckoff?.utad_risk && result.bias === 'long') {
    warnings.push('UTAD risk detected — distribution may be in progress, long setup is high risk');
    adjustedConfidence = Math.max(adjustedConfidence - 25, 0);
    adjustedSizeMultiplier *= 0.25;
  }

  // ── Rule 8: Neutral bias always rejected ─────────────────
  if (result.bias === 'neutral') {
    return {
      approved: false,
      rejection_reason: 'LLM returned neutral bias — no trade',
      warnings,
      adjusted_confidence: adjustedConfidence,
      adjusted_size_multiplier: 0,
    };
  }

  // ── Rule 9: Stop loss cannot be zero ─────────────────────
  if (!result.stop_loss || result.stop_loss === 0) {
    rejectionReason = 'Stop loss is zero — invalid trade parameters';
    return {
      approved: false,
      rejection_reason: rejectionReason,
      warnings,
      adjusted_confidence: adjustedConfidence,
      adjusted_size_multiplier: 0,
    };
  }

  // ── Rule 10: Size scaling by confidence ──────────────────
  if (adjustedConfidence < MIN_CONFIDENCE_FULL_SIZE) {
    const scaleFactor = adjustedConfidence / MIN_CONFIDENCE_FULL_SIZE;
    adjustedSizeMultiplier = Math.min(adjustedSizeMultiplier, Math.max(0.25, scaleFactor));
    warnings.push(`Reduced size to ${(adjustedSizeMultiplier * 100).toFixed(0)}% due to confidence ${adjustedConfidence}`);
  }

  // ── Rule 11: ChoCH vs BOS size scaling ───────────────────
  // BOS = confirmed structure break (full size), ChoCH = early signal (reduced size)
  if (primitives.smart_money.choch && !primitives.smart_money.bos) {
    warnings.push('ChoCH detected but no BOS confirmation — reduced size');
    adjustedSizeMultiplier = Math.min(adjustedSizeMultiplier, 0.5);
  }

  // ── Final check: re-confirm confidence after adjustments ──
  if (adjustedConfidence < MIN_CONFIDENCE_TO_EXECUTE) {
    rejectionReason = `Adjusted confidence ${adjustedConfidence} fell below minimum after risk adjustments`;
    return {
      approved: false,
      rejection_reason: rejectionReason,
      warnings,
      adjusted_confidence: adjustedConfidence,
      adjusted_size_multiplier: 0,
    };
  }

  return {
    approved: true,
    warnings,
    adjusted_confidence: adjustedConfidence,
    adjusted_size_multiplier: parseFloat(adjustedSizeMultiplier.toFixed(2)),
  };
}

// ─── Quick confidence-only check (for pre-filtering) ─────────
export function meetsMinimumThreshold(result: ChartAnalysisResult): boolean {
  return result.confidence >= MIN_CONFIDENCE_TO_EXECUTE
    && result.bias !== 'neutral'
    && result.risk_reward >= 1.5;
}



