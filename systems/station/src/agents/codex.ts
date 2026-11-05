// Codex Driver: connect to an externally managed App Server per profile. Multiple official remote
// Codex CLI clients and Comma may attach to the same server and thread. No STDIO process ownership.
//
// Pinned by spikes (spike/README.md):
// - a thread adds <1MB to its app-server, so sessions share one process;
// - per-session settings (the MCP endpoint and token) travel in the thread/start|resume `config`, not the process
//   environment;
// - threads need sandbox "danger-full-access" with approvalPolicy "never", or MCP tool calls are refused.
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { log } from "../ops/log.ts";
import { LiveFromCodex, chars, type CodexLiveState } from "./live.ts";
import type { Env } from "./machine-logins.ts";
import { debug } from "./process.ts";
import { CodexRemoteHost, remoteConfig, UnknownRemoteResult, type RemoteSink } from "./codex-remote.ts";
import { accessKind, profileFast } from "./profiles.ts";
import type { AgentDriver, AgentSession, FailureReason, OpenOptions, Profile, RuntimeEvent, TurnOutcome } from "./runtime.ts";

type Json = any;


/// Codex otherwise reads the system's root certificates for each new connection. On macOS, from a process outside the
/// desktop session, that can take seconds or hang past its 15 s request timeout, and fail with UnknownIssuer.
/// SSL_CERT_FILE makes it use a CA file instead, for its model websocket as well as its HTTP clients. One the user set
/// wins.

export function withCaBundle(env: Record<string, string>, bundle: string) {
  if (["SSL_CERT_FILE", "SSL_CERT_DIR", "CODEX_CA_CERTIFICATE"].some((k) => k in env) || !existsSync(bundle)) return;
  env.SSL_CERT_FILE = bundle;
}

/// Paths in the order Rust sorts PathBufs: component by component.
function comparePaths(a: string, b: string): number {
  const x = a.split("/");
  const y = b.split("/");
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i]! < y[i]! ? -1 : 1;
  }
  return x.length - y.length;
}

/// Codex also loads the skills in the user's own ~/.agents/skills. The station's agents share skills through the agent
/// home instead, and the personal ones pull them off course, so each is turned off by path: codex's skills.config takes
/// files, not directories.
export function hostSkillsOff(root: string): { path: string; enabled: false }[] {
  const found: string[] = [];
  const visited = new Set<string>();
  const walk = (dir: string, depth: number) => {
    if (depth > 6) return;
    let real: string;
    try {
      real = realpathSync(dir);
    } catch {
      return;
    }
    if (visited.has(real)) return;
    visited.add(real);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const path = join(dir, name);
      // Follows links: skill folders are often linked in.
      let isDir: boolean;
      try {
        isDir = statSync(path).isDirectory();
      } catch {
        continue;
      }
      if (isDir) walk(path, depth + 1);
      else if (name === "SKILL.md") found.push(path);
    }
  };
  walk(root, 0);
  return found.sort(comparePaths).map((path) => ({ path, enabled: false as const }));
}

export function classifyCodexError(info: unknown): FailureReason {
  const code = typeof info === "string" ? info : info && typeof info === "object" && !Array.isArray(info) ? Object.keys(info)[0] : undefined;
  if (code === "unauthorized") return "auth";
  if (code === "usageLimitExceeded" || code === "rateLimitExceeded" || code === "serverOverloaded") return "rate_limit";
  return "model";
}

/// Keeps capabilities alongside model ids; an old runtime may omit them.
export class ModelCatalog {
  models: string[] = [];
  efforts = new Map<string, string[]>();

  extend(answer: Json) {
    const rows = answer?.data;
    if (!Array.isArray(rows)) throw new Error("model/list omitted data");
    for (const m of rows.filter((m: Json) => m?.hidden !== true)) {
      const id = typeof m?.id === "string" ? m.id : typeof m?.model === "string" && m?.id === undefined ? m.model : undefined;
      if (!id) continue;
      this.models.push(id);
      if (Array.isArray(m.supportedReasoningEfforts)) {
        const efforts: string[] = [];
        for (const level of m.supportedReasoningEfforts) {
          const effort = level?.reasoningEffort;
          if (typeof effort === "string" && effort !== "" && !efforts.includes(effort)) efforts.push(effort);
        }
        this.efforts.set(id, efforts);
      }
    }
  }
}

/// A thread's share of its app-server's notifications.
type Notice = { kind: "method"; method: string; params: Json } | { kind: "hostExited"; reason: string };
type Sink = (notice: Notice) => void;

/// What a crashed station had seen of a thread (read again from the app-server's output).
type Recovered = { busy: boolean; turnId: string | null; live: LiveFromCodex };

