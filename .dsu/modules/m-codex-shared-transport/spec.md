# Module spec — m-codex-shared-transport

**Derived from:** [dev-spec](../../dev-spec.md), [contract](../contracts/codex-shared-session.md). **Status:** source implementation exists; release acceptance pending.

Purpose: Comma client-side network transport to an operator-owned, already-running Codex App Server (Unix socket / WebSocket / secure WebSocket), replacing Codex-specific STDIO Runner wiring without changing AgentSession behavior.

Input: validated profile endpoint/auth, thread ID, cwd, model/effort, developer instructions and MCP config. Output: typed `RuntimeEvent`, RPC results and real Codex thread ID.

Required: initialize/notification handling; correlation and demultiplexing by request ID / thread; bounded reconnect and server identity check; authoritative turn status; disconnect without killing server; safe unknown-ack handling. Reject unavailable/nonconfigured endpoint. No silent STDIO fallback. P0: real multi-CLI write must be proven before claiming module is ready.


## Realization in development branch
systems/station/src/agents/codex-remote.ts implements remoteConfig, CodexRemoteHost (connect/ensureReady/request/readThread/addThread/removeThread/detach), websocket notifications and unknown-result protection; systems/station/src/agents/codex.ts uses this instead of Runner. No claim of passed multi-CLI interoperability.
