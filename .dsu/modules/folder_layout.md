# Folder layout for ticket

Root `structure.md`: user's original normative development document. Existing `AGENTS.md` and `docs/` baseline untouched.

`.dsu/index.md`: only development docs index.
`.dsu/dev-spec.md`: requirements; `dev-design.md`: architecture; `decisions.md`: rationale; `build-and-run.md`: verification.
`.dsu/topics/shared-codex-risk-review.md`: feasibility and budget.
`.dsu/modules/contracts/codex-shared-session.md`: module boundaries.
`.dsu/modules/m-codex-shared-transport/{spec,impl}.md`: module requirements and implementation.
`.dsu/ontology/share-codex-{sequence,pseudocode}.md`: object snapshots and exact call sequence.
`.dsu/tickets/t-share-codex/{t-share-codex,state}.md`: objective and primary handoff.
`.dsu/workers/`: no Worker ID known; no fabricated worker file.

Existing source candidates (not changed yet): `systems/station/src/agents/codex.ts`, `profiles.ts`, `runtime.ts`, `sessions/agents.ts`, `tools/mcp.ts`, `test/codex.test.ts`, `test/fake/codex.mjs`. Existing Runner docs: `systems/station/docs/station-ts-native.md`.
