import { Schema, model } from 'mongoose'

export interface IArticle {
  title:       string
  url:         string
  source:      string
  publishedAt: Date
  summary?:    string
  sentiment?:  number
  coins:       string[]
  imageUrl?:   string
  expiresAt:   Date
}

const ArticleSchema = new Schema<IArticle>({
  title:       { type: String, required: true },
  url:         { type: String, required: true, unique: true },
  source:      { type: String, required: true },
  publishedAt: { type: Date,   required: true },
  summary:     String,
  sentiment:   { type: Number, min: -1, max: 1, default: 0 },
  coins:       [{ type: String }],
  imageUrl:    String,
  expiresAt:   { type: Date,   required: true }, // ← no index: true here
}, { timestamps: true })

ArticleSchema.index({ publishedAt: -1 })
ArticleSchema.index({ coins: 1, publishedAt: -1 })

// TTL index — MongoDB deletes the document when expiresAt is reached
ArticleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const ArticleDoc = model<IArticle>('Article', ArticleSchema)