/// While sessions are being taken up, what the app-server says of a thread not taken up yet waits this long for it.
const ORPHANS_MS = 60_000;
const ORPHANS_MAX = 10_000;

// The app-server is externally managed. Comma does not create or kill it.
export type CodexSnapshot = {
  runtime: "codex"; threadId: string; profile: string; busy: boolean;
  turnId: string | null; live: CodexLiveState; host: { remote: string; signature: string };
};
export type CodexDriverOptions = {
  data: string; command?: string; env?: Env; hostSkills?: string; caBundle?: string;
  fast?: (threadId: string) => boolean | undefined;
  currentProfile?: (id: string) => Profile | undefined;
  lent?: { borrowed(profile: Profile): boolean; write(profile: Profile): Promise<number> };
};

export class CodexDriver implements AgentDriver {
  readonly options: CodexDriverOptions;
  private readonly env: Env;
  private readonly hostSkills: string;
  private readonly hosts = new Map<string, CodexRemoteHost>();
  private hostQueue: Promise<unknown> = Promise.resolve();

  constructor(options: CodexDriverOptions) {
    this.options = options;
    this.env = options.env ?? process.env;
    this.hostSkills = options.hostSkills ?? join(this.env.HOME ?? "", ".agents", "skills");
  }

  runtime(): "codex" { return "codex"; }
  // This account and App Server are not owned by Comma.
  running(_profileId: string): boolean { return false; }

  private serial<T>(f: () => Promise<T>): Promise<T> {
    const next = this.hostQueue.then(f, f);
    this.hostQueue = next.catch(() => {});
    return next;
  }

  private async host(profile: Profile): Promise<CodexRemoteHost> {
    const cfg = remoteConfig(profile, this.env);
    const h = await this.serial(async () => {
      const previous = this.hosts.get(profile.id);
      if (previous?.alive() && previous.signature === cfg.signature) return previous;
      if (previous && previous.threads.size > 0)
        throw new Error("Codex remote endpoint changed with active Sessions; explicit migration required");
      previous?.detach();
      const current = new CodexRemoteHost(profile.id, cfg);
      this.hosts.set(profile.id, current);
      return current;
    });
    await h.ensureReady();
    return h;
  }

  async rateLimits(profile: Profile): Promise<Json> {
    return (await this.host(profile)).request("account/rateLimits/read", {});
  }
  async resetQuota(profile: Profile, key: string): Promise<Json> {
    return (await this.host(profile)).request("account/rateLimitResetCredit/consume", { idempotencyKey: key });
  }
  async models(profile: Profile): Promise<ModelCatalog> {
    const h = await this.host(profile), models = new ModelCatalog();
    let cursor: string | null = null;
    const seen = new Set<string>();
    do {
      const reply = await h.request("model/list", { cursor });
      models.extend(reply);
      cursor = typeof reply?.nextCursor === "string" && reply.nextCursor ? reply.nextCursor : null;
      if (cursor && seen.has(cursor)) throw new Error("model/list repeated its cursor");
      if (cursor) seen.add(cursor);
    } while (cursor);
    models.models = [...new Set(models.models.sort())];
    return models;
  }

  private async attach(h: CodexRemoteHost, options: OpenOptions, events: (e: RuntimeEvent) => void, resume?: string): Promise<CodexSession> {
    const config: Json = {
      "mcp_servers.stillfail.url": options.mcpUrl,
      "mcp_servers.stillfail.http_headers": { Authorization: "Bearer " + options.mcpToken },
    };
    if (options.effort !== undefined) config.model_reasoning_effort = options.effort;
    const skillsOff = hostSkillsOff(this.hostSkills);
    if (skillsOff.length) config["skills.config"] = skillsOff;
    const params: Json = { cwd: options.cwd, approvalPolicy: "never", sandbox: "danger-full-access", config };
    if (options.model !== undefined) params.model = options.model;
    if (options.instructions !== "") params.developerInstructions = options.instructions;
    if (resume) params.threadId = resume;
    const reply = await h.request(resume ? "thread/resume" : "thread/start", params);
    const thread = reply?.thread;
    if (typeof thread?.id !== "string" || (resume && thread.id !== resume))
      throw new Error("Codex remote returned an unexpected thread ID");
    if (typeof thread.cwd === "string" && thread.cwd !== options.cwd)
      throw new Error("Codex remote thread belongs to a different working directory");
    const turns: Json[] = Array.isArray(thread.turns) ? thread.turns : [];
    const last = turns.at(-1);
    const busy = last?.status === "inProgress" || thread.status?.type === "active";
    const state: ThreadState = { busy, turnId: busy && typeof last?.id === "string" ? last.id : null, closed: false };
    const session = new CodexSession(this, thread.id, h, options.profile, state, new LiveFromCodex(), events);
    h.addThread(thread.id, session.sink());
    if (busy) events({ type: "turnStarted" });
    if (await stationToolsFailed(h, thread.id)) {
      h.removeThread(thread.id);
      throw new Error("Codex remote Station MCP initialization failed");
    }
    return session;
  }

