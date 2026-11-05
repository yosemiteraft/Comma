# Design — externally managed shared Codex App Server

**Status:** proposal, not implemented. See [functional spec](dev-spec.md).

```text
Official CLI A --remote ─┐
Official CLI B --remote ─┼────> Already running Codex App Server (one authority)
Comma CodexDriver ──────┘             │ one shared threadId, serialized turns
                                     └────HTTP MCP────> Comma Station /mcp
                                            bearer token bound to Comma Session
```

### Existing Comma design

`systems/station/src/agents/codex.ts:hostArgs` currently constructs `["app-server", ...,"--listen","stdio://"]`. `Host.start` uses `AgentProcess.start` via `stillfail-runner`; `Host.request` sends JSON-RPC to stdin and `Host.onLine` parses stdout. `takeUp`/ `Host.adopt` use Runner output replay. One Profile shares one app-server, each AgentSession has one Codex Thread. `CodexDriver.open` injects `developerInstructions`, sandbox and Station MCP URL/token.

### New boundaries

**Server:** operator-owned external process; **Comma:** a WebSocket/Unix JSON-RPC client and owner of its task state; **CLI:** separately authenticated clients with access to same server/thread. Keep a one-to-one Comma Session ↔ Codex Thread mapping and preserve original `AgentSession` APIs.

Replace Codex-only Host transport with connection/reconnect and JSON-RPC correlation. Do **not** change shared `AgentProcess` or the Claude Driver. Build a connection wrapper with `initialize`, notifications by threadId, and server-state reconciliation; no fallback spawn. Authenticated socket permission, TLS where remote, token redaction.

### P0: concurrency is server-owned

`openai/codex/codex-rs/cli/src/main.rs` has `--remote ADDR` for `ws://`, `wss://`, `unix://` and `--remote-auth-token-env`. This proves a CLI entry point, **not** shared-thread multiwriter correctness. Simultaneous Turn decisions must be server-authoritative; Comma-only locks cannot coordinate CLIs. Verify real G0/G2 first. If unsupported, stop, assess compatible gateway or upstream patch rather than simulating success.

### Recovery and MCP

Current Runner replay cannot simply be reused for network transport. On uncertain `turn/start` acceptance after disconnect, mark unknown and reconcile with `thread/read` / official server status before retry. Reattach to notifications, don't invent missed events. Preserve `mcp_servers.stillfail`, its HTTP Bearer and session tool allowlist. Already-loaded threads can retain stale MCP connections; detect and fail/reload safely, without losing Session identity.

### Planned code touch points (NOT CHANGED)

`systems/station/src/agents/codex.ts`; new Codex-specific transport source; `src/agents/profiles.ts`; `src/sessions/agents.ts`; `test/codex.test.ts`; `test/fake/codex.mjs`. Keep `src/agents/runtime.ts` and `src/tools/mcp.ts` contract unchanged if possible. See [module implementation plan](modules/m-codex-shared-transport/impl.md).
