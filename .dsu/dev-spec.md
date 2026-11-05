# Development specification — t-share-codex

**Status:** specification ready; implementation and real multi-client tests NOT DONE. **Baseline:** `yosemiteraft/Comma` main @ `66ab3dc92475005aea9afd123df36a28e4ef86ab`. **Date:** 2026-11-04.

## Goal

Comma Station shall **connect to an already-running external Codex App Server**, not start an owned `codex app-server --listen stdio://`. Multiple official `codex --remote` CLI processes and Comma shall connect to the **same server** and open the **same Codex thread ID** (Comma's Codex Session), see the same history and be able to append successive turns. Shared read-only access is insufficient. Other external CLI writes must be visible to Comma.

## Functional requirements

F1. Explicit per-profile non-STDIO endpoint configuration (Unix socket preferred on same host; WS/WSS where appropriate), optional bearer authentication; Comma connects and does not spawn/restart/kill the user-owned server. No silent STDIO fallback.

F2. Preserve existing `AgentDriver` and `AgentSession` interface: `open/adopt/shutdown/detach`, `id/busy/prompt/steer/abort/dispose/snapshot`, typed `RuntimeEvent` and `TurnOutcome`. Preserve `initialize`/`initialized`, `thread/start`/`thread/resume`, `turn/start`/`turn/steer`/`turn/interrupt`, model/effort, notifications, session cache, thread ID persistence.

F3. CLI A and CLI B connect to the external endpoint, resume **identical** `thread.id`, independently read full history and each add at least one visible, persistent turn; Comma also writes after their turns. A third CLI must see the combined history. A fresh app-server process per CLI does not count.

F4. One authoritative active Turn per thread. Under simultaneous write requests from Comma and two CLIs, no silent loss/duplicate, no overlapping turns, and deterministic queue/reject/steer semantics. The Codex server or a shared gateway, not a Comma-local lock alone, must arbitrate. Confirm `expectedTurnId` for steering. Unknown RPC acceptance on lost connection must be reconciled; NEVER blind retry.

F5. Maintain `developerInstructions`, models, profile configuration and the **existing Station HTTP MCP** integration: `mcp_servers.stillfail.url` plus per-session Authorization bearer. `McpEndpoint` tools/list and tools/call permissions must still enforce Session scoping. Thread resumed from external server must have working MCP; distinguish loaded-thread config from desired config.

F6. Preserve profile credentials/account/CODEX_HOME isolation: an already-running server has its own process environment, so validate endpoint-profile affinity and refuse mismatches. Never log/store secrets in the repository or expose unauthenticated remote control.

F7. Comma Station restart must reconnect without terminating the external server. Restore Comma Session ↔ Codex Thread mapping, reconcile a running/ended Turn and event stream (use documented authoritative server APIs); fail closed on uncertain state; disconnect only on shutdown.

F8. No change to Comma Router, Task/Worker semantics, Claude Runner, GitHub Actions configurations, or unapproved releases.

## Mandatory acceptance tests

**G0 (P0; must precede coding claims):** with an installed compatible Codex, prove `codex --remote` can attach to the configured server and that 2 CLI processes can write successive turns to the same Thread, which Comma sees. Verify multi-client subscription behavior and exact installed-version command syntax.

**G1:** shared Tool/MCP: allowed tools callable and unauthorized Session tokens refused.

**G2:** race 3 writers, assert one running turn and no duplicates; inspect rejection/queue behavior.

**G3:** reconnect Station during an active turn; resumed history agrees, no double execution and external server survives.

**G4:** local TypeScript check + rewritten fake WebSocket/Unix integration tests + real Codex E2E, preserve previous Driver events.

**G5:** endpoint permissions, auth, credential redaction, and full non-STDIO process ownership tested.

**Stop condition:** If installed Codex does not support simultaneous multi-client attachment to one Thread with safe write semantics, mark P0 BLOCKED and evaluate a gateway/upstream change; don't claim feature delivered.

## Source / documents

[Architecture](dev-design.md) · [Decision ledger](decisions.md) · [Risk review](topics/shared-codex-risk-review.md) · [Ticket state](tickets/t-share-codex/state.md) · [Cross-module contract](modules/contracts/codex-shared-session.md). Existing source: `systems/station/src/agents/codex.ts`, `runtime.ts`, `profiles.ts`, `sessions/agents.ts`, `tools/mcp.ts`. 
