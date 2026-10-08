import { describe, expect, it, vi, afterEach } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createGitLabAdapter } from "../src/adapters/gitlab.js";
import { createObservabilityAdapter } from "../src/adapters/observability.js";
import { createSlackAdapter } from "../src/adapters/slack.js";
import { runProdIncidentFlow } from "../src/flows/prod-incident.js";
import { resolveIncidentSignalFromHealth } from "../src/flows/incident-signal.js";

describe("P2: drill mode does not mask failed health", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LAIKA_DRY_RUN;
  });

  it("resolveIncidentSignalFromHealth prefers real failure over drill", () => {
    const failed = {
      url: "http://localhost/health",
      ok: false,
      statusCode: 503,
      bodySnippet: "down",
      latencyMs: 1,
      checkedAt: new Date().toISOString(),
    };
    const signal = resolveIncidentSignalFromHealth(failed, { drill: true });
    expect(signal?.kind).toBe("health_check_failed");
    expect(signal?.source).toBe("laika-observability-http");
    expect(signal?.source).not.toBe("laika-incident-drill");
  });

  it("runProdIncidentFlow with drill still reports health_check_failed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("unavailable", { status: 503 }),
    );

    process.env.LAIKA_DRY_RUN = "true";
    const config = loadConfig();
    const observability = createObservabilityAdapter(config);
    const gitlab = createGitLabAdapter(config);
    const slack = createSlackAdapter(config);

    const result = await runProdIncidentFlow(observability, gitlab, slack, {
      drill: true,
    });

    expect(result.success).toBe(true);
    expect(result.healthOk).toBe(false);
    expect(result.signal?.kind).toBe("health_check_failed");
    expect(result.signal?.source).toBe("laika-observability-http");
  });
});
