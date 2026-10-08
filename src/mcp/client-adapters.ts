import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { HarnessConfig } from "../config/env.js";
import type { GitLabAdapter } from "../adapters/gitlab.js";
import { guardAgainstAgentMerge } from "../adapters/merge-guard.js";
import {
  createObservabilityAdapter,
  type HealthSnapshot,
  type ObservabilityAdapter,
} from "../adapters/observability.js";
import type { SlackAdapter } from "../adapters/slack.js";
import type { SentryStyleErrorEvent } from "./fixtures.js";
import type { McpToolName } from "./mode.js";
import { createLaikaMcpServer } from "./server.js";
import type { McpToolContext } from "./tools/context.js";
import type { CreateDraftMrResult } from "./tools/create-draft-mr.js";
import type { StageNotifyResult } from "./tools/stage-notify.js";

export interface McpCallRecord {
  tool: McpToolName;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  calledAt: string;
}

export interface McpConnection {
  client: Client;
  calls: McpCallRecord[];
  close(): Promise<void>;
}

export async function connectInProcess(ctx: McpToolContext): Promise<McpConnection> {
  const server = createLaikaMcpServer(ctx);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "laika-harness", version: "0.1.0" });
  await client.connect(clientTransport);
  return {
    client,
    calls: [],
    async close() {
      await client.close();
      await server.close();
    },
  };
}

export async function callMcpTool<T>(
  conn: McpConnection,
  tool: McpToolName,
  args: Record<string, unknown>,
): Promise<T> {
  const calledAt = new Date().toISOString();
  const res = await conn.client.callTool({ name: tool, arguments: args });
  if (res.isError) {
    const content = res.content as Array<{ type: string; text?: string }>;
    throw new Error(`MCP tool ${tool} failed: ${content.map((c) => c.text ?? "").join(" ")}`);
  }
  const result = res.structuredContent as Record<string, unknown>;
  conn.calls.push({ tool, args, result, calledAt });
  return result as T;
}

export function createMcpGitLabAdapter(conn: McpConnection): GitLabAdapter {
  return {
    async createFixMergeRequest(proposal, actorId) {
      const mr = await callMcpTool<CreateDraftMrResult>(conn, "create_draft_mr", {
        title: proposal.title,
        description: proposal.description,
        sourceBranch: proposal.sourceBranch,
        targetBranch: proposal.targetBranch,
        patchSummary: proposal.patchSummary,
        actorId,
      });
      return {
        id: `${mr.fixtureId}#${mr.iid}@${mr.sha.slice(0, 12)}`,
        webUrl: mr.webUrl,
        sourceBranch: mr.sourceBranch,
        targetBranch: mr.targetBranch,
      };
    },

    async pushFixToBranch() {
      throw new Error("push is not exposed by the Laika MCP layer");
    },

    async mergeMergeRequest(_mrId, actorId) {
      guardAgainstAgentMerge(actorId);
      throw new Error("merge is not exposed by the Laika MCP layer; merge in GitLab as a human");
    },
  };
}

export function createMcpSlackAdapter(conn: McpConnection): SlackAdapter {
  return {
    async notify(message) {
      await callMcpTool<StageNotifyResult>(conn, "stage_notify", { text: message.text });
      return { sent: false, dryRun: true };
    },
  };
}

/** Health comes from the ingested error event, so the MCP path never probes a live URL. */
export function createMcpObservabilityAdapter(
  config: HarnessConfig,
  event: SentryStyleErrorEvent,
): ObservabilityAdapter {
  const inner = createObservabilityAdapter({ ...config, dryRun: true });
  return {
    async checkHealth(): Promise<HealthSnapshot> {
      const status = event.request?.status_code ?? 0;
      return {
        url: event.request?.url ?? `sentry-event:${event.event_id}`,
        ok: status > 0 && status < 400,
        statusCode: status,
        bodySnippet: (event.message ?? "").slice(0, 200),
        latencyMs: 0,
        checkedAt: event.timestamp,
      };
    },
    ingestSignal: (signal) => inner.ingestSignal(signal),
    recordEvent: (e) => inner.recordEvent(e),
    getRecentEvents: () => inner.getRecentEvents(),
  };
}
