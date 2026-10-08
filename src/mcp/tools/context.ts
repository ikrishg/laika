export interface StagedNotification {
  stagedId: string;
  channel: string;
  text: string;
  stagedAt: string;
}

export interface McpToolContext {
  env: Record<string, string | undefined>;
  /** Staged Slack notifications; nothing in this layer ever delivers them. */
  outbox: StagedNotification[];
  now: () => Date;
}

export function createToolContext(
  overrides: Partial<McpToolContext> = {},
): McpToolContext {
  return {
    env: overrides.env ?? process.env,
    outbox: overrides.outbox ?? [],
    now: overrides.now ?? (() => new Date()),
  };
}