  async open(options: OpenOptions, events: (e: RuntimeEvent) => void): Promise<AgentSession> {
    return this.attach(await this.host(options.profile), options, events, options.resume);
  }

  async adopt(options: OpenOptions, snapshot: unknown | null, events: (e: RuntimeEvent) => void): Promise<AgentSession> {
    const previous = snapshot as CodexSnapshot | null;
    const id = previous?.threadId ?? options.resume;
    if (!id) throw new Error("Codex remote recovery requires a thread ID");
    const h = await this.host(options.profile);
    if (previous?.host?.remote && previous.host.remote !== h.snapshot().remote)
      throw new Error("Codex remote endpoint changed after Session snapshot; migrate explicitly");
    const session = await this.attach(h, options, events, id);
    // Hub attaches the SessionActor only after this async adopt() returns.
    // If a turn completed while Station was down, deliver the authoritative
    // completion on the following event-loop tick, after actor.adopt().
    if (previous?.busy || snapshot === null) {
      const thread = await h.readThread(id);
      const turns: Json[] = Array.isArray(thread.turns) ? thread.turns : [];
      const matching = previous?.turnId ? turns.find((t) => t.id === previous.turnId) : turns.at(-1);
      if (matching && ["completed", "interrupted", "failed"].includes(matching.status)) {
        const verifiedOutcome = asOutcome(matching);
        setImmediate(() => events({ type: "turnEnded", outcome: verifiedOutcome }));
      } else if (matching?.status === "inProgress") {
        session.restoreKnownTurn(matching.id);
      } else {
        session.blockUnknownTurn();
        log.warn("agents::codex", "adopt could not verify the previously running turn; blocked against duplicate execution", { thread: id });
      }
    }
    return session;
  }

  async shutdown() { for (const h of this.hosts.values()) h.detach(); this.hosts.clear(); }
  detach() { for (const h of this.hosts.values()) h.detach(); this.hosts.clear(); }
}

async function stationToolsFailed(h: CodexRemoteHost, threadId: string): Promise<boolean> {
  try {
    const r = await h.request("mcpServerStatus/list", { threadId, serverName: "stillfail", detail: "toolsAndAuthOnly" });
    return Array.isArray(r?.data) && r.data.some((s: Json) => s?.name === "stillfail" && s?.runtimeStatus === "failed");
  } catch { return false; }
}

type ThreadState = { busy: boolean; turnId: string | null; closed: boolean; uncertain?: boolean };
const input = (text: string) => [{ type: "text", text }];
function asOutcome(turn: Json): TurnOutcome {
  if (turn?.status === "interrupted") return { kind: "aborted" };
  if (turn?.status === "failed") {
    const error = turn.error ?? null;
    return { kind: "failed", reason: classifyCodexError(error?.codexErrorInfo ?? null),
      message: chars(typeof error?.message === "string" ? error.message : "turn failed", 1000) };
  }
  return { kind: "completed" };
}

export class CodexSession implements AgentSession {
  private offline = false;
  private readonly driver: CodexDriver;
  private readonly threadId: string;
  private readonly host: CodexRemoteHost;
  private readonly profile: Profile;
  private state: ThreadState;
  private readonly live: LiveFromCodex;
  private readonly events: (event: RuntimeEvent) => void;
  constructor(
    driver: CodexDriver, threadId: string, host: CodexRemoteHost,
    profile: Profile, state: ThreadState, live: LiveFromCodex,
    events: (event: RuntimeEvent) => void,
  ) {
    this.driver = driver;
    this.threadId = threadId;
    this.host = host;
    this.profile = profile;
    this.state = state;
    this.live = live;
    this.events = events;
  }

