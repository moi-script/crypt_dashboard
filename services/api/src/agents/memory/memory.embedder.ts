import { MEMORY_CONFIG } from './memory.config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipeline: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPipeline(): Promise<any> {
  if (_pipeline) return _pipeline
  const { pipeline } = await import('@huggingface/transformers')
  _pipeline = await pipeline('feature-extraction', MEMORY_CONFIG.embeddingModel, { device: 'cpu' })
  return _pipeline
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getPipeline()
  const output = await extractor(text.slice(0, 8000), { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}
