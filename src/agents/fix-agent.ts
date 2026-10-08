import { AGENT_IDS } from "./types.js";

const SIGNATURE = "laika-fix-writer-v1:supervised-mr-only";

export interface FixProposal {
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  patchSummary: string;
  rationale: string;
}

/**
 * Writes a supervised fix MR proposal from observability + agent findings.
 */
export function buildFixProposalFromIncident(
  incidentMessage: string,
  healthUrl: string,
): FixProposal {
  const branch = `laika/fix/incident-${Date.now()}`;
  return {
    title: `[Laika supervised] Mitigate: ${incidentMessage.slice(0, 80)}`,
    description: [
      "## Supervised fix (Path B)",
      "",
      "This MR was opened by the **Laika fix-agent**. A human must review and merge.",
      "",
      `Observed at: ${healthUrl}`,
      "",
      incidentMessage,
      "",
      `Harness signature: \`${SIGNATURE}\``,
    ].join("\n"),
    sourceBranch: branch,
    targetBranch: "main",
    patchSummary:
      "Fixture: set SAMPLE_APP_ERROR=0 in deployment config; add health retry.",
    rationale: "Restore /health 200 based on observability lookup.",
  };
}

export function buildFixProposalFromExercise(
  prNumber: number,
  hostileFindings: string[],
  suggestedFix?: string,
): FixProposal {
  const branch = `laika/fix/pr-${prNumber}-hardening`;
  return {
    title: `[Laika supervised] Hardening after user/hostile exercise (PR #${prNumber})`,
    description: [
      "## Supervised fix on PR branch",
      "",
      "Pushed by **Laika fix-agent** onto the PR branch. Human merge required.",
      "",
      "### Hostile findings",
      ...hostileFindings.map((f) => `- ${f}`),
      "",
      suggestedFix ? `### Suggested change\n${suggestedFix}` : "",
      "",
      `Harness signature: \`${SIGNATURE}\``,
    ]
      .filter(Boolean)
      .join("\n"),
    sourceBranch: branch,
    targetBranch: "main",
    patchSummary:
      suggestedFix ??
      "Fixture: return 405 for unsupported methods on /api/greet.",
    rationale: "Address hostile-agent findings without auto-merge.",
  };
}

export function fixAgentActor(): string {
  return AGENT_IDS.fix;
}

export function fixAgentSignature(): string {
  return SIGNATURE;
}