  private endTurn(result: TurnOutcome) {
    this.state.busy = false;
    this.state.turnId = null;
    this.state.uncertain = false;
    this.events({ type: "turnEnded", outcome: result });
  }
  private reconcile(thread: Json) {
    this.offline = false;
    const turns: Json[] = Array.isArray(thread?.turns) ? thread.turns : [];
    // When the acknowledgement of our turn/start was lost, another CLI may have
    // written the last turn. No response ID means we cannot attribute that turn.
    if (this.state.uncertain && this.state.turnId === null) return;
    const last = (this.state.turnId && turns.find((t) => t.id === this.state.turnId)) || turns.at(-1);
    if (this.state.busy && last && ["completed", "interrupted", "failed"].includes(last.status) &&
        (this.state.turnId === null || last.id === this.state.turnId)) {
      this.endTurn(asOutcome(last));
    } else if (last?.status === "inProgress") {
      const wasBusy = this.state.busy;
      this.state.busy = true;
      this.state.turnId = last.id;
      this.state.uncertain = false;
      if (!wasBusy) this.events({ type: "turnStarted" });
    }
    // Unknown accept without a server-confirmed turn stays blocked.
  }
  restoreKnownTurn(id: string | null) { if (this.state.busy && id) this.state.turnId = id; }
  blockUnknownTurn() { this.state.busy = true; this.state.uncertain = true; }

  sink(): RemoteSink {
    return (notice) => {
      if (this.state.closed) return;
      if (notice.kind === "disconnected") { this.offline = true; return; }
      if (notice.kind === "reconciled") { this.reconcile(notice.thread); return; }
      const { method, params } = notice;
      for (const event of this.live.feed(method, params)) this.events({ type: "live", event });
      if (method === "turn/started") {
        this.offline = false;
        this.state.uncertain = false;
        if (typeof params?.turn?.id === "string") this.state.turnId = params.turn.id;
        const wasBusy = this.state.busy;
        this.state.busy = true;
        if (!wasBusy) this.events({ type: "turnStarted" });
      } else if (method === "turn/completed") {
        if (this.state.uncertain && this.state.turnId === null) return;
        if (this.state.turnId !== null && params?.turn?.id !== this.state.turnId) return;
        this.endTurn(asOutcome(params?.turn));
      } else if (method === "error" && params?.willRetry !== true) {
        log.warn("agents::codex", "codex turn error", { thread: this.threadId, error: JSON.stringify(params?.error ?? null) });
      }
    };
  }

  id() { return this.threadId; }
  busy() { return this.state.busy || this.offline || this.state.uncertain === true; }

  async prompt(text: string) {
    if (this.state.closed) throw new Error("Codex session is closed");
    if (this.busy()) throw new Error("Codex remote turn active or uncertain: refusing conflicting write");
    await this.host.ensureReady();
    const thread = await this.host.readThread(this.threadId);
    if (thread.status?.type === "active") throw new Error("Another Codex CLI turn is running");
    const fast = this.driver.options.fast?.(this.threadId);
    const profile = this.driver.options.currentProfile?.(this.host.profile) ?? this.profile;
    const params: Json = { threadId: this.threadId, input: input(text) };
    if (profile && accessKind(profile) === "subscription") params.serviceTier = (fast ?? profileFast(profile)) ? "fast" : null;
    this.state.busy = true;
    try {
      const result = await this.host.request("turn/start", params);
      if (typeof result?.turn?.id === "string") this.state.turnId = result.turn.id;
    } catch (error) {
      if (error instanceof UnknownRemoteResult) this.state.uncertain = true;
      else this.state.busy = false;
      throw error;
    }
  }

  async steer(text: string) {
    if (this.state.closed || this.offline || !this.state.busy || this.state.turnId === null) return false;
    try {
      await this.host.request("turn/steer", { threadId: this.threadId, input: input(text), expectedTurnId: this.state.turnId });
      return true;
    } catch (error) {
      debug("agents::codex", "codex steer refused", { thread: this.threadId, error: String(error) });
      return false;
    }
  }
  async backgroundTools() {}
  async abort() {
    if (this.state.closed || !this.state.busy || this.state.turnId === null) return;
    try { await this.host.request("turn/interrupt", { threadId: this.threadId, turnId: this.state.turnId }); }
    catch (error) { log.warn("agents::codex", "codex interrupt failed", { thread: this.threadId, error: String(error) }); }
  }
  async dispose() {
    if (this.state.closed) return;
    this.state.closed = true;
    this.host.removeThread(this.threadId);
    await this.host.request("thread/unsubscribe", { threadId: this.threadId }).catch(() => {});
  }
  snapshot(): CodexSnapshot {
    this.state.closed = true;
    return { runtime: "codex", threadId: this.threadId, profile: this.host.profile, busy: this.state.busy,
      turnId: this.state.turnId, live: this.live.state(), host: this.host.snapshot() };
  }
  detach() {
    this.state.closed = true;
    this.host.removeThread(this.threadId);
    // Only the Station RPC connection closes; the operator-owned server remains running.
  }
}
