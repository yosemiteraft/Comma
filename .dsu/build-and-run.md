# Build and run — t-share-codex

**Status:** test plan only; no endpoint, installed CLI version, credentials, or target-machine service available to run live tests here.

### Real feasibility test G0 — before implementation
1. Start or identify an *already-running* Codex App Server listening on authenticated `unix://`, `ws://`, or `wss://`. Record installed `codex --version` (do not record auth tokens).
2. Check native `codex --help`, `codex resume --help`, then use supported `codex --remote <endpoint> resume <thread-id>` syntax. CLI A and CLI B must attach to one server and the same thread. Verify actual syntax on installed build.
3. CLI A writes Turn A, CLI B sees and writes Turn B, Comma sees both and writes Turn C. Check every client shows A/B/C.
4. Race CLI A, CLI B, Comma while busy: check authoritative active Turn and deterministic errors/queue; do not blindly retry.
5. Kill/disconnect Station only, verify CLI remains attached; reconnect Station and reconcile thread/turn state.

### Planned local verification after coding
- Inspect `systems/station/package.json`, `systems/station/README.md`, `systems/AGENTS.md`. Run applicable `pnpm --dir systems/station check` and targeted `node --test` through existing local native test harness; **never invoke GitHub Actions**.
- Replace STDIO fake with remote fake; test handshake, RPC correlation, auth, timeout, error, multi-client, restart and permissions.
- Test MCP via actual `tools/list`/`tools/call` + per-Session bearer.
- Capture exact commands and observed results in `tickets/t-share-codex/state.md`.

**No production deployment or merge** until all G0–G5 acceptance gates have passing evidence and any GitHub Actions effects are separately authorized.


## Current implementation configuration (not run here)
Operator starts Codex separately, for example: codex app-server --listen unix:///absolute/path/to/codex.sock
Comma Station environment: STILLFAIL_CODEX_REMOTE_ENDPOINT=unix:///absolute/path/to/codex.sock
Each native CLI uses same endpoint and exact Comma-created thread: codex --remote unix:///absolute/path/to/codex.sock resume THREAD_ID (verify installed version's help).
Alternative loopback server: codex app-server --listen ws://127.0.0.1:4600 ; set STILLFAIL_CODEX_REMOTE_ENDPOINT=ws://127.0.0.1:4600. Optional auth for WS/WSS: STILLFAIL_CODEX_REMOTE_AUTH_TOKEN_ENV names another environment variable containing bearer token. Do not commit token values.
Testing pending: pnpm --dir systems/station check; package.json Station local test suite; official Codex app-server with CLI A, CLI B and Comma sharing one thread; MCP authorized/unauthorized tests; simultaneous writers; reconnect mid-turn. No commands requiring GitHub Actions.
