// ============================================================
// orderBlock.model.ts
// Mongoose model for Order Blocks
// ✅ COMPLETE — do NOT regenerate
// ============================================================

import { model, Model, Document } from 'mongoose';
import { OrderBlockSchema } from './schemes/orderBlock.schema';
import { OrderBlock } from '../agents/chartAnalysis.types';

export interface IOrderBlockDocument extends OrderBlock, Document {
  symbol: string;
  mitigated_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderBlockModel: Model<IOrderBlockDocument> =
  (global as any).OrderBlockModel ||
  model<IOrderBlockDocument>('OrderBlock', OrderBlockSchema);

// Prevent model recompilation during hot reload
if (!(global as any).OrderBlockModel) {
  (global as any).OrderBlockModel = OrderBlockModel;
}

export default OrderBlockModel;