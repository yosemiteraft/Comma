# Module spec — m-codex-shared-transport

**Derived from:** [dev-spec](../../dev-spec.md), [contract](../contracts/codex-shared-session.md). **Status:** not implemented.

Purpose: Comma client-side network transport to an operator-owned, already-running Codex App Server (Unix socket / WebSocket / secure WebSocket), replacing Codex-specific STDIO Runner wiring without changing AgentSession behavior.

Input: validated profile endpoint/auth, thread ID, cwd, model/effort, developer instructions and MCP config. Output: typed `RuntimeEvent`, RPC results and real Codex thread ID.

Required: initialize/notification handling; correlation and demultiplexing by request ID / thread; bounded reconnect and server identity check; authoritative turn status; disconnect without killing server; safe unknown-ack handling. Reject unavailable/nonconfigured endpoint. No silent STDIO fallback. P0: real multi-CLI write must be proven before claiming module is ready.
