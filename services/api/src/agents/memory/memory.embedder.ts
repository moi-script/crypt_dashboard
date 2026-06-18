import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { MEMORY_CONFIG } from './memory.config'

let _pipeline: FeatureExtractionPipeline | null = null

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (_pipeline) return _pipeline
  _pipeline = await pipeline('feature-extraction', MEMORY_CONFIG.embeddingModel, { device: 'cpu' })
  return _pipeline
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getPipeline()
  const output = await extractor(text.slice(0, 8000), { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}
