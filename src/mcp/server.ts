import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createDraftMr, createDraftMrInput } from "./tools/create-draft-mr.js";
import { ingestErrorEvent, ingestErrorEventInput } from "./tools/ingest-error-event.js";
import { stageNotify, stageNotifyInput } from "./tools/stage-notify.js";
import type { McpToolContext } from "./tools/context.js";
import type { McpToolName } from "./mode.js";

/** The complete tool surface. No merge, deploy, or push tool exists in this layer. */
export const LAIKA_MCP_TOOLS: readonly McpToolName[] = [
  "ingest_error_event",
  "create_draft_mr",
  "stage_notify",
];

function asToolResult<T extends object>(result: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    structuredContent: result as Record<string, unknown>,
  };
}

export function createLaikaMcpServer(ctx: McpToolContext): McpServer {
  const server = new McpServer({ name: "laika-dry-run", version: "0.1.0" });

  server.registerTool(
    "ingest_error_event",
    {
      title: "Ingest error event (observability)",
      description:
        "Ingest a Sentry-style error event from a fixture (or inline payload) and return an incident signal. Fixture-only in this build.",
      inputSchema: ingestErrorEventInput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (args) => asToolResult(ingestErrorEvent(ctx, args)),
  );

  server.registerTool(
    "create_draft_mr",
    {
      title: "Create draft MR (GitLab, fixture)",
      description:
        "Record a fixture GitLab draft merge request. Never calls GitLab and never merges; human merge required.",
      inputSchema: createDraftMrInput,
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async (args) => asToolResult(createDraftMr(ctx, args)),
  );

  server.registerTool(
    "stage_notify",
    {
      title: "Stage Slack notify",
      description:
        "Stage a Slack notification in the dry-run outbox. Never sends, even if SLACK_WEBHOOK_URL is set.",
      inputSchema: stageNotifyInput,
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async (args) => asToolResult(stageNotify(ctx, args)),
  );

  return server;
}
