import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleMessage, MCP_PROTOCOL_VERSION } from "../src/mcp/dispatch.js";
import { TOOL_DEFS, buildToolOptions } from "../src/mcp/tools.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("initialize echoes the client protocol version and reports server info", async () => {
  const res = await handleMessage(
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {} } },
    { serverVersion: "9.9.9" }
  );
  assert.equal(res.jsonrpc, "2.0");
  assert.equal(res.id, 1);
  assert.equal(res.result.protocolVersion, "2025-06-18");
  assert.deepEqual(res.result.capabilities, { tools: {} });
  assert.equal(res.result.serverInfo.name, "llm-wiki");
  assert.equal(res.result.serverInfo.version, "9.9.9");
});

test("initialize without a client version advertises the pinned protocol version", async () => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, {});
  assert.equal(res.result.protocolVersion, MCP_PROTOCOL_VERSION);
});

test("initialize falls back to the pinned version for an unsupported client version", async () => {
  const res = await handleMessage(
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } },
    {}
  );
  // Must NOT echo a version the server does not implement.
  assert.equal(res.result.protocolVersion, MCP_PROTOCOL_VERSION);
});

test("tools/list exposes only read-only tools with object input schemas", async () => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, {});
  const names = res.result.tools.map((t) => t.name);
  assert.deepEqual(names, TOOL_DEFS.map((t) => t.name));
  for (const tool of res.result.tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.inputSchema.type, "object");
  }
  // No write/mutating command is ever exposed over MCP.
  for (const forbidden of ["init", "fix", "migrate", "drift", "quickstart"]) {
    assert.ok(!names.includes(forbidden), `${forbidden} must not be an MCP tool`);
  }
});

test("tools/call runs a read-only command and returns structuredContent with schemaVersion", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "mcp-call-"));
  const res = await handleMessage(
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "audit", arguments: { cwd } } },
    {}
  );
  assert.equal(res.result.isError, false);
  assert.equal(res.result.structuredContent.command, "audit");
  assert.equal(res.result.structuredContent.schemaVersion, 1);
  // The rendered text report lives in content; structuredContent stays pure data.
  assert.equal(res.result.structuredContent.text, undefined);
  assert.equal(typeof res.result.content[0].text, "string");
  assert.ok(res.result.content[0].text.startsWith("# LLM-WIKI"));
});

test("ping returns an empty result", async () => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 4, method: "ping" }, {});
  assert.deepEqual(res.result, {});
});

test("notifications get no reply; unknown method and unknown tool error with JSON-RPC codes", async () => {
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, {}), null);
  const unknownMethod = await handleMessage({ jsonrpc: "2.0", id: 5, method: "foo/bar" }, {});
  assert.equal(unknownMethod.error.code, -32601);
  const unknownTool = await handleMessage({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "nope" } }, {});
  assert.equal(unknownTool.error.code, -32602);
});

test("a request-method sent as a notification (no id) gets no reply", async () => {
  // JSON-RPC 2.0: the server MUST NOT reply to a notification, even for a
  // known request-method like ping / tools/call.
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "ping" }, {}), null);
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "initialize", params: {} }, {}), null);
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "tools/call", params: { name: "audit" } }, {}), null);
});

test("an array (batch) message is rejected with a single -32600 Invalid Request", async () => {
  const res = await handleMessage([{ jsonrpc: "2.0", id: 1, method: "ping" }], {});
  assert.equal(res.error.code, -32600);
  assert.equal(res.id, null);
  const empty = await handleMessage([], {});
  assert.equal(empty.error.code, -32600);
});

test("tools/call surfaces a thrown command as isError:true, not a protocol error", async () => {
  // Inject a throwing command via the internal ctx.commands test seam.
  const res = await handleMessage(
    { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "audit", arguments: {} } },
    { defaultCwd: process.cwd(), commands: { audit: async () => { throw new Error("boom-xyz"); } } }
  );
  assert.equal(res.error, undefined); // a JSON-RPC result, not a protocol error
  assert.equal(res.result.isError, true);
  assert.match(res.result.content[0].text, /boom-xyz/);
});

