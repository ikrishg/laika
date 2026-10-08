import { AGENT_IDS, type AgentRunResult } from "./types.js";

const SIGNATURE =
  "laika-hostile-v1:fuzz-headers-method-override-probe";

/**
 * Adversarial exerciser: malformed requests, method confusion, oversized paths.
 * This is custom harness logic — not stock Duo review.
 */
export async function runHostileAgent(
  targetBaseUrl: string,
  changeContext: string,
): Promise<AgentRunResult> {
  const base = targetBaseUrl.replace(/\/$/, "");
  const findings: string[] = [];
  let suggestedFix: string | undefined;

  const probes: { label: string; run: () => Promise<void> }[] = [
    {
      label: "oversized path",
      async run() {
        const res = await fetch(`${base}/${"x".repeat(400)}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.status >= 500) {
          findings.push("Hostile: oversized path triggered 5xx (should be 404)");
          suggestedFix =
            "Return 404 for unknown routes without throwing; add path length guard.";
        } else {
          findings.push(`Hostile: oversized path -> ${res.status} (acceptable)`);
        }
      },
    },
    {
      label: "invalid method on greet",
      async run() {
        try {
          const res = await fetch(`${base}/api/greet`, {
            method: "DELETE",
            signal: AbortSignal.timeout(3000),
          });
          if (res.status === 200) {
            findings.push("Hostile: DELETE allowed on greet endpoint");
            suggestedFix = "Reject non-GET methods on /api/greet with 405.";
          } else {
            findings.push(`Hostile: DELETE on greet -> ${res.status}`);
          }
        } catch {
          findings.push("Hostile: DELETE probe connection error");
        }
      },
    },
    {
      label: "sql-ish query string",
      async run() {
        const res = await fetch(`${base}/api/greet?id=1' OR '1'='1`, {
          signal: AbortSignal.timeout(3000),
        });
        findings.push(`Hostile: injection-style query -> ${res.status}`);
      },
    },
  ];

  for (const probe of probes) {
    try {
      await probe.run();
    } catch (e) {
      findings.push(
        `${probe.label} probe error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  findings.push(`Change context: ${changeContext}`);

  return {
    agentId: AGENT_IDS.hostile,
    harnessSignature: SIGNATURE,
    summary: "Hostile exerciser finished adversarial probes",
    findings,
    suggestedFix,
  };
}
