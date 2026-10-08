import type { HarnessConfig } from "../config/env.js";
import { fetchWithTimeout } from "./http.js";
import { guardAgainstAgentMerge } from "./merge-guard.js";
import { log } from "./logger.js";
import {
  simulatedPush,
  unsupportedLivePush,
  type PushFixResult,
} from "./push-result.js";

export interface MergeRequestProposal {
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  /** Fixture diff content for dry-run demos */
  patchSummary: string;
}

export interface MergeRequestRef {
  id: string;
  webUrl: string;
  sourceBranch: string;
  targetBranch: string;
  dryRun: boolean;
}

export interface GitLabAdapter {
  createFixMergeRequest(
    proposal: MergeRequestProposal,
    actorId: string,
  ): Promise<MergeRequestRef>;
  pushFixToBranch(
    branch: string,
    commitMessage: string,
    actorId: string,
  ): Promise<PushFixResult>;
  mergeMergeRequest(
    mrId: string,
    actorId: string,
  ): Promise<never>;
}

async function createSupervisedFixCommit(
  baseUrl: string,
  projectId: string,
  token: string,
  proposal: MergeRequestProposal,
): Promise<string> {
  const filePath = `laika-fixes/${proposal.sourceBranch.replace(/\//g, "-")}.md`;
  const res = await fetchWithTimeout(
    `${baseUrl}/projects/${projectId}/repository/commits`,
    {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branch: proposal.sourceBranch,
        start_branch: proposal.targetBranch,
        commit_message: `[Laika supervised] ${proposal.patchSummary.slice(0, 72)}`,
        actions: [
          {
            action: "create",
            file_path: filePath,
            content: `# Laika supervised fixture\n\n${proposal.patchSummary}\n`,
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(
      `GitLab commit on branch failed: ${res.status} ${await res.text()}`,
    );
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export function createGitLabAdapter(config: HarnessConfig): GitLabAdapter {
  const baseUrl = process.env.GITLAB_API_URL ?? "https://gitlab.com/api/v4";

  return {
    async createFixMergeRequest(proposal, actorId) {
      const dryRunRef: MergeRequestRef = {
        id: `dry-run-mr-${Date.now()}`,
        webUrl: `https://gitlab.com/example/laika/-/merge_requests/0`,
        sourceBranch: proposal.sourceBranch,
        targetBranch: proposal.targetBranch,
        dryRun: true,
      };

      if (config.dryRun || !config.gitlabToken || !config.gitlabProjectId) {
        log("info", "gitlab-adapter", "[DRY-RUN] Would open GitLab MR (fixture)", {
          actorId,
          title: proposal.title,
          sourceBranch: proposal.sourceBranch,
          targetBranch: proposal.targetBranch,
          patchSummary: proposal.patchSummary,
          note: "Laika custom fix-agent — not GitLab Duo",
        });
        return dryRunRef;
      }

      const projectId = encodeURIComponent(config.gitlabProjectId);
      const commitSha = await createSupervisedFixCommit(
        baseUrl,
        projectId,
        config.gitlabToken,
        proposal,
      );

      log("info", "gitlab-adapter", "Created source branch commit", {
        branch: proposal.sourceBranch,
        commitSha,
      });

      const res = await fetchWithTimeout(
        `${baseUrl}/projects/${projectId}/merge_requests`,
        {
          method: "POST",
          headers: {
            "PRIVATE-TOKEN": config.gitlabToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: proposal.title,
            description: proposal.description,
            source_branch: proposal.sourceBranch,
            target_branch: proposal.targetBranch,
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`GitLab MR create failed: ${res.status} ${await res.text()}`);
      }

      const data = (await res.json()) as {
        iid: number;
        web_url: string;
        source_branch: string;
        target_branch: string;
      };

      log("info", "gitlab-adapter", "Created GitLab MR", { iid: data.iid });
      return {
        id: String(data.iid),
        webUrl: data.web_url,
        sourceBranch: data.source_branch,
        targetBranch: data.target_branch,
        dryRun: false,
      };
    },

    async pushFixToBranch(branch, commitMessage, actorId) {
      if (config.dryRun || !config.gitlabToken) {
        log("info", "gitlab-adapter", "[DRY-RUN] Would push commit to branch", {
          actorId,
          branch,
          commitMessage,
        });
        return simulatedPush(`dry-run-sha-${Date.now()}`);
      }

      log("warn", "gitlab-adapter", "Live push not implemented in harness stub", {
        branch,
      });
      return unsupportedLivePush("live_git_push_not_implemented");
    },

    async mergeMergeRequest(_mrId, actorId) {
      guardAgainstAgentMerge(actorId);
      throw new Error("Unreachable: merge guarded for agents");
    },
  };
}
