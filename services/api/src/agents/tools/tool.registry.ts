/**
 * tool.registry.ts
 *
 * Maintains the master list of tools sent to the LLM and dispatches
 * the tool calls the model returns back to the correct handlers.
 *
 * Usage:
 *   const schemas = getToolSchemas()        // send to LLM
 *   const result  = await dispatch(call, ctx) // handle model's tool call
 */

import type { ToolCall, ToolResult, ToolContext, RegisteredTool, ToolDef } from './tool.types'
import { READ_TOOLS } from './read.tools'
import { ACT_TOOLS  } from './act.tools'

// ── Registry map ──────────────────────────────────────────────────────────────

const registry = new Map<string, RegisteredTool>()

for (const tool of [...READ_TOOLS, ...ACT_TOOLS]) {
  registry.set(tool.def.name, tool)
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the tool schema array to include in the LLM request */
export function getToolSchemas(): ToolDef[] {
  return Array.from(registry.values()).map(t => t.def)
}

/** Returns schemas for only read or act tools */
export function getToolSchemasByCategory(category: 'read' | 'act'): ToolDef[] {
  return Array.from(registry.values())
    .filter(t => t.category === category)
    .map(t => t.def)
}

/** Returns true if the named tool is an act (intent-producing) tool */
export function isActTool(name: string): boolean {
  return registry.get(name)?.category === 'act'
}

/** Returns true if the named tool is a read tool */
export function isReadTool(name: string): boolean {
  return registry.get(name)?.category === 'read'
}

/**
 * Dispatch a tool call from the LLM to the correct handler.
 * Always returns a ToolResult — never throws (errors are captured in isError).
 */
export async function dispatch(
  call: ToolCall,
  ctx:  ToolContext,
): Promise<ToolResult> {
  const start = Date.now()
  const tool  = registry.get(call.name)

  if (!tool) {
    return {
      toolCallId:   call.id,
      toolName:     call.name,
      output:       null,
      isError:      true,
      errorMessage: `Unknown tool: "${call.name}". Available: ${[...registry.keys()].join(', ')}`,
      durationMs:   Date.now() - start,
    }
  }

  try {
    const output = await tool.handler(call.arguments, ctx)
    return {
      toolCallId: call.id,
      toolName:   call.name,
      output,
      isError:    false,
      durationMs: Date.now() - start,
    }
  } catch (err: any) {
    return {
      toolCallId:   call.id,
      toolName:     call.name,
      output:       null,
      isError:      true,
      errorMessage: err.message ?? String(err),
      durationMs:   Date.now() - start,
    }
  }
}

/** List all registered tool names */
export function listTools(): { name: string; category: 'read' | 'act'; description: string }[] {
  return Array.from(registry.values()).map(t => ({
    name:        t.def.name,
    category:    t.category,
    description: t.def.description.split('\n')[0].slice(0, 80),
  }))
}