test("graph tool: structuredContent always carries the graph; text follows the format", async () => {
  const res = await handleMessage(
    { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "graph", arguments: { cwd: repoRoot, format: "mermaid" } } },
    {}
  );
  assert.equal(res.result.isError, false);
  assert.equal(res.result.structuredContent.command, "graph");
  assert.ok(res.result.structuredContent.graph, "structuredContent carries the structured graph");
  assert.equal(res.result.structuredContent.text, undefined);
  assert.ok(res.result.content[0].text.startsWith("```mermaid"), "mermaid text rendering");
});

test("buildToolOptions maps args and defaults handoff/prompt to a claude agent", () => {
  const explain = TOOL_DEFS.find((t) => t.name === "explain");
  // explain maps `rule` -> findingRule and is not an agent-consuming tool.
  assert.deepEqual(buildToolOptions(explain, { rule: "wiki_link.missing" }), { findingRule: "wiki_link.missing" });
  const handoff = TOOL_DEFS.find((t) => t.name === "handoff");
  assert.deepEqual(buildToolOptions(handoff, {}).agents, ["claude"]);
  const prompt = TOOL_DEFS.find((t) => t.name === "prompt");
  assert.deepEqual(buildToolOptions(prompt, { task: "feature", agents: ["codex"] }).agents, ["codex"]);
});

// Spawn the MCP server, stream newline-delimited JSON-RPC, and collect messages.
// `until(byId, nullIdReplies)` resolves the wait; the caller ends stdin after.
async function driveMcpServer(lines, until) {
  const child = spawn(process.execPath, ["bin/llm-wiki.js", "mcp", "--cwd", repoRoot], { cwd: repoRoot });
  const byId = new Map();
  const nullIdReplies = [];
  let buf = "";
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("mcp round-trip timed out")), 20000);
    child.on("error", reject);
    child.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line);
        if (msg.id !== undefined && msg.id !== null) byId.set(msg.id, msg);
        else nullIdReplies.push(msg);
        if (until(byId, nullIdReplies)) {
          clearTimeout(timer);
          resolve();
        }
      }
    });
  });
  for (const obj of lines) child.stdin.write(`${JSON.stringify(obj)}\n`);
  try {
    await done;
    return { byId, nullIdReplies };
  } finally {
    child.stdin.end();
    await new Promise((resolve) => {
      const t = setTimeout(() => { try { child.kill(); } catch {} resolve(); }, 5000);
      child.on("close", () => { clearTimeout(t); resolve(); });
    });
  }
}

test("mcp stdio server: real JSON-RPC round-trip, and no reply to the notification", async () => {
  const { byId, nullIdReplies } = await driveMcpServer(
    [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {} } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "stats", arguments: {} } }
    ],
    (byId) => byId.has(1) && byId.has(2) && byId.has(3)
  );
  assert.equal(byId.get(1).result.serverInfo.name, "llm-wiki");
  assert.ok(byId.get(2).result.tools.length >= 10);
  assert.equal(byId.get(3).result.structuredContent.command, "stats");
  assert.equal(byId.get(3).result.structuredContent.schemaVersion, 1);
  // Responses are emitted in request order, so any spurious reply to the
  // notification would have arrived before id 3 — none must exist.
  assert.deepEqual(nullIdReplies, []);
});

test("mcp stdio server: recovers from a malformed line and keeps serving", async () => {
  const child = spawn(process.execPath, ["bin/llm-wiki.js", "mcp", "--cwd", repoRoot], { cwd: repoRoot });
  const messages = [];
  let buf = "";
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("parse-error round-trip timed out")), 20000);
    child.on("error", reject);
    child.stdout.on("data", (chunk) => {
      buf += chunk.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        messages.push(JSON.parse(line));
        if (messages.length >= 2) { clearTimeout(timer); resolve(); }
      }
    });
  });
  child.stdin.write("{ this is not valid json\n"); // malformed line -> -32700
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 42, method: "ping" })}\n`); // must still be served
  try {
    await done;
    const parseErr = messages.find((m) => m.error && m.error.code === -32700);
    const pong = messages.find((m) => m.id === 42);
    assert.ok(parseErr, "malformed line yields a -32700 Parse error response");
    assert.equal(parseErr.id, null);
    assert.ok(pong && pong.result, "a valid request after a parse error is still served");
  } finally {
    child.stdin.end();
    await new Promise((resolve) => {
      const t = setTimeout(() => { try { child.kill(); } catch {} resolve(); }, 5000);
      child.on("close", () => { clearTimeout(t); resolve(); });
    });
  }
});
