# t-share-codex — state and handoff

**Date:** 2026-11-04. **Branch:** `ticket/t-share-codex` on `yosemiteraft/Comma`, based on `66ab3dc92475005aea9afd123df36a28e4ef86ab`. **Status: DOCS CREATED; CODE NOT IMPLEMENTED; P0 UNVERIFIED. PR: none.**

## Done
- Copied user's `structure(1).md` into root `structure.md`.
- Inspected `CodexDriver` currently spawning `codex app-server --listen stdio://` via `AgentProcess`/Runner; one Profile server, one Thread per AgentSession. Existing `CodexDriver.open` passes `developerInstructions`, `mcp_servers.stillfail.url`, Session bearer.
- Verified upstream source has CLI `--remote` for unix/ws/wss and bearer token environment flag, **NOT yet actual multi-CLI write behavior**.
- Created `.dsu/index.md`, dev-spec, dev-design, decisions, build-and-run, risk review, module contract, module spec/impl, sequence/pseudocode, Ticket and this handoff. Cross-references aligned for `update-doc`.

## Blocked / not done
- Real external server endpoint, installed CLI version, auth and actual target environment unavailable in this session. Real same-Thread write, race, server-status reconciliation, MCP access all untested.
- No Codex runtime changes, no TS build or test, no PR, no GitHub Actions, no merge or deploy.
- Active writer arbitration is server-owned; Comma-only lock cannot coordinate other CLIs.

## Next worker actions
1. Read root `structure.md`, `.dsu/index.md`, [dev-spec](../../dev-spec.md), [risk review](../../topics/shared-codex-risk-review.md) and [design](../../dev-design.md). Then batch-read `systems/station/src/agents/{codex,runtime,profiles}.ts`, `systems/station/src/sessions/agents.ts`, `systems/station/src/tools/mcp.ts`, `systems/station/test/codex.test.ts` and fake.
2. Run G0 on a real server: two official Codex CLI clients attach and **both write the exact same Thread**, verify Comma sees their writes; test turn races. If fails, stop and document blocker.
3. If G0 passes, implement external endpoint and Codex-only remote Host; no STDIO spawn/no server termination, retain MCP and AgentSession contracts.
4. Test reconnect/unknown acceptance, permissions, profile affinity, typecheck, local and real integration; update all `.dsu` docs and this state; do not trigger or change GitHub Actions.

## Worker tracking
Do not invent an unavailable real Worker Session ID; create `.dsu/workers/w-*/w-*-id-*.md` when actual Session ID is known.
