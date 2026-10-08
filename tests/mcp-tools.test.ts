import { afterEach, describe, expect, it, vi } from "vitest";
import { connectInProcess, type McpConnection } from "../src/mcp/client-adapters.js";
import { ERROR_EVENT_FIXTURES } from "../src/mcp/fixtures.js";
import { LAIKA_MCP_TOOLS } from "../src/mcp/server.js";
import { createToolContext } from "../src/mcp/tools/context.js";
import { createDraftMr, fixtureMrSha } from "../src/mcp/tools/create-draft-mr.js";
import { ingestErrorEvent } from "../src/mcp/tools/ingest-error-event.js";
import { stageNotify } from "../src/mcp/tools/stage-notify.js";

const MR_ARGS = {
  title: "Mitigate outage",
  description: "desc",
  sourceBranch: "laika/fix/incident-1",
  targetBranch: "main",
  patchSummary: "set SAMPLE_APP_ERROR=0",
  actorId: "laika-agent:fix-writer",
};

describe("ingest_error_event", () => {
  it("turns the default Sentry-style fixture into an incident signal", () => {
    const res = ingestErrorEvent(createToolContext({ env: {} }), {});
    expect(res.source).toBe("fixture");
    expect(res.fixtureId).toBe("sentry-sample-app-health-503");
    expect(res.signal.kind).toBe("health_check_failed");
    expect(res.signal.message).toContain("ServiceUnavailable");
    expect(res.signal.metadata?.eventId).toBe(res.event.event_id);
    expect(res.mode.effective).toBe("fixture");
  });

  it("accepts an inline event and classifies non-5xx as error_rate", () => {
    const base = ERROR_EVENT_FIXTURES["sentry-sample-app-health-503"]!;
    const res = ingestErrorEvent(createToolContext({ env: {} }), {
      event: { ...base, event_id: "inline-1", request: { method: "GET", url: "/x", status_code: 404 } },
    });
    expect(res.source).toBe("inline");
    expect(res.fixtureId).toBeNull();
    expect(res.signal.kind).toBe("error_rate");
  });

  it("rejects unknown fixture ids", () => {
    expect(() => ingestErrorEvent(createToolContext({ env: {} }), { fixtureId: "nope" })).toThrow(
      /Unknown error event fixture/,
    );
  });
});

describe("create_draft_mr", () => {
  it("records a draft fixture MR with a deterministic sha and a blocked merge gate", () => {
    const ctx = createToolContext({ env: {} });
    const a = createDraftMr(ctx, MR_ARGS);
    const b = createDraftMr(ctx, MR_ARGS);
    expect(a.draft).toBe(true);
    expect(a.title).toBe("Draft: Mitigate outage");
    expect(a.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(a.sha).toBe(b.sha);
    expect(a.sha).toBe(fixtureMrSha({ ...MR_ARGS, title: a.title }));
    expect(a.webUrl).toContain(".invalid/");
    expect(a.mergeGate).toMatchObject({ allowed: false, requiresHuman: true });
  });

  it("does not double-prefix Draft titles and changes sha with content", () => {
    const ctx = createToolContext({ env: {} });
    const a = createDraftMr(ctx, { ...MR_ARGS, title: "Draft: X" });
    expect(a.title).toBe("Draft: X");
    expect(createDraftMr(ctx, { ...MR_ARGS, patchSummary: "other" }).sha).not.toBe(
      createDraftMr(ctx, MR_ARGS).sha,
    );
  });
});

describe("stage_notify", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stages but never sends, even with a webhook and live requested", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const ctx = createToolContext({
      env: { LAIKA_MCP_LIVE: "1", SLACK_WEBHOOK_URL: "https://hooks.slack.invalid/x" },
    });
    const res = stageNotify(ctx, { text: "hello" });
    expect(res).toMatchObject({ staged: true, sent: false, webhookConfigured: true });
    expect(res.mode.effective).toBe("fixture");
    expect(ctx.outbox).toHaveLength(1);
    expect(ctx.outbox[0]).toMatchObject({ text: "hello", channel: "#laika-incidents" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("MCP server surface", () => {
  let conn: McpConnection | undefined;
  afterEach(async () => {
    await conn?.close();
    conn = undefined;
  });

  it("exposes exactly the three dry-run tools and nothing that merges, deploys, or pushes", async () => {
    conn = await connectInProcess(createToolContext({ env: {} }));
    const names = (await conn.client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([...LAIKA_MCP_TOOLS].sort());
    expect(names.some((n) => /merge|deploy|push/i.test(n))).toBe(false);
  });

  it("returns structured results over MCP", async () => {
    conn = await connectInProcess(createToolContext({ env: {} }));
    const res = await conn.client.callTool({ name: "create_draft_mr", arguments: MR_ARGS });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent).toMatchObject({ draft: true, mergeGate: { allowed: false } });
  });

  it("rejects a merge tool call and invalid input", async () => {
    conn = await connectInProcess(createToolContext({ env: {} }));
    const failed = async (name: string, args: Record<string, unknown>) => {
      try {
        const res = await conn!.client.callTool({ name, arguments: args });
        return Boolean(res.isError);
      } catch {
        return true;
      }
    };
    expect(await failed("merge_merge_request", { mrId: "1" })).toBe(true);
    expect(await failed("ingest_error_event", { event: { event_id: "x", level: "debug" } })).toBe(true);
    expect(await failed("create_draft_mr", { title: "t" })).toBe(true);
  });
});
