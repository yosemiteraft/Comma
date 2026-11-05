# Preflight P0 risks and budget

**Status:** preliminary source-based review, no actual server/CLI experiments completed. These were explicitly identified *before* modifying runtime code.

| Risk | Severity | Evidence | Gate / stop |
|---|---|---|---|
| Native CLI may not expose remote TUI in installed version | P0 | upstream `codex-rs/cli/src/main.rs` has `--remote` | verify installed `codex --help` |
| Readable same Thread ≠ multiple CLI writable same Thread | P0 | remote flag alone proves no conflict semantics | 2 CLI + Comma real shared-thread writes |
| Cross-client concurrent `turn/start` can race | P0 | Comma currently only knows its own `CodexSession.busy()` | server-level one active-turn proof |
| Lost connection gives unknown accept state | P0 | old design relies on Runner stdout replay | read server truth before any retry |
| MCP unavailable or unauthorized for resumed remote thread | P0 | `mcp_servers.stillfail` configured per Thread, scoped HTTP token | confirm tool access and Session isolation |
| External server may have different CODEX_HOME/account/profile overrides | P1 | old `Host.start` sets process env and `-c` | identity, server/config validation |
| Station shutdown accidentally kills external server | P1 | old `CodexDriver.shutdown` kills owned Host | disconnect-only test |

**Engineering budget, uncertain:** G0 1–2 days; transport 3–6; multiwriter/recovery 4–9; MCP/security 2–4; regressions 3–5. Approx. 13–26 engineer-days with overlap and upstream variability; not a claim of actual elapsed time.

**No-go:** if two *official* CLI clients cannot both write the exact same server-owned Thread reliably, do not ship partial transport code as the requested feature.
