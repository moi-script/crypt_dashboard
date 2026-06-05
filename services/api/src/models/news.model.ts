import { Schema, model } from 'mongoose'

export interface IArticle {
  title:       string
  url:         string
  source:      string
  publishedAt: Date
  summary?:    string
  sentiment?:  number   // -1 to 1
  coins:       string[] // coinIds mentioned
  imageUrl?:   string
}

const ArticleSchema = new Schema<IArticle>({
  title:       { type: String, required: true },
  url:         { type: String, required: true, unique: true },
  source:      { type: String, required: true },
  publishedAt: { type: Date,   required: true, index: true },
  summary:     String,
  sentiment:   { type: Number, min: -1, max: 1 },
  coins:       [{ type: String, index: true }],
  imageUrl:    String,
}, { timestamps: true })

ArticleSchema.index({ publishedAt: -1 })
ArticleSchema.index({ coins: 1, publishedAt: -1 })

export const ArticleDoc = model<IArticle>('Article', ArticleSchema)