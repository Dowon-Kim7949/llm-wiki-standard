// MCP stdio server for LLM-WIKI (1.6).
//
// Thin transport wrapper around src/mcp/dispatch.js. Reads newline-delimited
// JSON-RPC 2.0 messages from stdin, hands each to handleMessage, and writes the
// JSON responses (newline-delimited) to stdout. Logs go to stderr only — stdout
// is the protocol channel and must carry nothing but JSON-RPC.
//
// Zero runtime dependencies: node:readline + process stdio + JSON.

import readline from "node:readline";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { handleMessage } from "./dispatch.js";

function readServerVersion() {
  try {
    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json");
    return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// Starts the stdio MCP server and resolves when stdin closes (client
// disconnect / EOF). `options.cwd` is the default project root for tool calls
// that do not specify their own cwd.
export async function startMcpServer(options = {}) {
  const ctx = {
    serverVersion: readServerVersion(),
    defaultCwd: options.cwd || process.cwd()
  };

  // Guard the protocol channel: any stray console.log from deep code would
  // corrupt the JSON-RPC stream, so route it to stderr for the server's life.
  const originalLog = console.log;
  console.log = (...args) => console.error(...args);

  const write = (obj) => {
    if (obj) process.stdout.write(`${JSON.stringify(obj)}\n`);
  };

  // If the client's read end closes, further writes raise an async EPIPE 'error'
  // event; swallow it so a vanished client does not crash the server with an
  // unhandled stream error (stdin EOF already drives graceful shutdown below).
  process.stdout.on("error", () => {});

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  process.stderr.write(`llm-wiki MCP server ready (v${ctx.serverVersion}); cwd=${ctx.defaultCwd}\n`);

  // Process lines strictly in order so responses are emitted in request order,
  // even though handling is async.
  let chain = Promise.resolve();
  rl.on("line", (line) => {
    chain = chain.then(() => onLine(line));
  });

  await new Promise((resolve) => {
    rl.on("close", () => {
      chain.then(resolve, resolve);
    });
  });

  console.log = originalLog;

  async function onLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }

    // No JSON-RPC batching: the pinned MCP protocol (2025-06-18) removed it, so
    // an array is an Invalid Request. handleMessage returns a single -32600 for
    // any array (covering the empty-array case too), so no special-casing here.
    write(await safeHandle(msg));
  }

  async function safeHandle(message) {
    try {
      return await handleMessage(message, ctx);
    } catch (err) {
      const id = message && typeof message === "object" && message.id !== undefined ? message.id : null;
      return {
        jsonrpc: "2.0",
        id: id ?? null,
        error: { code: -32603, message: `Internal error: ${err instanceof Error ? err.message : String(err)}` }
      };
    }
  }
}
