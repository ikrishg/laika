import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createGitLabAdapter } from "../src/adapters/gitlab.js";
import { createObservabilityAdapter } from "../src/adapters/observability.js";
import { createSlackAdapter } from "../src/adapters/slack.js";
import { runProdIncidentFlow } from "../src/flows/prod-incident.js";

describe("P1: healthy target without signal skips incident", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LAIKA_DRY_RUN;
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.TARGET_APP_URL;
  });

  it("does not open MR or call Slack when health is OK", async () => {
    const slackNotify = vi.fn(async () => ({ sent: true, dryRun: false }));
    const createMr = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    process.env.LAIKA_DRY_RUN = "false";
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test";
    process.env.TARGET_APP_URL = "http://localhost:3999";

    const config = loadConfig();
    const observability = createObservabilityAdapter(config);
    const gitlab = createGitLabAdapter(config);
    const slack = createSlackAdapter(config);
    slack.notify = slackNotify;
    gitlab.createFixMergeRequest = createMr;

    const result = await runProdIncidentFlow(observability, gitlab, slack, {});

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("healthy_no_signal");
    expect(result.mergeRequestCreated).toBe(false);
    expect(slackNotify).not.toHaveBeenCalled();
    expect(createMr).not.toHaveBeenCalled();
  });
});
