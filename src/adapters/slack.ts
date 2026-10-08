import type { HarnessConfig } from "../config/env.js";
import { log } from "./logger.js";

export interface SlackMessage {
  text: string;
  blocks?: unknown[];
}

export interface SlackAdapter {
  notify(message: SlackMessage): Promise<{ sent: boolean; dryRun: boolean }>;
}

export function createSlackAdapter(config: HarnessConfig): SlackAdapter {
  return {
    async notify(message: SlackMessage) {
      if (config.dryRun || !config.slackWebhookUrl) {
        log("info", "slack-adapter", "[DRY-RUN] Would post to Slack", {
          webhookConfigured: Boolean(config.slackWebhookUrl),
          preview: message.text.slice(0, 500),
        });
        return { sent: false, dryRun: true };
      }

      const res = await fetch(config.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });

      if (!res.ok) {
        throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
      }

      log("info", "slack-adapter", "Posted to Slack", { status: res.status });
      return { sent: true, dryRun: false };
    },
  };
}
