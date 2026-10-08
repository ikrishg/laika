import type { GitLabAdapter } from "../adapters/gitlab.js";
import type { ObservabilityAdapter, IncidentSignal } from "../adapters/observability.js";
import type { SlackAdapter } from "../adapters/slack.js";
import {
  buildFixProposalFromIncident,
  fixAgentActor,
  fixAgentSignature,
} from "../agents/fix-agent.js";
import { log } from "../adapters/logger.js";
import {
  buildDrillIncidentSignal,
  deriveIncidentSignalFromHealth,
} from "./incident-signal.js";

export interface ProdIncidentFlowInput {
  /** Optional injected signal; otherwise derived from health check */
  signal?: IncidentSignal;
  /** Explicit drill when target is healthy (env: LAIKA_INCIDENT_DRILL) */
  drill?: boolean;
}

export interface ProdIncidentFlowResult {
  flow: "prod-incident";
  success: boolean;
  skipped?: boolean;
  skipReason?: "healthy_no_signal";
  signal?: IncidentSignal;
  healthChecked: boolean;
  healthOk?: boolean;
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

  let signal: IncidentSignal | null = input.signal ?? null;
  if (!signal) {
    if (health.ok && !input.drill) {
      log("info", "flow-prod-incident", "Skipping — target healthy, no signal", {
        url: health.url,
      });
      await observability.recordEvent({
        type: "prod_incident_flow_skipped",
        flow: "prod-incident",
        payload: { reason: "healthy_no_signal", healthOk: true, url: health.url },
        recordedAt: new Date().toISOString(),
      });
      return {
        flow: "prod-incident",
        success: true,
        skipped: true,
        skipReason: "healthy_no_signal",
        healthChecked: true,
        healthOk: true,
        mergeRequestCreated: false,
        slackNotified: false,
        dryRunSlack: true,
        fixAgentSignature: fixAgentSignature(),
        humanMergeRequired: true,
      };
    }
    signal = input.drill
      ? buildDrillIncidentSignal(health)
      : deriveIncidentSignalFromHealth(health);
  }

  if (!signal) {
    throw new Error("No incident signal and health check did not indicate failure");
  }

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
      `Fix MR: ${mr.webUrl}${mr.dryRun ? " (dry-run fixture)" : ""}`,
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
      mrDryRun: mr.dryRun,
      slackDryRun: slackResult.dryRun,
    },
    recordedAt: new Date().toISOString(),
  });

  return {
    flow: "prod-incident",
    success: true,
    signal,
    healthChecked: true,
    healthOk: health.ok,
    mergeRequestCreated: true,
    mergeRequestUrl: mr.webUrl,
    slackNotified: slackResult.sent,
    dryRunSlack: slackResult.dryRun,
    fixAgentSignature: fixAgentSignature(),
    humanMergeRequired: true,
  };
}
