// Remote Codex Driver: explicit external server, same-thread subscribers, errors and lifecycle.
// This fake exercises the wire contract only. It is NOT a substitute for the official CLI G0 E2E.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { WebSocketServer, type WebSocket } from "ws";
import { CodexDriver } from "../src/agents/codex.ts";
import { CodexRemoteHost, remoteConfig } from "../src/agents/codex-remote.ts";
import type { OpenOptions, Profile, RuntimeEvent } from "../src/agents/runtime.ts";

type Json = any;
const root = mkdtempSync(join(tmpdir(), "codex-shared-"));
const drivers: CodexDriver[] = [];
after(async () => {
  await Promise.all(drivers.map((d) => d.shutdown()));
  rmSync(root, { recursive: true, force: true });
});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(check: () => boolean, limit = 3000) {
  const end = Date.now() + limit;
  while (!check() && Date.now() < end) await sleep(10);
  assert.ok(check(), "timed out waiting for remote event");
}
function fakeProfile(id: string): Profile {
  return { id, runtime: "codex", home: root, credential: "api_key", source: "openai", key: "unused" };
}
function options(profile: Profile): OpenOptions {
  return { key: "s:" + profile.id, profile, cwd: root, instructions: "Only local tests; no GitHub Actions",
    mcpUrl: "http://127.0.0.1:4750/mcp", mcpToken: "test-session-token", route: profile.id };
}
function makeDriver(endpoint: string): CodexDriver {
  const d = new CodexDriver({ data: root, env: { ...process.env, STILLFAIL_CODEX_REMOTE_ENDPOINT: endpoint },
    hostSkills: join(root, "does-not-exist") });
  drivers.push(d);
  return d;
}

