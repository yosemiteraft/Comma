# t-share-codex — state and handoff

**Date:** 2026-11-04. **Branch:** `ticket/t-share-codex` on `yosemiteraft/Comma`, based on `66ab3dc92475005aea9afd123df36a28e4ef86ab`. **Status: CODE COMMITTED, NOT ACCEPTED. P0 G0 native CLI multiwriter still unverified. Draft PR #1 opened: https://github.com/yosemiteraft/Comma/pull/1; do not merge.**

## Done
- Copied user's `structure(1).md` into root `structure.md`.
- Inspected `CodexDriver` currently spawning `codex app-server --listen stdio://` via `AgentProcess`/Runner; one Profile server, one Thread per AgentSession. Existing `CodexDriver.open` passes `developerInstructions`, `mcp_servers.stillfail.url`, Session bearer.
- Verified upstream source has CLI `--remote` for unix/ws/wss and bearer token environment flag, **NOT yet actual multi-CLI write behavior**.
- Created `.dsu/index.md`, dev-spec, dev-design, decisions, build-and-run, risk review, module contract, module spec/impl, sequence/pseudocode, Ticket and this handoff. Cross-references aligned for `update-doc`.

## Blocked / not done
- Real external server endpoint, installed CLI version, auth and actual target environment unavailable in this session. Real same-Thread write, race, server-status reconciliation, MCP access all untested.
- Codex runtime and mock tests committed; TS build, local tests, real CLI end-to-end tests NOT RUN because no accessible checkout/dependencies or running Codex App Server in this environment. No GitHub Actions, merge, or deployment.
- Active writer arbitration is server-owned; Comma-only lock cannot coordinate other CLIs.

## Next worker actions
1. Read root `structure.md`, `.dsu/index.md`, [dev-spec](../../dev-spec.md), [risk review](../../topics/shared-codex-risk-review.md) and [design](../../dev-design.md). Then batch-read `systems/station/src/agents/{codex,runtime,profiles}.ts`, `systems/station/src/sessions/agents.ts`, `systems/station/src/tools/mcp.ts`, `systems/station/test/codex.test.ts` and fake.
2. Run G0 on a real server: two official Codex CLI clients attach and **both write the exact same Thread**, verify Comma sees their writes; test turn races. If fails, stop and document blocker.
3. If G0 passes, implement external endpoint and Codex-only remote Host; no STDIO spawn/no server termination, retain MCP and AgentSession contracts.
4. Test reconnect/unknown acceptance, permissions, profile affinity, typecheck, local and real integration; update all `.dsu` docs and this state; do not trigger or change GitHub Actions.

## Worker tracking
Do not invent an unavailable real Worker Session ID; create `.dsu/workers/w-*/w-*-id-*.md` when actual Session ID is known.


## Updated source/handoff — 2026-11-04
DONE: committed Codex external WebSocket/Unix transport (systems/station/src/agents/codex-remote.ts), refactored Driver (systems/station/src/agents/codex.ts), and remote fake tests (systems/station/test/codex.test.ts). Built-in Station MCP developerInstructions and per-session URL/token preserved. Unknown results fail closed. All .dsu spec, design, implementation, ontology, risk, index updated together.
NOT DONE: no project checkout/dependencies in this container; no TypeScript compiler run against project or tests run, no installed Codex CLI or externally running app-server for real same-thread multi-CLI read/write; no native G0/G1/G2/G3/G5 proof. Keep Ticket OPEN; don't merge or deploy.
NEXT: run pnpm --dir systems/station check and local tests, fix failures; run official Codex CLI A/B and Comma against one server/thread, verify two writes, server concurrency, MCP allow/deny and restart recovery; record outputs and close only after G0–G5. No GitHub Actions without explicit renewed authorization.

## Pull request
Draft PR #1: https://github.com/yosemiteraft/Comma/pull/1
Open for code review and real acceptance work; merge is blocked by G0–G5 and no local test evidence. No GitHub Actions were invoked or changed. Branch: ticket/t-share-codex.
