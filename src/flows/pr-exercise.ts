import type { GitHubAdapter } from "../adapters/github.js";
import type { GitLabAdapter } from "../adapters/gitlab.js";
import type { ObservabilityAdapter } from "../adapters/observability.js";
import type { PushFixResult } from "../adapters/push-result.js";
import { runHostileAgent } from "../agents/hostile-agent.js";
import { runUserAgent } from "../agents/user-agent.js";
import {
  buildFixProposalFromExercise,
  fixAgentActor,
  fixAgentSignature,
} from "../agents/fix-agent.js";
import { log } from "../adapters/logger.js";

export interface PrExerciseFlowInput {
  prNumber: number;
  targetAppUrl: string;
  /** Use GitHub working copy vs GitLab final home */
  forge?: "github" | "gitlab";
}

export interface PrExerciseFlowResult {
  flow: "pr-exercise";
  success: boolean;
  prNumber: number;
  userAgent: { signature: string; findingCount: number };
  hostileAgent: { signature: string; findingCount: number };
  /** True only when a commit was applied on the remote branch */
  fixPushed: boolean;
  fixDryRun: boolean;
  fixFailureReason?: string;
  observabilityPosted: boolean;
  humanMergeRequired: true;
}

function evaluatePushOutcome(push: PushFixResult): {
  success: boolean;
  fixPushed: boolean;
  fixDryRun: boolean;
  fixFailureReason?: string;
} {
  if (push.applied) {
    return { success: true, fixPushed: true, fixDryRun: false };
  }
  if (push.dryRun) {
    return {
      success: true,
      fixPushed: false,
      fixDryRun: true,
    };
  }
  return {
    success: false,
    fixPushed: false,
    fixDryRun: false,
    fixFailureReason: push.reason ?? "fix_not_applied",
  };
}

export async function runPrExerciseFlow(
  observability: ObservabilityAdapter,
  github: GitHubAdapter,
  gitlab: GitLabAdapter,
  input: PrExerciseFlowInput,
): Promise<PrExerciseFlowResult> {
  const fixActor = fixAgentActor();

  const forge = input.forge ?? "github";
  const pr =
    forge === "github"
      ? await github.getPullRequest(input.prNumber)
      : {
          number: input.prNumber,
          headRef: `mr-${input.prNumber}-head`,
          baseRef: "main",
          title: `MR !${input.prNumber}`,
        };

  const changeContext = `${forge} ${pr.title} (${pr.headRef} -> ${pr.baseRef})`;

  const userResult = await runUserAgent(input.targetAppUrl, changeContext);
  const hostileResult = await runHostileAgent(input.targetAppUrl, changeContext);

  log("info", "flow-pr-exercise", "Custom agents finished", {
    userSignature: userResult.harnessSignature,
    hostileSignature: hostileResult.harnessSignature,
    distinction: "Not GitLab Duo — laika user/hostile pair",
  });

  const proposal = buildFixProposalFromExercise(
    input.prNumber,
    hostileResult.findings,
    hostileResult.suggestedFix,
  );

  let push: PushFixResult;
  if (forge === "github") {
    push = await github.pushFixToPullRequestBranch(
      input.prNumber,
      proposal.patchSummary,
      fixActor,
    );
  } else {
    push = await gitlab.pushFixToBranch(
      pr.headRef,
      proposal.patchSummary,
      fixActor,
    );
  }

  const outcome = evaluatePushOutcome(push);

  await observability.recordEvent({
    type: outcome.success
      ? "pr_exercise_flow_complete"
      : "pr_exercise_flow_failed",
    flow: "pr-exercise",
    payload: {
      prNumber: input.prNumber,
      forge,
      userAgent: userResult,
      hostileAgent: hostileResult,
      fixProposal: {
        title: proposal.title,
        patchSummary: proposal.patchSummary,
      },
      fixPush: push,
      fixAgentSignature: fixAgentSignature(),
    },
    recordedAt: new Date().toISOString(),
  });

  return {
    flow: "pr-exercise",
    success: outcome.success,
    prNumber: input.prNumber,
    userAgent: {
      signature: userResult.harnessSignature,
      findingCount: userResult.findings.length,
    },
    hostileAgent: {
      signature: hostileResult.harnessSignature,
      findingCount: hostileResult.findings.length,
    },
    fixPushed: outcome.fixPushed,
    fixDryRun: outcome.fixDryRun,
    fixFailureReason: outcome.fixFailureReason,
    observabilityPosted: true,
    humanMergeRequired: true,
  };
}
