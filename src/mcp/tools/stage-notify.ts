import { createHash } from "node:crypto";
import { z } from "zod";
import { log } from "../../adapters/logger.js";
import { resolveToolMode, type McpModeResolution } from "../mode.js";
import type { McpToolContext, StagedNotification } from "./context.js";

export const stageNotifyInput = {
  text: z.string().min(1),
  channel: z.string().optional().describe("Logical channel label (default #laika-incidents)"),
};

export interface StageNotifyArgs {
  text: string;
  channel?: string;
}

export interface StageNotifyResult {
  mode: McpModeResolution;
  staged: true;
  sent: false;
  webhookConfigured: boolean;
  notification: StagedNotification;
}

export function stageNotify(
  ctx: McpToolContext,
  args: StageNotifyArgs,
): StageNotifyResult {
  const mode = resolveToolMode("stage_notify", ctx.env);
  const stagedAt = ctx.now().toISOString();
  const channel = args.channel ?? "#laika-incidents";
  const notification: StagedNotification = {
    stagedId: `staged-${createHash("sha1").update(`${stagedAt}\n${channel}\n${args.text}`).digest("hex").slice(0, 12)}`,
    channel,
    text: args.text,
    stagedAt,
  };
  ctx.outbox.push(notification);

  const webhookConfigured = Boolean(ctx.env.SLACK_WEBHOOK_URL);
  log("info", "mcp:stage_notify", "[DRY-RUN] Slack notify staged (not sent)", {
    mode: mode.effective,
    stagedId: notification.stagedId,
    webhookConfigured,
  });

  return { mode, staged: true, sent: false, webhookConfigured, notification };
}
