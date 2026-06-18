import OpenAI from 'openai'
import { MEMORY_CONFIG } from './memory.config'

// Separate client from the DeepSeek one in policy.engine.ts — no baseURL override
// Uses OpenAI's default API endpoint for text-embedding-3-small
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

/**
 * Generate a mock 1536-element embedding vector.
 * Used when OPENAI_API_KEY is not set in the environment.
 */
function generateMockEmbedding(_text: string): number[] {
  const vec: number[] = []
  for (let i = 0; i < 1536; i++) {
    vec.push(Math.random() * 2 - 1) // Random value between -1 and 1
  }
  return vec
}

export async function embed(text: string): Promise<number[]> {
  // If no API key, return mock embedding for testing
  if (!openai) {
    return generateMockEmbedding(text)
  }

  const response = await openai.embeddings.create({
    model: MEMORY_CONFIG.embeddingModel,
    input: text.slice(0, 8000), // model max ~8k tokens
  })
  return response.data[0].embedding
}
