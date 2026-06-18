import OpenAI from 'openai'
import { MEMORY_CONFIG } from './memory.config'

let _openai: OpenAI | null = null

function getClient(): OpenAI {
  if (_openai) return _openai
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('[MemoryEmbedder] OPENAI_API_KEY is not set. Configure it in .env.local.')
  }
  _openai = new OpenAI({ apiKey })
  return _openai
}

export async function embed(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: MEMORY_CONFIG.embeddingModel,
    input: text.slice(0, 8000),
  })
  return response.data[0].embedding
}
