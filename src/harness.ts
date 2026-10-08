import { loadConfig } from "./config/env.js";
import { createGitHubAdapter } from "./adapters/github.js";
import { createGitLabAdapter } from "./adapters/gitlab.js";
import {
  createObservabilityAdapter,
  type IncidentSignal,
} from "./adapters/observability.js";
import { createSlackAdapter } from "./adapters/slack.js";
import { runProdIncidentFlow } from "./flows/prod-incident.js";
import { runPrExerciseFlow } from "./flows/pr-exercise.js";

export type FlowName = "prod-incident" | "pr-exercise";

export interface HarnessRunOptions {
  flow: FlowName;
  prNumber?: number;
  incidentSignal?: IncidentSignal;
  forge?: "github" | "gitlab";
}

export async function runHarness(options: HarnessRunOptions) {
  const config = loadConfig();
  const observability = createObservabilityAdapter(config);
  const slack = createSlackAdapter(config);
  const gitlab = createGitLabAdapter(config);
  const github = createGitHubAdapter(config);

  if (options.flow === "prod-incident") {
    return runProdIncidentFlow(observability, gitlab, slack, {
      signal: options.incidentSignal,
      drill: config.incidentDrill,
    });
  }

  const prNumber = options.prNumber ?? 1;
  return runPrExerciseFlow(observability, github, gitlab, {
    prNumber,
    targetAppUrl: config.targetAppUrl,
    forge: options.forge,
  });
}

export { loadConfig } from "./config/env.js";
export * from "./gates/policy.js";
