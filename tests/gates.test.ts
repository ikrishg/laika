import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createGitLabAdapter } from "../src/adapters/gitlab.js";
import {
  assertAgentMayNotMergeOrDeploy,
  checkGate,
  HumanGateViolation,
  listBlockedActionsForAgents,
} from "../src/gates/policy.js";

describe("human gates — no auto-merge or deploy", () => {
  it("blocks agents from merging MRs", () => {
    const result = checkGate("laika-agent:fix-writer", "merge_merge_request");
    expect(result.allowed).toBe(false);
    expect(result.requiresHuman).toBe(true);
  });

  it("blocks agents from production deploy", () => {
    expect(() =>
      assertAgentMayNotMergeOrDeploy(
        "laika-agent:hostile-exerciser",
        "deploy_production",
      ),
    ).toThrow(HumanGateViolation);
  });

  it("blocks agents from staging deploy and protected branch push", () => {
    for (const action of [
      "deploy_staging",
      "push_to_protected_branch",
    ] as const) {
      expect(checkGate("agent:custom", action).allowed).toBe(false);
    }
  });

  it("allows humans to merge (non-agent actor)", () => {
    expect(checkGate("human:alice", "merge_merge_request").allowed).toBe(true);
  });

  it("documents all blocked actions", () => {
    const blocked = listBlockedActionsForAgents();
    expect(blocked).toContain("merge_merge_request");
    expect(blocked).toContain("deploy_production");
  });

  it("rejects agent-side merge helper if invoked", () => {
    expect(() =>
      assertAgentMayNotMergeOrDeploy("laika-agent:fix-writer", "merge_merge_request"),
    ).toThrow(HumanGateViolation);
  });

  it("gitlab adapter refuses agent merge API", async () => {
    process.env.LAIKA_DRY_RUN = "true";
    const gitlab = createGitLabAdapter(loadConfig());
    await expect(
      gitlab.mergeMergeRequest("1", "laika-agent:fix-writer"),
    ).rejects.toThrow(HumanGateViolation);
  });
});
