import { MEMORY_CONFIG } from './memory.config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipeline: any = null
let _pipelineFailed = false

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPipeline(): Promise<any> {
  if (_pipeline) return _pipeline
  if (_pipelineFailed) throw new Error('Embedding model unavailable (previous load failed)')
  const { pipeline } = await import('@huggingface/transformers')
  _pipeline = await pipeline('feature-extraction', MEMORY_CONFIG.embeddingModel, { device: 'cpu' })
  return _pipeline
}

const EMBED_TIMEOUT_MS = 10_000

export async function embed(text: string): Promise<number[]> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Embedding timed out')), EMBED_TIMEOUT_MS),
  )
  try {
    const extractor = await Promise.race([getPipeline(), timeout])
    const output = await Promise.race([
      extractor(text.slice(0, 8000), { pooling: 'mean', normalize: true }),
      timeout,
    ])
    return Array.from(output.data as Float32Array)
  } catch (err) {
    _pipelineFailed = true
    _pipeline = null
    throw err
  }
}
