import { loadConfig } from "../config/env.js";
import type { ObservabilityEvent } from "../adapters/observability.js";
import { runProdIncidentFlow, type ProdIncidentFlowResult } from "../flows/prod-incident.js";
import { listBlockedActionsForAgents, type GateAction } from "../gates/policy.js";
import {
  callMcpTool,
  connectInProcess,
  createMcpGitLabAdapter,
  createMcpObservabilityAdapter,
  createMcpSlackAdapter,
  type McpCallRecord,
} from "./client-adapters.js";
import { createToolContext, type StagedNotification } from "./tools/context.js";
import type { CreateDraftMrResult } from "./tools/create-draft-mr.js";
import type { IngestErrorEventResult } from "./tools/ingest-error-event.js";

export interface McpProdIncidentOptions {
  env?: Record<string, string | undefined>;
  fixtureId?: string;
  /** Commit the run was executed from. */
  runSha?: string;
}

export interface McpProdIncidentRun {
  runSha: string;
  startedAt: string;
  finishedAt: string;
  toolSurface: string[];
  blockedForAgents: GateAction[];
  ingest: IngestErrorEventResult;
  draftMr: CreateDraftMrResult;
  stagedNotifications: StagedNotification[];
  calls: McpCallRecord[];
  observabilityEvents: ObservabilityEvent[];
  flow: ProdIncidentFlowResult;
}

export async function runProdIncidentViaMcp(
  options: McpProdIncidentOptions = {},
): Promise<McpProdIncidentRun> {
  const startedAt = new Date().toISOString();
  const ctx = createToolContext({ env: options.env ?? process.env });
  const conn = await connectInProcess(ctx);

  try {
    const toolSurface = (await conn.client.listTools()).tools.map((t) => t.name);
    const ingest = await callMcpTool<IngestErrorEventResult>(conn, "ingest_error_event", {
      ...(options.fixtureId ? { fixtureId: options.fixtureId } : {}),
    });

    const observability = createMcpObservabilityAdapter(loadConfig(), ingest.event);
    const flow = await runProdIncidentFlow(
      observability,
      createMcpGitLabAdapter(conn),
      createMcpSlackAdapter(conn),
      { signal: ingest.signal },
    );

    const draftMr = conn.calls.find((c) => c.tool === "create_draft_mr")
      ?.result as unknown as CreateDraftMrResult;

    return {
      runSha: options.runSha ?? "unknown",
      startedAt,
      finishedAt: new Date().toISOString(),
      toolSurface,
      blockedForAgents: listBlockedActionsForAgents(),
      ingest,
      draftMr,
      stagedNotifications: [...ctx.outbox],
      calls: conn.calls,
      observabilityEvents: await observability.getRecentEvents(),
      flow,
    };
  } finally {
    await conn.close();
  }
}
