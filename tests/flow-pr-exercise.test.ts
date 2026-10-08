import { describe, expect, it, afterAll } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createGitHubAdapter } from "../src/adapters/github.js";
import { createGitLabAdapter } from "../src/adapters/gitlab.js";
import { createObservabilityAdapter } from "../src/adapters/observability.js";
import { runPrExerciseFlow } from "../src/flows/pr-exercise.js";
import {
  startSampleApp,
  waitForHealth,
} from "./helpers/sample-app-server.js";

describe("flow 2: PR exercise (dry-run)", () => {
  const port = 3457;
  const baseUrl = `http://localhost:${port}`;
  const server = startSampleApp(port);

  afterAll(() => {
    server.kill();
  });

  it("runs user + hostile agents -> fix on branch -> observability", async () => {
    await waitForHealth(baseUrl);

    process.env.LAIKA_DRY_RUN = "true";
    process.env.TARGET_APP_URL = baseUrl;
    delete process.env.GITHUB_TOKEN;

    const config = loadConfig();
    const observability = createObservabilityAdapter(config);
    const github = createGitHubAdapter(config);
    const gitlab = createGitLabAdapter(config);

    const result = await runPrExerciseFlow(observability, github, gitlab, {
      prNumber: 42,
      targetAppUrl: config.targetAppUrl,
      forge: "github",
    });

    expect(result.flow).toBe("pr-exercise");
    expect(result.success).toBe(true);
    expect(result.userAgent.signature).toContain("laika-user-sim");
    expect(result.hostileAgent.signature).toContain("laika-hostile");
    expect(result.fixPushed).toBe(false);
    expect(result.fixDryRun).toBe(true);
    expect(result.humanMergeRequired).toBe(true);

    const events = await observability.getRecentEvents();
    const completed = events.find((e) => e.type === "pr_exercise_flow_complete");
    expect(completed).toBeDefined();
    const payload = completed!.payload as {
      userAgent: { harnessSignature: string; findings: string[] };
      hostileAgent: { harnessSignature: string; findings: string[] };
    };
    expect(payload.userAgent.harnessSignature).toContain("laika-user-sim");
    expect(payload.hostileAgent.harnessSignature).toContain("laika-hostile");
    expect(
      payload.userAgent.findings.some((f) => f.includes("User flow OK")),
    ).toBe(true);
    expect(
      payload.hostileAgent.findings.some((f) => f.includes("Hostile:")),
    ).toBe(true);
  });
});
