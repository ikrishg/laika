/** Custom Laika agents — explicitly not GitLab Duo stock behavior. */

export const AGENT_IDS = {
  fix: "laika-agent:fix-writer",
  user: "laika-agent:user-simulator",
  hostile: "laika-agent:hostile-exerciser",
} as const;

export type AgentId = (typeof AGENT_IDS)[keyof typeof AGENT_IDS];

export interface AgentRunResult {
  agentId: AgentId;
  /** Marker proving custom harness logic ran */
  harnessSignature: string;
  summary: string;
  findings: string[];
  suggestedFix?: string;
}
