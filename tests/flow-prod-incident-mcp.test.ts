import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectInProcess,
  createMcpGitLabAdapter,
} from "../src/mcp/client-adapters.js";
import { renderDryRunReport } from "../src/mcp/report.js";
import { runProdIncidentViaMcp } from "../src/mcp/run-prod-incident.js";
import { createToolContext } from "../src/mcp/tools/context.js";
import { HumanGateViolation } from "../src/gates/policy.js";

describe("AC-L1: prod-incident flow through the MCP layer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("error event -> fixture draft MR -> staged Slack notify, with no network calls", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network disabled in test");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const run = await runProdIncidentViaMcp({
      runSha: "abc123",
      env: {
        LAIKA_MCP_LIVE: "1",
        SLACK_WEBHOOK_URL: "https://hooks.slack.invalid/x",
        GITLAB_TOKEN: "x",
        GITLAB_PROJECT_ID: "1",
      },
    });

    expect(run.calls.map((c) => c.tool)).toEqual([
      "ingest_error_event",
      "create_draft_mr",
      "stage_notify",
    ]);
    expect(run.flow).toMatchObject({
      flow: "prod-incident",
      success: true,
      mergeRequestCreated: true,
      slackNotified: false,
      dryRunSlack: true,
      humanMergeRequired: true,
    });
    expect(run.flow.skipped).toBeFalsy();
    expect(run.flow.signal?.message).toBe(run.ingest.signal.message);
    expect(run.draftMr.draft).toBe(true);
    expect(run.draftMr.actorId).toBe("laika-agent:fix-writer");
    expect(run.draftMr.mergeGate.allowed).toBe(false);
    expect(run.flow.mergeRequestUrl).toBe(run.draftMr.webUrl);
    expect(run.stagedNotifications).toHaveLength(1);
    expect(run.stagedNotifications[0]!.text).toContain(run.draftMr.webUrl);
    expect(run.observabilityEvents.some((e) => e.type === "prod_incident_flow_complete")).toBe(true);
    expect(run.blockedForAgents).toContain("merge_merge_request");
    expect(run.blockedForAgents).toContain("deploy_production");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("MCP-backed GitLab adapter cannot merge or push", async () => {
    const conn = await connectInProcess(createToolContext({ env: {} }));
    try {
      const gitlab = createMcpGitLabAdapter(conn);
      await expect(gitlab.mergeMergeRequest("1", "laika-agent:fix-writer")).rejects.toBeInstanceOf(
        HumanGateViolation,
      );
      await expect(gitlab.mergeMergeRequest("1", "human:krish")).rejects.toThrow(/not exposed/);
      await expect(gitlab.pushFixToBranch("main", "m", "laika-agent:fix-writer")).rejects.toThrow(
        /not exposed/,
      );
      expect(conn.calls).toHaveLength(0);
    } finally {
      await conn.close();
    }
  });

  it("renders a click-path report with both SHAs and escaped content", async () => {
    const run = await runProdIncidentViaMcp({ runSha: "<sha>", env: {} });
    const html = renderDryRunReport(run);
    expect(html).toContain("&lt;sha&gt;");
    expect(html).not.toContain("<sha>");
    expect(html).toContain(run.draftMr.sha);
    for (const id of ["overview", "step-1", "step-2", "step-3"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });
});
