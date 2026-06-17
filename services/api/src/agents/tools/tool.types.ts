/**
 * tool.types.ts
 *
 * Type definitions for the LLM function-calling layer.
 * Compatible with both the OpenAI function-call format (DeepSeek)
 * and Anthropic's tool_use block format.
 */

// ── OpenAI-compatible tool schema ─────────────────────────────────────────────

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  enum?: string[]
  items?: { type: string }
  properties?: Record<string, ToolParameter>
  required?: string[]
}

export interface ToolDef {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameter>
    required?: string[]
  }
}

// ── Tool call from LLM ────────────────────────────────────────────────────────

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>  // parsed JSON from model
}

export interface ToolResult {
  toolCallId: string
  toolName: string
  output: unknown        // JSON-serializable
  isError: boolean
  errorMessage?: string
  durationMs: number
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<unknown>

export interface ToolContext {
  sessionId?: string
  userId?: string         // owning account — scopes wallet/position reads
  coinId?: string
  strategy?: string
  dryRun?: boolean        // if true, read tools skip external calls and return mocked data
}

export interface RegisteredTool {
  def: ToolDef
  handler: ToolHandler
  category: 'read' | 'act'  // act tools only emit intents, never execute
}
