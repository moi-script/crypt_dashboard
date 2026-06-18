import OpenAI from 'openai'
import { MEMORY_CONFIG } from './memory.config'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (_client) return _client
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error('[MemoryEmbedder] DEEPSEEK_API_KEY is not set. Configure it in .env.local.')
  }
  _client = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey })
  return _client
}

export async function embed(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: MEMORY_CONFIG.embeddingModel,
    input: text.slice(0, 8000),
  })
  return response.data[0].embedding
}
