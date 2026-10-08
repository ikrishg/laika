import { assertAgentMayNotMergeOrDeploy } from "../gates/policy.js";

/** Call before any forge API that would merge an MR/PR. */
export function guardAgainstAgentMerge(actorId: string): void {
  assertAgentMayNotMergeOrDeploy(actorId, "merge_merge_request");
}
