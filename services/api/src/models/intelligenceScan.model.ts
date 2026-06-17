// ============================================================
// intelligenceScan.model.ts
// Mongoose model for persisted IntelligenceScan snapshots.
// ============================================================

import { model, Model, Document } from 'mongoose';
import { IntelligenceScanSchema } from './schemes/intelligenceScan.schema';
import {
  BtcContext,
  CoinIntelligenceCard,
  DominanceData,
} from '../agents/chartAnalysis.types';

export interface IIntelligenceScanDocument extends Document {
  scan_id: string;
  generated_at: Date;
  market_phase: string;
  total_analyzed: number;
  windows_open: number;
  coin_count: number;
  btc_regime: string | null;
  btc_bias: 'long' | 'short' | 'neutral' | null;
  btc_context: BtcContext | null;
  dominance: DominanceData | null;
  coins: CoinIntelligenceCard[];
  top_opportunities: CoinIntelligenceCard[];
  createdAt: Date;
  updatedAt: Date;
}

const IntelligenceScanModel: Model<IIntelligenceScanDocument> =
  (global as any).IntelligenceScanModel ||
  model<IIntelligenceScanDocument>('IntelligenceScan', IntelligenceScanSchema);

// Prevent model recompilation during hot reload
if (!(global as any).IntelligenceScanModel) {
  (global as any).IntelligenceScanModel = IntelligenceScanModel;
}

export default IntelligenceScanModel;
