import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createGitHubAdapter } from "../src/adapters/github.js";
import { runPrExerciseFlow } from "../src/flows/pr-exercise.js";
import { createGitLabAdapter } from "../src/adapters/gitlab.js";
import { createObservabilityAdapter } from "../src/adapters/observability.js";

describe("P1: missing live fix reports failure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LAIKA_DRY_RUN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.SLACK_WEBHOOK_URL;
  });

  it("returns success=false when token is set but push is unsupported", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          number: 9,
          title: "test",
          head: { ref: "feature" },
          base: { ref: "main" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    process.env.LAIKA_DRY_RUN = "false";
    process.env.GITHUB_TOKEN = "gh-test-token";
    delete process.env.SLACK_WEBHOOK_URL;

    const config = loadConfig();
    const observability = createObservabilityAdapter(config);
    const github = createGitHubAdapter(config);
    const gitlab = createGitLabAdapter(config);

    const result = await runPrExerciseFlow(observability, github, gitlab, {
      prNumber: 9,
      targetAppUrl: "http://127.0.0.1:1",
      forge: "github",
    });

    expect(result.success).toBe(false);
    expect(result.fixPushed).toBe(false);
    expect(result.fixDryRun).toBe(false);
    expect(result.fixFailureReason).toBe("live_git_push_not_implemented");
  });
});
