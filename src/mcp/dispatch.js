// MCP JSON-RPC message handler for the LLM-WIKI server (1.6).
//
// This module is transport-agnostic and side-effect-light: handleMessage(msg)
// takes one parsed JSON-RPC message and returns the response object (or null
// for notifications, which get no reply). src/mcp/server.js wires it to stdio.
// Keeping the dispatch pure makes the whole protocol layer unit-testable without
// spawning a process.
//
// Hand-rolled on purpose: MCP over stdio is newline-delimited JSON-RPC 2.0, and
// the message set we implement (initialize, tools/list, tools/call, ping) is
// small and stable. Implementing it with Node built-ins preserves the project's
// zero-runtime-dependency invariant (no @modelcontextprotocol/sdk).

import { commands, normalizeOptions } from "../index.js";
import { TOOL_DEFS, buildToolOptions } from "./tools.js";

// The MCP protocol version this server pins. On initialize we echo the client's
// requested version when it sends one (our message set is stable across recent
// versions), otherwise we advertise this.
export const MCP_PROTOCOL_VERSION = "2025-06-18";
// Protocol versions this server actually implements. On initialize we reply with
// the client's requested version only when it is one we support; otherwise we
// advertise our pinned version so the client can fall back (MCP lifecycle MUST).
const SUPPORTED_PROTOCOL_VERSIONS = new Set([MCP_PROTOCOL_VERSION]);
const SERVER_NAME = "llm-wiki";

const toolByName = new Map(TOOL_DEFS.map((tool) => [tool.name, tool]));

function jsonrpcResult(id, result) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function jsonrpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function negotiateVersion(requested) {
  return typeof requested === "string" && SUPPORTED_PROTOCOL_VERSIONS.has(requested)
    ? requested
    : MCP_PROTOCOL_VERSION;
}

function publicTool(tool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: { title: tool.title, readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  };
}

// Returns a JSON-RPC response object, or null when `msg` is a notification
// (a request with no id) that needs no reply.
export async function handleMessage(msg, ctx = {}) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
    return jsonrpcError(null, -32600, "Invalid Request");
  }
  const { id, method, params } = msg;
  const hasId = Object.prototype.hasOwnProperty.call(msg, "id") && id !== undefined && id !== null;

  if (typeof method !== "string") {
    return hasId ? jsonrpcError(id, -32600, "Invalid Request: missing method") : null;
  }

  // A notification is a request with no id; per JSON-RPC 2.0 the server MUST NOT
  // reply. Guard here so even known request-methods sent as notifications get no
  // response (initialize/ping/tools.* as notifications are non-conformant, but
  // we still must stay silent rather than emit an id:null reply).
  if (!hasId) return null;

  switch (method) {
    case "initialize":
      return jsonrpcResult(id, {
        protocolVersion: negotiateVersion(params && params.protocolVersion),
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: ctx.serverVersion ?? "0.0.0" },
        instructions:
          "Read-only LLM-WIKI tools. Use validate/audit/next/status/doctor to check the wiki, graph/stats to inspect it, explain to understand a finding rule, and handoff/prompt for agent workflows. No tool writes files."
      });

    case "ping":
      return jsonrpcResult(id, {});

    case "tools/list":
      return jsonrpcResult(id, { tools: TOOL_DEFS.map(publicTool) });

    case "tools/call":
      return await handleToolCall(id, params, ctx);

    default:
      // notifications/* (initialized, cancelled, progress, …) and any other
      // notification get no reply; unknown requests get method-not-found.
      if (method.startsWith("notifications/")) return null;
      if (!hasId) return null;
      return jsonrpcError(id, -32601, `Method not found: ${method}`);
  }
}

async function handleToolCall(id, params, ctx) {
  const name = params && params.name;
  const tool = typeof name === "string" ? toolByName.get(name) : undefined;
  if (!tool) {
    return jsonrpcError(id, -32602, `Unknown tool: ${typeof name === "string" ? name : "(missing name)"}`);
  }

  const args = params && params.arguments && typeof params.arguments === "object" ? params.arguments : {};

  try {
    const partial = buildToolOptions(tool, args);
    if (!partial.cwd && ctx.defaultCwd) partial.cwd = ctx.defaultCwd;
    const options = normalizeOptions(partial);
    // ctx.commands is an internal test seam (inject a throwing/stub command);
    // production always uses the real, frozen commands map.
    const registry = (ctx && ctx.commands) || commands;
    const result = await registry[tool.command](options);
    const { text, ...data } = result && typeof result === "object" ? result : {};
    return jsonrpcResult(id, {
      content: [{ type: "text", text: typeof text === "string" ? text : JSON.stringify(data, null, 2) }],
      structuredContent: data,
      isError: false
    });
  } catch (err) {
    // Tool execution errors are reported in the result with isError:true (MCP
    // convention), not as a JSON-RPC protocol error, so the agent sees them.
    return jsonrpcResult(id, {
      content: [{ type: "text", text: `Tool "${tool.name}" failed: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true
    });
  }
}
