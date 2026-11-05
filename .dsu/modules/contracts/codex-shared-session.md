# Cross-module contract: Comma ↔ external Codex

**Existing Comma contracts:** `AgentDriver` (`runtime/open/adopt/shutdown/detach`) and `AgentSession` (`id/busy/prompt/steer/backgroundTools/abort/dispose/snapshot/detach`) in `systems/station/src/agents/runtime.ts`. Preserve exactly unless contract review justifies a change.

**Proposed new config (not implemented):**
```ts
type CodexRemoteEndpoint = {
  address: string; // unix:///path, ws://127.0.0.1:port, or wss://host:port
  authTokenEnv?: string; // environment-variable name, not literal secret
  ownership: "external";
};
```
Profile field names require validation against real `profiles.ts` before implementation.

**Remote control (official Codex APIs, version pin needed):** `initialize`, `initialized`, `thread/start`, `thread/resume`, `turn/start`, `turn/steer` with `expectedTurnId`, `turn/interrupt`, `thread/read`, `mcpServerStatus/list`. Server events: `turn/started`, `turn/completed`, `item/*`. Track RPC IDs, Thread ID, Turn ID, and delivery confirmation separately.

**MCP:** keep current HTTP `McpEndpoint.handle()` authorization, `tools/list`/`tools/call` with `mcp_servers.stillfail.url` and Session bearer token; do not map Session token to another user's CLI identity.

**Invariants:** one external endpoint/profile; one Codex Thread ID per Comma AgentSession; one authoritative active Turn/thread; no silent duplicate write on timeout; external server survives Station shutdown; CLI A/B read and append to same ID; no GitHub Actions.


## Implemented contract (unverified runtime)
CodexRemoteHost.request maps JSON-RPC ids to responses and dispatches thread notifications. CodexRemoteHost.readThread and reconnection use official thread/read and thread/resume; CodexDriver.attach preserves per-thread developerInstructions and Station HTTP MCP url/token. CodexSession implements the existing AgentSession interface and rejects busy/unknown writes. User starts external server. No GitHub Actions and no fallback to STDIO.
