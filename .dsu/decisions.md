# Design decisions for t-share-codex

**D-001 Chosen:** use a *pre-existing*, externally started Codex App Server with explicitly configured Unix/WS/WSS endpoint. Comma never owns the process. **Rejected:** simply change `stdio://` to `ws://` but still spawn a private server; that doesn't prove CLI sharing.

**D-002 Chosen:** official `codex --remote` CLIs connect directly to the exact same server and resume the exact same `thread.id`. Same `CODEX_HOME` on separate servers is not equivalent.

**D-003 Chosen:** keep Station's HTTP MCP (`mcp_servers.stillfail`), per-session Bearer authorization and original `developerInstructions`. **Rejected:** replacing tools with prompt-only rules or WebSocket dynamicTools callbacks.

**D-004 Pending G0 proof:** share one thread across multiple writable official CLIs. Multiwriter conflicts require server-level turn serialization. If actual CLI/server cannot do this, stop and compare gateway vs upstream change.

**D-005 Chosen:** do not modify GitHub Actions, unrelated docs outside `.dsu`, deploy, or merge as part of this draft. Update `.dsu/index.md` and Ticket `state.md` together per `structure.md`.
