# Shared Codex Session sequence + snapshots

**Proposed behavior, NOT verified on real server.** [P]=program, [M]=Codex model.

```mermaid
sequenceDiagram
  participant O as Operator
  participant S as Comma Station [P]
  participant A as External Codex App Server [P]
  participant C1 as Codex CLI A [P/M]
  participant C2 as Codex CLI B [P/M]
  participant T as Station HTTP MCP [P]
  O->>A: Start pre-existing server --listen unix:// or ws://
  O->>S: Configure same endpoint
  S->>A: initialize; initialized; thread/start
  Note over S,A: S1: CommaSession -> thread TH1
  S->>A: turn/start(TH1, input A)
  A->>T: tools/list; tools/call + bearer
  T-->>A: authorized result
  A-->>S: turn/completed
  C1->>A: --remote endpoint; resume TH1
  A-->>C1: read identical TH1 history
  C1->>A: turn/start(TH1, input B)
  A-->>S: turn events
  C2->>A: --remote endpoint; resume TH1
  A-->>C2: A+B history
  C2->>A: turn/start(TH1, input C)
  A-->>S: external turn events
  Note over S,C2: S2: TH1 has A+B+C, one server
```

**S3 concurrent snapshot:** CLI A Turn active, Comma and CLI B both attempt write. Server must serialize/refuse, not create concurrent turns. This is P0 unverified until actual 3-writer test.

**S4 crash snapshot:** Comma loses connection after `turn/start` sent; server may have accepted. Comma marks unknown, reads server truth, reconnects without resending blindly. External server and CLI continue running.

Existing evidence: `CodexDriver.open`, `CodexSession.prompt` in `systems/station/src/agents/codex.ts`; official CLI `--remote` in `openai/codex/codex-rs/cli/src/main.rs`. No model calls needed for Station dispatch; model runs only on Codex Turn.
