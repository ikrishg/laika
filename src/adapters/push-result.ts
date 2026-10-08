export interface PushFixResult {
  /** True only when a commit was written to the remote branch */
  applied: boolean;
  dryRun: boolean;
  commitSha?: string;
  reason?: string;
}

export function simulatedPush(commitSha: string): PushFixResult {
  return {
    applied: false,
    dryRun: true,
    commitSha,
    reason: "dry_run_simulation",
  };
}

export function unsupportedLivePush(reason: string): PushFixResult {
  return {
    applied: false,
    dryRun: false,
    reason,
  };
}
