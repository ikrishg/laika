export interface HarnessConfig {
  dryRun: boolean;
  targetAppUrl: string;
  slackWebhookUrl: string | null;
  gitlabToken: string | null;
  gitlabProjectId: string | null;
  githubToken: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function loadConfig(): HarnessConfig {
  const slackWebhookUrl = env("SLACK_WEBHOOK_URL") ?? null;
  const targetAppUrl =
    env("TARGET_APP_URL") ?? "http://localhost:3456";
  const gitlabToken = env("GITLAB_TOKEN") ?? env("GITLAB_PRIVATE_TOKEN") ?? null;
  const githubToken = env("GITHUB_TOKEN") ?? env("GH_TOKEN") ?? null;

  const dryRun =
    process.env.LAIKA_DRY_RUN === "1" ||
    process.env.LAIKA_DRY_RUN === "true" ||
    (!slackWebhookUrl && !gitlabToken && !githubToken);

  return {
    dryRun,
    targetAppUrl,
    slackWebhookUrl,
    gitlabToken,
    gitlabProjectId: env("GITLAB_PROJECT_ID") ?? null,
    githubToken,
    githubOwner: env("GITHUB_OWNER") ?? env("GITHUB_REPOSITORY_OWNER") ?? null,
    githubRepo: env("GITHUB_REPO") ?? null,
  };
}
