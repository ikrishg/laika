import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createGitLabAdapter } from "../src/adapters/gitlab.js";
import { createObservabilityAdapter } from "../src/adapters/observability.js";
import { createSlackAdapter } from "../src/adapters/slack.js";
import { runProdIncidentFlow } from "../src/flows/prod-incident.js";
import { clearLogBuffer } from "../src/adapters/logger.js";

describe("flow 1: prod incident (dry-run)", () => {
  it("runs observability -> fix MR -> slack without merge", async () => {
    clearLogBuffer();
    process.env.LAIKA_DRY_RUN = "true";
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.GITLAB_TOKEN;

    const config = loadConfig();
    expect(config.dryRun).toBe(true);

    const observability = createObservabilityAdapter(config);
    const gitlab = createGitLabAdapter(config);
    const slack = createSlackAdapter(config);

    const result = await runProdIncidentFlow(observability, gitlab, slack, {
      signal: {
        kind: "downtime",
        source: "test",
        message: "fixture outage for harness test",
        observedAt: new Date().toISOString(),
      },
    });

    expect(result.flow).toBe("prod-incident");
    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
    expect(result.mergeRequestCreated).toBe(true);
    expect(result.humanMergeRequired).toBe(true);
    expect(result.dryRunSlack).toBe(true);
    expect(result.fixAgentSignature).toContain("laika-fix-writer");

    const events = await observability.getRecentEvents();
    expect(events.some((e) => e.type === "prod_incident_flow_complete")).toBe(
      true,
    );
  });
});
