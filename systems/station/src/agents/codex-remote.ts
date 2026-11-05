// Codex App Server client. The server is operator-owned: NEVER spawn or kill it.
// Both ws:// and Unix sockets use WebSocket-framed JSON-RPC, per Codex's remote protocol.
import WebSocket from "ws";
import type { Env } from "./machine-logins.ts";
import type { Profile } from "./runtime.ts";

type Json = any;
export type RemoteNotice =
  | { kind: "method"; method: string; params: Json }
  | { kind: "disconnected"; reason: string }
  | { kind: "reconciled"; thread: Json };
export type RemoteSink = (notice: RemoteNotice) => void;

type Pending = { method: string; resolve: (result: Json) => void; reject: (error: Error) => void };

export class UnknownRemoteResult extends Error {
  constructor(public readonly method: string) {
    super("Codex remote connection dropped after sending " + method + "; acceptance unknown; do not retry without reconciliation");
    this.name = "UnknownRemoteResult";
  }
}

export type RemoteConfig = { address: string; authorization?: string; signature: string };

export function remoteConfig(profile: Profile, env: Env): RemoteConfig {
  // Environment fallback works with older native profile parsers that do not preserve new fields.
  // Profile-level codex_remote is optional where the native config parser permits it.
  const raw = profile.codex_remote ?? profile.codexRemote ?? env.STILLFAIL_CODEX_REMOTE_ENDPOINT;
  const address = typeof raw === "string" ? raw :
    raw && typeof raw === "object" && typeof raw.address === "string" ? raw.address : "";
  if (!address) throw new Error("Codex profile " + profile.id + " requires an external Codex server: set STILLFAIL_CODEX_REMOTE_ENDPOINT (STDIO is disabled)");
  const envName = raw && typeof raw === "object" && typeof raw.authTokenEnv === "string" ?
    raw.authTokenEnv : env.STILLFAIL_CODEX_REMOTE_AUTH_TOKEN_ENV;
  const authorization = envName ? env[envName] : undefined;
  if (envName && !authorization) throw new Error("Codex remote auth-token environment variable is missing");
  if (address.startsWith("unix://")) {
    const socket = address.slice(7);
    if (!socket.startsWith("/") || /[:?#]/.test(socket))
      throw new Error("Codex Unix socket must be an absolute path without URL delimiters");
    if (authorization) throw new Error("Unix socket credentials are enforced by filesystem permissions, not bearer headers");
  } else {
    let parsed: URL;
    try { parsed = new URL(address); } catch { throw new Error("Invalid Codex remote endpoint"); }
    if (!["ws:", "wss:"].includes(parsed.protocol) || !parsed.port || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password)
      throw new Error("Codex endpoint must be ws://host:port or wss://host:port without embedded secrets");
    if (parsed.protocol === "ws:" && !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))
      throw new Error("Plain WS requires a loopback address; use WSS for remote access");
  }
  return { address, authorization, signature: JSON.stringify([profile.id, address, envName ?? ""]) };
}

function websocketUrl(address: string) {
  // ws package's ws+unix framing connects to a Unix domain socket with handshake GET /rpc.
  return address.startsWith("unix://") ? "ws+unix://" + address.slice(7) + ":/rpc" : address;
}

export class CodexRemoteHost {
  readonly threads = new Map<string, RemoteSink>();
  readonly profile: string;
  readonly signature: string;
  private readonly config: RemoteConfig;
  private socket: WebSocket | null = null;
  private pending = new Map<number, Pending>();
  private connection: Promise<void> | null = null;
  private nextId = 1;
  private ready = false;
  private closed = false;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(profile: string, config: RemoteConfig) {
    this.profile = profile;
    this.config = config;
    this.signature = config.signature;
  }

  alive() { return !this.closed; }
  addThread(threadId: string, sink: RemoteSink) { this.threads.set(threadId, sink); }
  removeThread(threadId: string) { this.threads.delete(threadId); }
  snapshot() { return { remote: this.config.address, signature: this.signature }; }

  private send(message: Json) {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("Codex remote socket unavailable");
    socket.send(JSON.stringify(message));
  }

  private rawRequest(method: string, params: Json): Promise<Json> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Codex remote socket unavailable"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      try { this.send({ id, method, params }); }
      catch (e) { this.pending.delete(id); reject(e as Error); }
    });
  }

  private received(data: WebSocket.RawData) {
    let msg: Json;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg?.id !== undefined && msg?.method === undefined) {
      const key = Number(msg.id), pending = this.pending.get(key);
      if (!pending) return;
      this.pending.delete(key);
      if (msg.error != null) pending.reject(new Error("Codex RPC " + pending.method + " refused: " + JSON.stringify(msg.error)));
      else pending.resolve(msg.result ?? null);
    } else if (msg?.id !== undefined && typeof msg.method === "string") {
      // Approval prompts must never hang: Codex is started with approvalPolicy never.
      try { this.send({ id: msg.id, error: { code: -32601, message: "Comma does not handle client requests" } }); } catch {}
    } else if (typeof msg?.method === "string" && typeof msg.params?.threadId === "string") {
      this.threads.get(msg.params.threadId)?.({ kind: "method", method: msg.method, params: msg.params });
    }
  }

  private dropped(socket: WebSocket) {
    if (socket !== this.socket) return;
    this.socket = null;
    this.ready = false;
    for (const p of this.pending.values()) p.reject(new UnknownRemoteResult(p.method));
    this.pending.clear();
    for (const sink of this.threads.values()) sink({ kind: "disconnected", reason: "Codex remote disconnected" });
    if (!this.closed && this.threads.size) this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.closed || this.retryTimer || this.connection) return;
    const delay = Math.min(1000 * 2 ** Math.min(this.retry++, 5), 30000);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.ensureReady().catch(() => this.scheduleReconnect());
    }, delay);
  }

  private async connect(): Promise<void> {
    const headers = this.config.authorization ? { Authorization: "Bearer " + this.config.authorization } : undefined;
    const socket = new WebSocket(websocketUrl(this.config.address), { headers, handshakeTimeout: 10000, maxPayload: 128 << 20 });
    this.socket = socket;
    socket.on("message", (data) => this.received(data));
    socket.on("error", () => {}); // Handshake error is handled below; subsequent close drives reconnect.
    socket.on("close", () => this.dropped(socket));
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("open", resolve);
        socket.once("error", reject);
        socket.once("close", () => reject(new Error("Codex remote closed during handshake")));
      });
      await this.rawRequest("initialize", { clientInfo: { name: "comma-station", version: "1" }, capabilities: { experimentalApi: true } });
      this.send({ method: "initialized", params: {} });
      // All subscribed threads must be rejoined; each state update is based on the server, not guesses.
      for (const [threadId, sink] of this.threads) {
        await this.rawRequest("thread/resume", { threadId, excludeTurns: true });
        const result = await this.rawRequest("thread/read", { threadId, includeTurns: true });
        if (result?.thread?.id !== threadId) throw new Error("Codex returned a different thread ID");
        sink({ kind: "reconciled", thread: result.thread });
      }
      this.ready = true;
      this.retry = 0;
    } catch (e) {
      socket.terminate();
      if (this.socket === socket) this.socket = null;
      this.ready = false;
      throw e;
    }
  }

  async ensureReady(): Promise<void> {
    if (this.closed) throw new Error("Codex remote connection is closed");
    if (this.ready && this.socket?.readyState === WebSocket.OPEN) return;
    if (this.connection) return this.connection;
    this.connection = this.connect();
    try { await this.connection; }
    catch (error) {
      // A disconnect DURING initialize/rejoin happened while connection was still set.
      // Schedule after finally releases that lock; without this the host never retries.
      if (!this.closed && this.threads.size) setImmediate(() => this.scheduleReconnect());
      throw error;
    } finally { this.connection = null; }
  }

  async request(method: string, params: Json): Promise<Json> {
    await this.ensureReady();
    return this.rawRequest(method, params);
  }

  async readThread(threadId: string): Promise<Json> {
    const result = await this.request("thread/read", { threadId, includeTurns: true });
    if (result?.thread?.id !== threadId) throw new Error("Codex returned a different thread ID");
    return result.thread;
  }

  detach() {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    for (const p of this.pending.values()) p.reject(new UnknownRemoteResult(p.method));
    this.pending.clear();
    const socket = this.socket;
    this.socket = null;
    this.ready = false;
    socket?.close(); // NEVER terminate the operator-owned app-server.
  }
}
