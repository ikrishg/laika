export type McpToolName = "create_draft_mr" | "stage_notify" | "ingest_error_event";

export type McpMode = "fixture" | "live";

export interface McpModeResolution {
  tool: McpToolName;
  requested: McpMode;
  effective: McpMode;
  /** Why the tool is not live; absent only when effective === "live". */
  reason?: string;
}

/**
 * Live paths are locked off for this build: the signed cut gates live GitLab,
 * Slack notify, and the live app URL until the MIT source import lands.
 */
export const LIVE_PATHS_ENABLED_IN_THIS_BUILD = false;

type Env = Record<string, string | undefined>;

const LIVE_CREDENTIALS: Record<McpToolName, string[][]> = {
  create_draft_mr: [["GITLAB_TOKEN", "GITLAB_PRIVATE_TOKEN"], ["GITLAB_PROJECT_ID"]],
  stage_notify: [["SLACK_WEBHOOK_URL"]],
  ingest_error_event: [["SENTRY_AUTH_TOKEN"], ["SENTRY_ORG"], ["SENTRY_PROJECT"]],
};

function isSet(env: Env, name: string): boolean {
  const v = env[name];
  return v !== undefined && v.length > 0;
}

export function liveRequested(env: Env): boolean {
  return env.LAIKA_MCP_LIVE === "1" || env.LAIKA_MCP_LIVE === "true";
}

export function resolveToolMode(
  tool: McpToolName,
  env: Env = process.env,
  buildAllowsLive: boolean = LIVE_PATHS_ENABLED_IN_THIS_BUILD,
): McpModeResolution {
  if (!liveRequested(env)) {
    return {
      tool,
      requested: "fixture",
      effective: "fixture",
      reason: "LAIKA_MCP_LIVE unset",
    };
  }

  const missing = LIVE_CREDENTIALS[tool]
    .filter((anyOf) => !anyOf.some((name) => isSet(env, name)))
    .map((anyOf) => anyOf.join("|"));

  if (missing.length > 0) {
    return {
      tool,
      requested: "live",
      effective: "fixture",
      reason: `live requested but missing ${missing.join(", ")}`,
    };
  }

  if (!buildAllowsLive) {
    return {
      tool,
      requested: "live",
      effective: "fixture",
      reason: "live paths disabled in this build (gated by signed cut)",
    };
  }

  return { tool, requested: "live", effective: "live" };
}
