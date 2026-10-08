import type { HarnessConfig } from "../config/env.js";
import { log } from "./logger.js";

export interface PullRequestContext {
  number: number;
  headRef: string;
  baseRef: string;
  title: string;
}

export interface GitHubAdapter {
  getPullRequest(prNumber: number): Promise<PullRequestContext>;
  pushFixToPullRequestBranch(
    prNumber: number,
    commitMessage: string,
    actorId: string,
  ): Promise<{ commitSha: string; dryRun: boolean }>;
}

export function createGitHubAdapter(config: HarnessConfig): GitHubAdapter {
  const owner = config.githubOwner ?? "ikrishg";
  const repo = config.githubRepo ?? "laika";

  return {
    async getPullRequest(prNumber) {
      if (config.dryRun || !config.githubToken) {
        log("info", "github-adapter", "[DRY-RUN] Would fetch PR", { prNumber });
        return {
          number: prNumber,
          headRef: `laika/pr-${prNumber}-head`,
          baseRef: "main",
          title: `[dry-run] PR #${prNumber}`,
        };
      }

      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        {
          headers: {
            Authorization: `Bearer ${config.githubToken}`,
            Accept: "application/vnd.github+json",
          },
        },
      );

      if (!res.ok) {
        throw new Error(`GitHub PR fetch failed: ${res.status}`);
      }

      const data = (await res.json()) as {
        number: number;
        title: string;
        head: { ref: string };
        base: { ref: string };
      };

      return {
        number: data.number,
        headRef: data.head.ref,
        baseRef: data.base.ref,
        title: data.title,
      };
    },

    async pushFixToPullRequestBranch(prNumber, commitMessage, actorId) {
      const pr = await this.getPullRequest(prNumber);
      if (config.dryRun || !config.githubToken) {
        log("info", "github-adapter", "[DRY-RUN] Would push fix to PR branch", {
          actorId,
          prNumber,
          headRef: pr.headRef,
          commitMessage,
          distinction:
            "Custom laika fix-agent commit — supervised; human must merge",
        });
        return { commitSha: `dry-run-gh-${Date.now()}`, dryRun: true };
      }

      log("warn", "github-adapter", "Live git push not implemented in harness stub", {
        prNumber,
      });
      return { commitSha: "stub", dryRun: false };
    },
  };
}
