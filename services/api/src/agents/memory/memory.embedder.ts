import OpenAI from 'openai'
import { MEMORY_CONFIG } from './memory.config'

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  throw new Error('[MemoryEmbedder] OPENAI_API_KEY is not set. Configure it in .env.local.')
}

const openai = new OpenAI({ apiKey })

export async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: MEMORY_CONFIG.embeddingModel,
    input: text.slice(0, 8000),
  })
  return response.data[0].embedding
}
