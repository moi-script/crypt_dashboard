/**
 * app.ts — PATCH (additions only)
 *
 * Add these imports and lines to the existing app.ts.
 * Existing code is unchanged — this is purely additive.
 */

// ── New imports to add ────────────────────────────────────────────────────────

// import agentRunRoutes          from './routes/agentRun.routes'
// import positionRoutes          from './routes/position.routes'
// import { opportunityRouter }   from './routes/position.routes'
// import { startScheduler }      from './agents/loop/scheduler'
// import { AgentRunDoc }         from './models/agentRun.model'
// import { PositionDoc, OrderDoc } from './models/position.model'
// import { OpportunityDoc }      from './models/opportunity.model'

// ── New rate-limited routes to add in app.use() block ────────────────────────

// app.use('/api/agent-runs',    apiLimiter)
// app.use('/api/positions',     apiLimiter)
// app.use('/api/opportunities', apiLimiter)

// ── New route mounts to add after existing app.use('/api', routes) ───────────

// app.use('/api/agent-runs',    agentRunRoutes)
// app.use('/api/positions',     positionRoutes)
// app.use('/api/opportunities', opportunityRouter)

// ── Scheduler start — add inside the start() function AFTER connectDB() ──────

// startScheduler()   // ← add this line; disabled by default via agentConfig.enabled = false

// ── Full updated start() function for reference ───────────────────────────────

/*
async function start() {
  await connectDB()
  await connectRedis()
  await connectSubscriber()
  startScheduler()   // ← new line
  server.listen(4000, () => console.log('API ready on :4000'))
}
*/
