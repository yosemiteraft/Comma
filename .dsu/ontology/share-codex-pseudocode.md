# API pseudocode with sequence/snapshots

**Verified** means API name is in inspected source, NOT that target runtime behavior is tested.

| Step | File | Function | Call | Input | Output & snapshot | Evidence |
|---|---|---|---|---|---|---|
| T10 | external Codex | CLI `app-server` | `--listen <unix/ws>` | endpoint | server externally running | upstream Codex CLI |
| T20 | Comma `src/agents/codex.ts` | existing `CodexDriver.open` | `thread/start` or `thread/resume` | `OpenOptions` | S1: CommaSession → real threadId | inspected Comma source |
| T30 | planned transport | **PROPOSED** `RemoteHost.connect` | `initialize`, `initialized` | endpoint/auth | connected RPC client | not implemented |
| T40 | Comma `CodexSession.prompt` | existing function | `turn/start` | threadId/input | turn ID or unknown | inspected Comma source |
| T50 | Comma `CodexSession.steer` | existing function | `turn/steer` | expectedTurnId | accepted/refused | inspected Comma source |
| T60 | Station `tools/mcp.ts` | existing `McpEndpoint.handle` | HTTP `tools/list`, `tools/call` | Session bearer | scoped tool result | inspected Comma source |
| T70 | external CLI | `codex --remote` (verified flag) | resume same Thread | endpoint + threadId | shared history; write G0 unverified | upstream CLI main.rs |
| T80 | Codex server | `thread/read` | reconcile | threadId | S3: authoritative turn state | pinned protocol verification needed |

```text
operator starts external Codex Server
Comma: connectEndpoint(profile) [PROPOSED, not existing]
  rpc(initialize); rpc(thread/start or thread/resume)
  save exact thread.id
CodexSession.prompt(text): rpc(turn/start, threadId, input)
  if connection lost before ack: set UNCERTAIN; reconcile server; no blind replay
CLI A and B: codex --remote <same endpoint> resume <same thread.id>
  append next turn after server accepts it
```

**Snapshots:** S0 before connect: endpoint configured, no Comma process ownership. S1 after start: immutable threadId shared. S2 after each turn: accepted turnId/status. S3 after reconnect: server and local statuses reconciled. Real test pending.


## As-built functions and authoritative APIs
T100: codex-remote.ts remoteConfig(profile, env) -> validates Unix/WS/WSS endpoint, optional bearer env; output RemoteConfig.
T110: codex-remote.ts CodexRemoteHost.connect() -> WebSocket handshake -> initialize, initialized; output connection and RPC mapping.
T120: codex.ts CodexDriver.attach() -> thread/start or thread/resume with developerInstructions, config.mcp_servers.stillfail.*; output thread.id.
T130: codex.ts CodexSession.prompt() -> thread/read, turn/start(threadId,input); output turn.id or UnknownRemoteResult; concurrent control ultimately server-owned.
T140: codex-remote.ts received() -> thread notification sink; codex.ts CodexSession.sink() -> RuntimeEvent.
T150: codex-remote.ts connect() after loss -> thread/resume + thread/read(includeTurns:true) -> reconcile; no unverified attribution.
T160: codex.ts CodexDriver.adopt() -> server thread/read, deferred setImmediate(turnEnded) for verified completed turn; SessionActor state attached first.
T170: codex.ts shutdown/detach -> CodexRemoteHost.detach -> close Comma socket only; server still alive. G0 native CLI results are not available.
