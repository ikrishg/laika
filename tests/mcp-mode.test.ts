import { describe, expect, it } from "vitest";
import {
  LIVE_PATHS_ENABLED_IN_THIS_BUILD,
  resolveToolMode,
  type McpToolName,
} from "../src/mcp/mode.js";

const TOOLS: McpToolName[] = ["create_draft_mr", "stage_notify", "ingest_error_event"];

const ALL_CREDS = {
  GITLAB_TOKEN: "x",
  GITLAB_PROJECT_ID: "1",
  SLACK_WEBHOOK_URL: "https://hooks.slack.invalid/x",
  SENTRY_AUTH_TOKEN: "x",
  SENTRY_ORG: "o",
  SENTRY_PROJECT: "p",
};

describe("MCP fixture/live switch", () => {
  it("live paths are locked off in this build", () => {
    expect(LIVE_PATHS_ENABLED_IN_THIS_BUILD).toBe(false);
  });

  it.each(TOOLS)("%s is fixture when LAIKA_MCP_LIVE is unset, even with credentials", (tool) => {
    const mode = resolveToolMode(tool, { ...ALL_CREDS });
    expect(mode).toMatchObject({ requested: "fixture", effective: "fixture" });
  });

  it.each(TOOLS)("%s stays fixture when live is requested without credentials", (tool) => {
    const mode = resolveToolMode(tool, { LAIKA_MCP_LIVE: "1" }, true);
    expect(mode.requested).toBe("live");
    expect(mode.effective).toBe("fixture");
    expect(mode.reason).toMatch(/missing/);
  });

  it.each(TOOLS)("%s stays fixture in this build even with live requested and credentials", (tool) => {
    const mode = resolveToolMode(tool, { LAIKA_MCP_LIVE: "true", ...ALL_CREDS });
    expect(mode.effective).toBe("fixture");
    expect(mode.reason).toMatch(/disabled in this build/);
  });

  it("would go live only when requested, credentialed, and allowed by the build", () => {
    const env = { LAIKA_MCP_LIVE: "1", GITLAB_PRIVATE_TOKEN: "x", GITLAB_PROJECT_ID: "1" };
    expect(resolveToolMode("create_draft_mr", env, true).effective).toBe("live");
    expect(resolveToolMode("create_draft_mr", { ...env, GITLAB_PROJECT_ID: "" }, true).effective).toBe(
      "fixture",
    );
  });

  it("treats values other than 1/true as not requesting live", () => {
    expect(resolveToolMode("stage_notify", { LAIKA_MCP_LIVE: "yes", ...ALL_CREDS }, true).effective).toBe(
      "fixture",
    );
  });
});
