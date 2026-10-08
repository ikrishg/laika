import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { loadConfig } from "../src/config/env.js";
import { createGitHubAdapter } from "../src/adapters/github.js";
import { createGitLabAdapter } from "../src/adapters/gitlab.js";
import { createObservabilityAdapter } from "../src/adapters/observability.js";
import { runPrExerciseFlow } from "../src/flows/pr-exercise.js";

describe("flow 2: PR exercise (dry-run)", () => {
  let server: ChildProcess | null = null;

  beforeAll(async () => {
    const sampleDir = path.join(process.cwd(), "examples/sample-app");
    server = spawn("node", ["server.js"], {
      cwd: sampleDir,
      env: { ...process.env, PORT: "3457" },
      stdio: "pipe",
    });
    await new Promise((r) => setTimeout(r, 300));
  });

  afterAll(() => {
    server?.kill();
  });

  it("runs user + hostile agents -> fix on branch -> observability", async () => {
    process.env.LAIKA_DRY_RUN = "true";
    process.env.TARGET_APP_URL = "http://localhost:3457";
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
    expect(result.userAgent.signature).toContain("laika-user-sim");
    expect(result.hostileAgent.signature).toContain("laika-hostile");
    expect(result.fixPushed).toBe(true);
    expect(result.fixDryRun).toBe(true);
    expect(result.humanMergeRequired).toBe(true);

    const events = await observability.getRecentEvents();
    const completed = events.find((e) => e.type === "pr_exercise_flow_complete");
    expect(completed).toBeDefined();
    const payload = completed!.payload as {
      userAgent: { harnessSignature: string };
      hostileAgent: { harnessSignature: string };
    };
    expect(payload.userAgent.harnessSignature).toContain("laika-user-sim");
    expect(payload.hostileAgent.harnessSignature).toContain("laika-hostile");
  });
});
