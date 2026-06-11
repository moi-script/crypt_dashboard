// ============================================================
// chartAnalysis.model.ts
// Mongoose model for persisted ChartAnalysisResult per symbol
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { model, Model, Document } from 'mongoose';
import { ChartAnalysisSchema } from './schemes/chartAnalysis.schema';
import { ChartAnalysisResult } from '../agents/chartAnalysis.types';

export interface IChartAnalysisDocument extends Omit<ChartAnalysisResult, 'framework_scores'>, Document {
  symbol: string;
  framework_scores: Map<string, number>;
  risk_approved: boolean | null;
  adjusted_confidence: number | null;
  adjusted_size_mult: number | null;
  risk_warnings: string[];
  risk_rejection: string | null;
  analyzed_at: Date;
  timeframes_used: string[];
  btc_bias_at_time: 'long' | 'short' | 'neutral' | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChartAnalysisModel: Model<IChartAnalysisDocument> =
  (global as any).ChartAnalysisModel ||
  model<IChartAnalysisDocument>('ChartAnalysis', ChartAnalysisSchema);

if (!(global as any).ChartAnalysisModel) {
  (global as any).ChartAnalysisModel = ChartAnalysisModel;
}

export default ChartAnalysisModel;