import { AGENT_IDS, type AgentRunResult } from "./types.js";

const SIGNATURE = "laika-user-sim-v1:happy-path-greet-api";

/**
 * Simulates a legitimate user exercising the changed API surface.
 * Distinct from GitLab Duo: deterministic scripted persona with harness signature.
 */
export async function runUserAgent(
  targetBaseUrl: string,
  changeContext: string,
): Promise<AgentRunResult> {
  const url = `${targetBaseUrl.replace(/\/$/, "")}/api/greet`;
  const findings: string[] = [];

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = await res.text();
    if (!res.ok) {
      findings.push(`User flow failed: GET /api/greet returned ${res.status}`);
    } else {
      findings.push(`User flow OK: ${body.slice(0, 120)}`);
    }
  } catch (e) {
    findings.push(
      `User flow error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  findings.push(`Context under test: ${changeContext}`);

  return {
    agentId: AGENT_IDS.user,
    harnessSignature: SIGNATURE,
    summary: "User-simulator completed happy-path API exercise",
    findings,
  };
}
