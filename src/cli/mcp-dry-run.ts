import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runProdIncidentViaMcp } from "../mcp/run-prod-incident.js";
import { renderDryRunReport } from "../mcp/report.js";

function resolveRunSha(): string {
  if (process.env.LAIKA_RUN_SHA) {
    return process.env.LAIKA_RUN_SHA;
  }
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return "unknown";
  }
}

const outDir = resolve(process.env.LAIKA_REPORT_DIR ?? "reports");

runProdIncidentViaMcp({ runSha: resolveRunSha(), fixtureId: process.env.LAIKA_EVENT_FIXTURE })
  .then((run) => {
    mkdirSync(outDir, { recursive: true });
    const htmlPath = resolve(outDir, "ac-l1-dry-run.html");
    const jsonPath = resolve(outDir, "ac-l1-dry-run.json");
    writeFileSync(htmlPath, renderDryRunReport(run));
    writeFileSync(jsonPath, JSON.stringify(run, null, 2));
    console.log(
      JSON.stringify(
        {
          runSha: run.runSha,
          fixtureMrSha: run.draftMr.sha,
          toolSurface: run.toolSurface,
          slackSent: run.flow.slackNotified,
          stagedNotifications: run.stagedNotifications.length,
          report: htmlPath,
          json: jsonPath,
        },
        null,
        2,
      ),
    );
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
