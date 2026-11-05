# Module implementation and remaining verification

1. Batch-inspect `systems/station/src/agents/{codex,profiles,runtime,process,runner}.ts`, `systems/station/src/sessions/{agents,hub}.ts`, `systems/station/src/tools/mcp.ts`, and existing fake/test.
2. Add Codex-only external transport, e.g. `src/agents/codex-remote.ts` (**proposed name, not existing**), supporting RPC initialize, authenticated connection, notifications, request settlement and reconnect.
3. Refactor `CodexDriver.Host` to connect, not call `AgentProcess.start`. Reconcile snapshot/adopt from server history; preserve `CodexSession` API, model selection, MCP URL/token and thread ID.
4. Wire endpoint and auth settings in `profiles.ts` and `sessions/agents.ts`; fail closed for missing endpoint. Do not change Claude Runner.
5. Replace STDIO fake in `test/fake/codex.mjs` with a remote fake, extend `test/codex.test.ts` with multiwriter/unknown acceptance/reconnect/no-kill/MCP assertions.
6. Prove with real Codex two official CLI writers on identical Thread, plus Comma and race recovery; otherwise mark P0 blocked. Keep `state.md` current.

Existing: [codex.ts](../../../systems/station/src/agents/codex.ts) · [runtime.ts](../../../systems/station/src/agents/runtime.ts) · [test](../../../systems/station/test/codex.test.ts).


## Actual source delta
1. NEW systems/station/src/agents/codex-remote.ts: remoteConfig reads STILLFAIL_CODEX_REMOTE_ENDPOINT or profile codex_remote; validates loopback WS / WSS / Unix path; optional bearer token named by STILLFAIL_CODEX_REMOTE_AUTH_TOKEN_ENV; WebSocket JSON-RPC initialize, request ID tracking, bounded timeout, thread resume/read reconciliation and disconnect-only shutdown.
2. CHANGED systems/station/src/agents/codex.ts: CodexDriver.host/attach/open/adopt attach to external service, preserve model, effort, developerInstructions, Station per-Session MCP URL/token, CodexSession.prompt/steer/abort and live events. Handover checks authoritative server turn and defers verified completion notification until SessionActor is attached. No AgentProcess.start, no STDIO server spawn or kill.
3. REPLACED systems/station/test/codex.test.ts: six mock protocol tests for required endpoint, per-Session MCP config, multiple simulated clients with same thread, busy conflict, snapshot/adopt, lost request acknowledgement. The legacy STDIO fake fixture remains but is no longer referenced by the replaced test.
4. NO verified local compilation or executed test results, NO real native Codex App Server / CLI interoperability result. The implementation is pending G0–G5 and may require fixes; inspect changed sources and run tests in authorized runtime before release.
