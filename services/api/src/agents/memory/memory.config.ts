export const MEMORY_CONFIG = {
  embeddingModel:      process.env.EMBEDDING_MODEL      ?? 'deepseek-embedding',
  topK:                Number(process.env.MEMORY_TOP_K)  || 5,
  similarityThreshold: Number(process.env.MEMORY_THRESHOLD) || 0.70,
  vectorIndexName:     process.env.VECTOR_INDEX_NAME     ?? 'agentMemory_vector_index',
  reflectionSchedule:  process.env.REFLECTION_SCHEDULE   ?? 'daily',
} as const
