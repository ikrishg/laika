/** Sentry-style error event payload (subset of the Sentry event schema). */
export interface SentryStyleErrorEvent {
  event_id: string;
  timestamp: string;
  level: "fatal" | "error" | "warning";
  platform: string;
  environment: string;
  release?: string;
  message?: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{ filename: string; function?: string; lineno?: number }>;
      };
    }>;
  };
  request?: { method: string; url: string; status_code?: number };
  tags?: Record<string, string>;
}

export const ERROR_EVENT_FIXTURES: Record<string, SentryStyleErrorEvent> = {
  "sentry-sample-app-health-503": {
    event_id: "6f1c2a9e4b7d4c3f9a8e2d1b0c5f7a3e",
    timestamp: "2026-10-08T04:12:37.000Z",
    level: "error",
    platform: "node",
    environment: "fixture",
    release: "sample-app@0.0.0-fixture",
    message: "GET /health returned 503 simulated_outage",
    exception: {
      values: [
        {
          type: "ServiceUnavailable",
          value: "simulated_outage (SAMPLE_APP_ERROR=1)",
          stacktrace: {
            frames: [
              { filename: "examples/sample-app/server.js", function: "requestListener", lineno: 9 },
            ],
          },
        },
      ],
    },
    request: { method: "GET", url: "http://localhost:3456/health", status_code: 503 },
    tags: { service: "sample-app", route: "/health" },
  },
};

export const DEFAULT_ERROR_EVENT_FIXTURE = "sentry-sample-app-health-503";

export const GITLAB_MR_FIXTURE = {
  id: "gitlab-mr-draft-v1",
  projectPath: "fixture/laika-target",
  iid: 1,
  webUrlBase: "https://gitlab.example.invalid/fixture/laika-target/-/merge_requests",
} as const;
