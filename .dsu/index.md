# Unified .dsu development index

**Start here:** [Ticket t-share-codex](tickets/t-share-codex/t-share-codex.md) → [current state/handoff](tickets/t-share-codex/state.md). **Status:** specs created, code and G0 real tests pending. Root [structure.md](../structure.md) governs this directory; root [AGENTS.md](../AGENTS.md) retains baseline rules. This is the *only* index in .dsu.

| What you need | File |
|---|---|
| Global new feature requirements + acceptance G0–G5 | [dev-spec.md](dev-spec.md) |
| Architecture, RPC vs MCP, remote server ownership | [dev-design.md](dev-design.md) |
| Chosen/rejected options | [decisions.md](decisions.md) |
| Verify locally without Actions | [build-and-run.md](build-and-run.md) |
| P0 technical risks, budget and no-go conditions | [topics/shared-codex-risk-review.md](topics/shared-codex-risk-review.md) |
| Shared Thread API and module contract | [modules/contracts/codex-shared-session.md](modules/contracts/codex-shared-session.md) |
| Transport module scope/interface | [modules/m-codex-shared-transport/spec.md](modules/m-codex-shared-transport/spec.md) |
| Planned source changes and tests | [modules/m-codex-shared-transport/impl.md](modules/m-codex-shared-transport/impl.md) |
| Source folder layout and existing baseline links | [modules/folder_layout.md](modules/folder_layout.md) |
| Scenario sequence + state snapshots | [ontology/share-codex-sequence.md](ontology/share-codex-sequence.md) |
| Step-level function/RPC sequence + state snapshots | [ontology/share-codex-pseudocode.md](ontology/share-codex-pseudocode.md) |
| User objectives for t-share-codex | [tickets/t-share-codex/t-share-codex.md](tickets/t-share-codex/t-share-codex.md) |
| Current progress and next Agent handoff | [tickets/t-share-codex/state.md](tickets/t-share-codex/state.md) |

## Existing project and source index
[Systems instructions](../systems/AGENTS.md) — runtime constraints. [Concept inventory](../docs/architecture/DOMAIN_CONCEPTS.md) — domain owners; avoid new identity without evidence. [Project docs navigation](../docs/README.md). [Codex Driver](../systems/station/src/agents/codex.ts) — owned STDIO Host; [Agent runtime](../systems/station/src/agents/runtime.ts) — common interfaces; [profiles.ts](../systems/station/src/agents/profiles.ts) — credentials and configuration; [sessions/agents.ts](../systems/station/src/sessions/agents.ts) — creation/MCP; [Station MCP](../systems/station/src/tools/mcp.ts) — tool authorization; [Driver test](../systems/station/test/codex.test.ts) and [fake](../systems/station/test/fake/codex.mjs); [Runner docs](../systems/station/docs/station-ts-native.md). [Upstream Codex native CLI --remote](https://github.com/openai/codex/blob/main/codex-rs/cli/src/main.rs).

No Worker Session ID is known, so no `.dsu/workers/` file was invented. **update-doc performed**: this index and ticket state are consistent with all listed docs.
