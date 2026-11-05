# Ticket t-share-codex

**Objective (user):** In `yosemiteraft/Comma`, replace STDIO calls to Codex with a connection to a separately running and user-configured Codex App Server. Multiple official Codex CLI processes can access **that same server and the exact Comma-created Codex Thread**, share readable history, and each submit writes/turns to that Thread.

**Outputs:** root `structure.md` (user source), all `.dsu` documentation according to it, working remote Codex transport, updated regression tests and real shared-writing results. **Scope:** Codex Driver and profile config only; preserve existing Router, Task, MCP, Claude Runner. **Do not invoke or modify GitHub Actions.**

**Highest-risk acceptance (P0):** native CLI remote multi-writer feasibility and concurrency semantics — must be actually tested, not inferred from socket support or mocked as success.

**Docs:** [functional spec](../../dev-spec.md), [design](../../dev-design.md), [risks](../../topics/shared-codex-risk-review.md), [sequence](../../ontology/share-codex-sequence.md), [handoff](state.md).

**Status:** OPEN; specification stage, NOT implemented.
