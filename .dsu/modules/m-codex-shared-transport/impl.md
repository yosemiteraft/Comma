# Module implementation plan (not yet coded)

1. Batch-inspect `systems/station/src/agents/{codex,profiles,runtime,process,runner}.ts`, `systems/station/src/sessions/{agents,hub}.ts`, `systems/station/src/tools/mcp.ts`, and existing fake/test.
2. Add Codex-only external transport, e.g. `src/agents/codex-remote.ts` (**proposed name, not existing**), supporting RPC initialize, authenticated connection, notifications, request settlement and reconnect.
3. Refactor `CodexDriver.Host` to connect, not call `AgentProcess.start`. Reconcile snapshot/adopt from server history; preserve `CodexSession` API, model selection, MCP URL/token and thread ID.
4. Wire endpoint and auth settings in `profiles.ts` and `sessions/agents.ts`; fail closed for missing endpoint. Do not change Claude Runner.
5. Replace STDIO fake in `test/fake/codex.mjs` with a remote fake, extend `test/codex.test.ts` with multiwriter/unknown acceptance/reconnect/no-kill/MCP assertions.
6. Prove with real Codex two official CLI writers on identical Thread, plus Comma and race recovery; otherwise mark P0 blocked. Keep `state.md` current.

Existing: [codex.ts](../../../systems/station/src/agents/codex.ts) · [runtime.ts](../../../systems/station/src/agents/runtime.ts) · [test](../../../systems/station/test/codex.test.ts).
