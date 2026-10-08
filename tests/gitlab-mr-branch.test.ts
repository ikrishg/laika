import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createGitLabAdapter } from "../src/adapters/gitlab.js";

describe("P1: live GitLab MR creates branch commit first", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    delete process.env.LAIKA_DRY_RUN;
    delete process.env.GITLAB_TOKEN;
    delete process.env.GITLAB_PROJECT_ID;
  });

  it("posts repository commit before merge_requests", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("/repository/commits")) {
        return new Response(JSON.stringify({ id: "abc123" }), { status: 201 });
      }
      if (url.includes("/merge_requests")) {
        return new Response(
          JSON.stringify({
            iid: 7,
            web_url: "https://gitlab.com/acme/laika/-/merge_requests/7",
            source_branch: "laika/fix/incident-1",
            target_branch: "main",
          }),
          { status: 201 },
        );
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    process.env.LAIKA_DRY_RUN = "false";
    process.env.GITLAB_TOKEN = "test-token";
    process.env.GITLAB_PROJECT_ID = "123";
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.GITHUB_TOKEN;

    const gitlab = createGitLabAdapter(loadConfig());
    const mr = await gitlab.createFixMergeRequest(
      {
        title: "t",
        description: "d",
        sourceBranch: "laika/fix/incident-1",
        targetBranch: "main",
        patchSummary: "fixture patch",
      },
      "laika-agent:fix-writer",
    );

    expect(mr.dryRun).toBe(false);
    expect(calls.some((c) => c.includes("/repository/commits"))).toBe(true);
    expect(calls.some((c) => c.includes("/merge_requests"))).toBe(true);
    const commitIdx = calls.findIndex((c) => c.includes("/repository/commits"));
    const mrIdx = calls.findIndex((c) => c.includes("/merge_requests"));
    expect(commitIdx).toBeGreaterThanOrEqual(0);
    expect(mrIdx).toBeGreaterThan(commitIdx);
  });
});
