import { createHash } from "node:crypto";
import { z } from "zod";
import { checkGate, type GateCheckResult } from "../../gates/policy.js";
import { log } from "../../adapters/logger.js";
import { GITLAB_MR_FIXTURE } from "../fixtures.js";
import { resolveToolMode, type McpModeResolution } from "../mode.js";
import type { McpToolContext } from "./context.js";

export const createDraftMrInput = {
  title: z.string().min(1),
  description: z.string(),
  sourceBranch: z.string().min(1),
  targetBranch: z.string().min(1),
  patchSummary: z.string(),
  actorId: z.string().min(1),
};

export interface CreateDraftMrArgs {
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  patchSummary: string;
  actorId: string;
}

export interface CreateDraftMrResult {
  mode: McpModeResolution;
  fixtureId: string;
  draft: true;
  state: "opened";
  iid: number;
  title: string;
  webUrl: string;
  sourceBranch: string;
  targetBranch: string;
  /** Deterministic content hash of the fixture MR (sha1, git-style length). */
  sha: string;
  actorId: string;
  mergeGate: GateCheckResult;
}

export function fixtureMrSha(args: Omit<CreateDraftMrArgs, "actorId">): string {
  const canonical = JSON.stringify([
    GITLAB_MR_FIXTURE.id,
    args.title,
    args.description,
    args.sourceBranch,
    args.targetBranch,
    args.patchSummary,
  ]);
  return createHash("sha1").update(canonical).digest("hex");
}

export function createDraftMr(
  ctx: McpToolContext,
  args: CreateDraftMrArgs,
): CreateDraftMrResult {
  const mode = resolveToolMode("create_draft_mr", ctx.env);
  const title = args.title.startsWith("Draft: ") ? args.title : `Draft: ${args.title}`;
  const sha = fixtureMrSha({ ...args, title });

  const result: CreateDraftMrResult = {
    mode,
    fixtureId: GITLAB_MR_FIXTURE.id,
    draft: true,
    state: "opened",
    iid: GITLAB_MR_FIXTURE.iid,
    title,
    webUrl: `${GITLAB_MR_FIXTURE.webUrlBase}/${GITLAB_MR_FIXTURE.iid}`,
    sourceBranch: args.sourceBranch,
    targetBranch: args.targetBranch,
    sha,
    actorId: args.actorId,
    mergeGate: checkGate(args.actorId, "merge_merge_request"),
  };

  log("info", "mcp:create_draft_mr", "[DRY-RUN] Fixture draft MR recorded", {
    mode: mode.effective,
    actorId: args.actorId,
    sha,
    sourceBranch: args.sourceBranch,
    targetBranch: args.targetBranch,
  });

  return result;
}
