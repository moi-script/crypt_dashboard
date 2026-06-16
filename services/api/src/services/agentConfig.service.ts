import { AgentConfigDoc } from '../models/agentConfig.model'
import { DEFAULT_AGENT_CONFIG, type AgentConfig } from '../config/agent.config'

/** Get the user's agent config, seeding defaults on first access. */
export async function getOrCreateConfig(userId: string): Promise<AgentConfig & { userId: string }> {
  let doc = await AgentConfigDoc.findOne({ userId })
  if (!doc) {
    doc = await AgentConfigDoc.create({ userId, ...DEFAULT_AGENT_CONFIG })
  }
  return doc.toObject()
}

/**
 * Patch the user's config. Mode is locked to 'paper' in this phase, and the
 * manual-approval safety guard is preserved.
 */
export async function patchConfig(
  userId: string,
  patch: Partial<AgentConfig>,
): Promise<AgentConfig & { userId: string }> {
  await getOrCreateConfig(userId)  // ensure it exists

  const safePatch: Partial<AgentConfig> = { ...patch }
  // Phase 1: paper only — never allow graduating execution mode via the API.
  delete (safePatch as any).mode

  if (safePatch.requireManualApproval === false) {
    throw new Error('Cannot disable manual approval in paper phase')
  }

  const doc = await AgentConfigDoc.findOneAndUpdate(
    { userId },
    { $set: safePatch },
    { new: true },
  )
  return doc!.toObject()
}
