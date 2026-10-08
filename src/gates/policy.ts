/**
 * Human gates: agents may propose MRs and post signals — never merge or deploy.
 */

export type GateAction =
  | "merge_merge_request"
  | "deploy_production"
  | "deploy_staging"
  | "push_to_protected_branch";

/** Agents may create/update MR branches; merging is a separate gated action. */
export type SupervisedAgentAction = "create_merge_request" | "push_fix_branch";

export class HumanGateViolation extends Error {
  readonly action: GateAction;
  readonly actor: string;

  constructor(action: GateAction, actor: string) {
    super(
      `Human gate blocked: agent "${actor}" attempted "${action}". Only humans may merge or deploy.`,
    );
    this.name = "HumanGateViolation";
    this.action = action;
    this.actor = actor;
  }
}

export interface GateCheckResult {
  allowed: boolean;
  action: GateAction;
  actor: string;
  requiresHuman: boolean;
}

const ALWAYS_BLOCKED_FOR_AGENTS: GateAction[] = [
  "merge_merge_request",
  "deploy_production",
  "deploy_staging",
  "push_to_protected_branch",
];

export function isAgentActor(actorId: string): boolean {
  return actorId.startsWith("laika-agent:") || actorId.startsWith("agent:");
}

export function assertAgentMayNotMergeOrDeploy(
  actorId: string,
  action: GateAction,
): void {
  if (!isAgentActor(actorId)) {
    return;
  }
  if (ALWAYS_BLOCKED_FOR_AGENTS.includes(action)) {
    throw new HumanGateViolation(action, actorId);
  }
}

export function checkGate(actorId: string, action: GateAction): GateCheckResult {
  if (isAgentActor(actorId) && ALWAYS_BLOCKED_FOR_AGENTS.includes(action)) {
    return {
      allowed: false,
      action,
      actor: actorId,
      requiresHuman: true,
    };
  }
  return {
    allowed: true,
    action,
    actor: actorId,
    requiresHuman: false,
  };
}

export function listBlockedActionsForAgents(): GateAction[] {
  return [...ALWAYS_BLOCKED_FOR_AGENTS];
}