async function fakeServer() {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing server port");
  const endpoint = "ws://127.0.0.1:" + address.port;
  const connections = new Set<WebSocket>();
  const threads = new Map<string, Json>();
  const calls: Array<{ method: string; params: Json }> = [];
  let nextId = 0;
  let delay = 20;
  let closeOnTurn = false;
  const broadcast = (threadId: string, method: string, params: Json) => {
    for (const ws of connections) if (ws.readyState === ws.OPEN)
      ws.send(JSON.stringify({ method, params: { ...params, threadId } }));
  };
  const reply = (ws: WebSocket, id: Json, result: Json) =>
    ws.send(JSON.stringify({ id, result }));
  const refuse = (ws: WebSocket, id: Json, message: string) =>
    ws.send(JSON.stringify({ id, error: { code: -32000, message } }));
  server.on("connection", (ws) => {
    connections.add(ws);
    ws.on("close", () => connections.delete(ws));
    ws.on("message", (raw) => {
      let msg: Json;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg?.id == null) return;
      const method = String(msg.method), p = msg.params ?? {};
      calls.push({ method, params: p });
      if (method === "initialize") return reply(ws, msg.id, { serverInfo: { name: "fake-codex" } });
      if (method === "thread/start") {
        const id = "th-" + (++nextId);
        const thread = { id, cwd: p.cwd, status: { type: "idle" }, turns: [] as Json[] };
        threads.set(id, thread);
        return reply(ws, msg.id, { thread });
      }
      if (method === "thread/resume" || method === "thread/read") {
        const t = threads.get(p.threadId);
        if (!t) return refuse(ws, msg.id, "missing thread");
        return reply(ws, msg.id, { thread: t });
      }
      if (method === "model/list") return reply(ws, msg.id, { data: [{ id: "test-model", hidden: false }], nextCursor: null });
      if (method === "account/rateLimits/read") return reply(ws, msg.id, { rateLimits: {} });
      if (method === "mcpServerStatus/list") return reply(ws, msg.id, { data: [{ name: "stillfail", runtimeStatus: "running" }] });
      if (method === "thread/unsubscribe") return reply(ws, msg.id, {});
      if (method === "turn/start") {
        const t = threads.get(p.threadId);
        if (!t) return refuse(ws, msg.id, "missing thread");
        if (t.status.type === "active") return refuse(ws, msg.id, "turn already active");
        const turn: Json = { id: "turn-" + (++nextId), status: "inProgress", error: null, items: [] };
        t.turns.push(turn);
        t.status = { type: "active" };
        if (closeOnTurn) {
          closeOnTurn = false;
          ws.close(); // simulate unknown acceptance after server received request
        } else reply(ws, msg.id, { turn });
        broadcast(t.id, "turn/started", { turn });
        setTimeout(() => {
          turn.status = "completed";
          t.status = { type: "idle" };
          broadcast(t.id, "turn/completed", { turn });
        }, delay);
        return;
      }
      if (method === "turn/steer") return reply(ws, msg.id, {});
      if (method === "turn/interrupt") return reply(ws, msg.id, {});
      refuse(ws, msg.id, "unsupported " + method);
    });
  });
  return {
    endpoint, calls, connections, threads, server,
    hold(ms: number) { delay = ms; },
    dropNextTurn() { closeOnTurn = true; },
    async close() {
      for (const ws of connections) ws.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test("Codex remote requires a configured server and refuses unsafe remote WS", () => {
  const p = fakeProfile("one");
  assert.throws(() => remoteConfig(p, {}), /requires an external Codex server/);
  assert.throws(() => remoteConfig(p, { STILLFAIL_CODEX_REMOTE_ENDPOINT: "ws://192.0.2.1:4567" }), /loopback/);
  assert.throws(() => remoteConfig(p, { STILLFAIL_CODEX_REMOTE_ENDPOINT: "unix://relative.sock" }), /absolute/);
  assert.equal(remoteConfig(p, { STILLFAIL_CODEX_REMOTE_ENDPOINT: "unix:///tmp/codex.sock" }).address, "unix:///tmp/codex.sock");
});

test("Comma connects to already-running server and retains MCP/config and same thread", async () => {
  const fake = await fakeServer();
  try {
    const p = fakeProfile("shared");
    const d = makeDriver(fake.endpoint);
    const events: RuntimeEvent[] = [];
    const s = await d.open(options(p), (e) => events.push(e));
    const start = fake.calls.find((c) => c.method === "thread/start");
    assert.equal(start?.params?.config?.["mcp_servers.stillfail.url"], "http://127.0.0.1:4750/mcp");
    assert.equal(start?.params?.config?.["mcp_servers.stillfail.http_headers"]?.Authorization, "Bearer test-session-token");
    assert.equal(start?.params?.developerInstructions, "Only local tests; no GitHub Actions");
    assert.equal(s.id(), "th-1");
    await s.prompt("Comma turn");
    await until(() => events.some((e) => e.type === "turnEnded"));
    assert.equal(fake.threads.get(s.id())?.turns.length, 1);
    await d.shutdown();
    assert.notEqual(fake.server.address(), null, "Station shutdown must not kill external server");
  } finally { await fake.close(); }
});

test("two independent remote clients share the exact Comma-created thread", async () => {
  const fake = await fakeServer();
  let a: CodexRemoteHost | null = null, b: CodexRemoteHost | null = null;
  try {
    const p = fakeProfile("writers");
    const d = makeDriver(fake.endpoint);
    const events: RuntimeEvent[] = [];
    const station = await d.open(options(p), (e) => events.push(e));
    const config = remoteConfig(p, { STILLFAIL_CODEX_REMOTE_ENDPOINT: fake.endpoint });
    a = new CodexRemoteHost(p.id + "-a", config);
    b = new CodexRemoteHost(p.id + "-b", config);
    await Promise.all([a.ensureReady(), b.ensureReady()]);
    const id = station.id();
    assert.equal((await a.request("thread/resume", { threadId: id })).thread.id, id);
    assert.equal((await b.request("thread/resume", { threadId: id })).thread.id, id);
    await a.request("turn/start", { threadId: id, input: [{ type: "text", text: "from CLI A simulator" }] });
    await until(() => fake.threads.get(id)?.turns[0]?.status === "completed");
    await b.request("turn/start", { threadId: id, input: [{ type: "text", text: "from CLI B simulator" }] });
    await until(() => fake.threads.get(id)?.turns[1]?.status === "completed");
    assert.equal((await a.readThread(id)).turns.length, 2);
    assert.equal((await b.readThread(id)).turns.length, 2);
    await until(() => events.filter((e) => e.type === "turnEnded").length >= 2);
    assert.equal(station.busy(), false);
  } finally {
    a?.detach(); b?.detach();
    await fake.close();
  }
});

test("server refuses competing writers instead of concurrent turns", async () => {
  const fake = await fakeServer();
  let contender: CodexRemoteHost | null = null;
  try {
    fake.hold(200);
    const p = fakeProfile("race");
    const d = makeDriver(fake.endpoint);
    const station = await d.open(options(p), () => {});
    const id = station.id();
    contender = new CodexRemoteHost("contender", remoteConfig(p, { STILLFAIL_CODEX_REMOTE_ENDPOINT: fake.endpoint }));
    await contender.ensureReady();
    await station.prompt("first");
    await assert.rejects(contender.request("turn/start", { threadId: id, input: [] }), /already active/);
    await until(() => fake.threads.get(id)?.turns[0]?.status === "completed");
    assert.equal(fake.threads.get(id)?.turns.length, 1);
  } finally { contender?.detach(); await fake.close(); }
});

test("Station snapshot/adopt reuses remote thread and leaves server running", async () => {
  const fake = await fakeServer();
  try {
    const p = fakeProfile("handover");
    const d1 = makeDriver(fake.endpoint);
    const s = await d1.open(options(p), () => {});
    const snapshot = s.snapshot();
    d1.detach();
    assert.notEqual(fake.server.address(), null);
    const d2 = makeDriver(fake.endpoint);
    const resumed = await d2.adopt(options(p), snapshot, () => {});
    assert.equal(resumed.id(), s.id());
    assert.equal(fake.threads.size, 1);
  } finally { await fake.close(); }
});

test("lost turn/start response is marked uncertain, never automatically replayed", async () => {
  const fake = await fakeServer();
  try {
    const p = fakeProfile("ambiguous");
    const d = makeDriver(fake.endpoint);
    const station = await d.open(options(p), () => {});
    fake.dropNextTurn();
    await assert.rejects(station.prompt("unknown"), /acceptance unknown/);
    assert.equal(station.busy(), true);
    assert.equal(fake.threads.get(station.id())?.turns.length, 1);
    await assert.rejects(station.prompt("duplicate"), /uncertain|active/);
    assert.equal(fake.threads.get(station.id())?.turns.length, 1);
  } finally { await fake.close(); }
});
