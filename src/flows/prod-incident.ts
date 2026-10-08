import type { GitLabAdapter } from "../adapters/gitlab.js";
import type { ObservabilityAdapter, IncidentSignal } from "../adapters/observability.js";
import type { SlackAdapter } from "../adapters/slack.js";
import {
  buildFixProposalFromIncident,
  fixAgentActor,
  fixAgentSignature,
} from "../agents/fix-agent.js";
import { log } from "../adapters/logger.js";

export interface ProdIncidentFlowInput {
  /** Optional injected signal; otherwise derived from health check */
  signal?: IncidentSignal;
}

export interface ProdIncidentFlowResult {
  flow: "prod-incident";
  signal: IncidentSignal;
  healthChecked: boolean;
  mergeRequestCreated: boolean;
  mergeRequestUrl?: string;
  slackNotified: boolean;
  dryRunSlack: boolean;
  fixAgentSignature: string;
  humanMergeRequired: true;
}

export async function runProdIncidentFlow(
  observability: ObservabilityAdapter,
  gitlab: GitLabAdapter,
  slack: SlackAdapter,
  input: ProdIncidentFlowInput = {},
): Promise<ProdIncidentFlowResult> {
  const actor = fixAgentActor();

  const health = await observability.checkHealth();
  const signal: IncidentSignal =
    input.signal ??
    ({
      kind: health.ok ? "error_rate" : "health_check_failed",
      source: "laika-observability-http",
      message: health.ok
        ? "Synthetic incident drill (health OK — dry-run path)"
        : `Health check failed: ${health.statusCode} ${health.bodySnippet}`,
      observedAt: new Date().toISOString(),
      metadata: { url: health.url, latencyMs: health.latencyMs },
    } satisfies IncidentSignal);

  await observability.ingestSignal(signal);

  log("info", "flow-prod-incident", "Observability lookup complete", {
    signal,
    healthOk: health.ok,
  });

  const proposal = buildFixProposalFromIncident(signal.message, health.url);
  const mr = await gitlab.createFixMergeRequest(
    {
      title: proposal.title,
      description: proposal.description,
      sourceBranch: proposal.sourceBranch,
      targetBranch: proposal.targetBranch,
      patchSummary: proposal.patchSummary,
    },
    actor,
  );

  const slackResult = await slack.notify({
    text: [
      ":rotating_light: *Laika Path B — supervised incident response*",
      `Signal: ${signal.kind} — ${signal.message}`,
      `Fix MR (fixture): ${mr.webUrl}`,
      "_Human must review and merge. Agents cannot deploy._",
      `Signature: ${fixAgentSignature()}`,
    ].join("\n"),
  });

  await observability.recordEvent({
    type: "prod_incident_flow_complete",
    flow: "prod-incident",
    payload: {
      signal,
      mrId: mr.id,
      mrUrl: mr.webUrl,
      slackDryRun: slackResult.dryRun,
    },
    recordedAt: new Date().toISOString(),
  });

  return {
    flow: "prod-incident",
    signal,
    healthChecked: true,
    mergeRequestCreated: true,
    mergeRequestUrl: mr.webUrl,
    slackNotified: slackResult.sent,
    dryRunSlack: slackResult.dryRun,
    fixAgentSignature: fixAgentSignature(),
    humanMergeRequired: true,
  };
}
