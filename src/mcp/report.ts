import type { McpProdIncidentRun } from "./run-prod-incident.js";

function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function json(value: unknown): string {
  return `<pre class="json">${esc(JSON.stringify(value, null, 2))}</pre>`;
}

function row(label: string, value: string): string {
  return `<tr><th>${esc(label)}</th><td>${value}</td></tr>`;
}

function code(value: unknown): string {
  return `<code>${esc(value)}</code>`;
}

function modeBadge(mode: { effective: string; reason?: string }): string {
  return `<span class="badge">${esc(mode.effective)}</span> <span class="muted">${esc(mode.reason ?? "")}</span>`;
}

export function renderDryRunReport(run: McpProdIncidentRun): string {
  const ingestCall = run.calls.find((c) => c.tool === "ingest_error_event");
  const mrCall = run.calls.find((c) => c.tool === "create_draft_mr");
  const notifyCall = run.calls.find((c) => c.tool === "stage_notify");
  const staged = run.stagedNotifications[0];
  const ex = run.ingest.event.exception?.values[0];

  const steps = [
    { id: "overview", label: "Overview" },
    { id: "step-1", label: "1 · Error event" },
    { id: "step-2", label: "2 · Draft MR" },
    { id: "step-3", label: "3 · Staged Slack" },
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Laika MCP dry-run · AC-L1</title>
<style>
  :root { --bg:#0f1115; --panel:#171a21; --line:#2a2f3a; --fg:#e6e8ee; --muted:#8b93a7; --accent:#7aa2ff; --ok:#3ecf8e; --warn:#f5a524; }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; background:var(--bg); color:var(--fg); }
  header { padding:20px 28px; border-bottom:1px solid var(--line); }
  h1 { margin:0 0 6px; font-size:20px; }
  h2 { margin:0 0 12px; font-size:16px; }
  .banner { display:inline-block; background:#2b2310; color:var(--warn); border:1px solid #4a3a12; border-radius:6px; padding:3px 10px; font-size:12px; font-weight:600; letter-spacing:.02em; }
  .shas { display:flex; gap:24px; margin-top:12px; flex-wrap:wrap; }
  .sha { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:8px 12px; }
  .sha b { display:block; font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
  nav { display:flex; gap:4px; padding:0 28px; border-bottom:1px solid var(--line); background:#12151b; }
  nav a { color:var(--muted); text-decoration:none; padding:10px 14px; border-bottom:2px solid transparent; font-weight:500; }
  nav a.active { color:var(--fg); border-bottom-color:var(--accent); }
  main { padding:24px 28px; max-width:1100px; }
  section { display:none; }
  section.active { display:block; }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px 18px; margin-bottom:16px; }
  table { border-collapse:collapse; width:100%; }
  th { text-align:left; color:var(--muted); font-weight:500; width:200px; vertical-align:top; padding:5px 12px 5px 0; }
  td { padding:5px 0; word-break:break-all; }
  code { font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace; background:#0c0e12; border:1px solid var(--line); border-radius:4px; padding:1px 5px; }
  pre.json { font:12px ui-monospace,SFMono-Regular,Menlo,monospace; background:#0c0e12; border:1px solid var(--line); border-radius:8px; padding:12px; overflow:auto; max-height:360px; margin:0; }
  .badge { display:inline-block; background:#13261d; color:var(--ok); border:1px solid #1f4a34; border-radius:999px; padding:0 8px; font-size:12px; font-weight:600; }
  .badge.no { background:#2a1416; color:#ff7a85; border-color:#4a1f24; }
  .muted { color:var(--muted); }
  ol.path { margin:0; padding-left:20px; }
  ol.path li { margin:4px 0; }
  .slack { border-left:4px solid var(--accent); background:#0c0e12; border-radius:6px; padding:12px 14px; white-space:pre-wrap; font-size:13px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
</style>
</head>
<body>
<header>
  <h1>Laika Path B · MCP dry-run · AC-L1</h1>
  <span class="banner">DRY-RUN · FIXTURES ONLY · NOTHING SENT · NO MERGE · NO DEPLOY</span>
  <div class="shas">
    <div class="sha"><b>Run commit SHA</b><code data-testid="run-sha">${esc(run.runSha)}</code></div>
    <div class="sha"><b>Fixture MR SHA</b><code data-testid="mr-sha">${esc(run.draftMr.sha)}</code></div>
    <div class="sha"><b>Error event fixture</b><code>${esc(run.ingest.fixtureId ?? "inline")}</code></div>
  </div>
</header>
<nav>
  ${steps.map((s) => `<a href="#${s.id}" data-step="${s.id}">${esc(s.label)}</a>`).join("\n  ")}
</nav>
<main>
<section id="overview">
  <div class="panel">
    <h2>Click path: error event → fixture MR draft → staged Slack notify</h2>
    <ol class="path">
      <li><b>ingest_error_event</b> (observability MCP) — Sentry-style event ${code(run.ingest.event.event_id)} → signal ${code(run.ingest.signal.kind)}</li>
      <li><b>create_draft_mr</b> (GitLab MCP, fixture) — draft MR !${esc(run.draftMr.iid)} by ${code(run.draftMr.actorId)}, sha ${code(run.draftMr.sha.slice(0, 12))}</li>
      <li><b>stage_notify</b> (Slack MCP) — staged ${code(staged?.stagedId ?? "none")}, sent: <span class="badge no">false</span></li>
    </ol>
  </div>
  <div class="grid">
    <div class="panel">
      <h2>Flow result (existing prod-incident flow)</h2>
      <table>
        ${row("flow", code(run.flow.flow))}
        ${row("mergeRequestCreated", code(run.flow.mergeRequestCreated))}
        ${row("slackNotified (sent)", code(run.flow.slackNotified))}
        ${row("dryRunSlack", code(run.flow.dryRunSlack))}
        ${row("humanMergeRequired", code(run.flow.humanMergeRequired))}
        ${row("fixAgentSignature", code(run.flow.fixAgentSignature))}
      </table>
    </div>
    <div class="panel">
      <h2>Gates</h2>
      <table>
        ${row("MCP tool surface", run.toolSurface.map(code).join(" "))}
        ${row("Blocked for laika-agent:*", run.blockedForAgents.map(code).join(" "))}
        ${row("Merge gate (MR author)", `<span class="badge no">${run.draftMr.mergeGate.allowed ? "allowed" : "blocked"}</span> requiresHuman=${esc(run.draftMr.mergeGate.requiresHuman)}`)}
        ${row("Run window", `${esc(run.startedAt)} → ${esc(run.finishedAt)}`)}
      </table>
    </div>
  </div>
  <div class="panel muted">MIT target source not imported (gated per cut); <code>target/</code> is a placeholder and the event fixture models <code>examples/sample-app</code>. Live app URL and Slack notify remain gated.</div>
</section>

<section id="step-1">
  <div class="panel">
    <h2>Step 1 · ingest_error_event (observability)</h2>
    <table>
      ${row("mode", modeBadge(run.ingest.mode))}
      ${row("event_id", code(run.ingest.event.event_id))}
      ${row("level / env", `${code(run.ingest.event.level)} ${code(run.ingest.event.environment)}`)}
      ${row("exception", ex ? code(`${ex.type}: ${ex.value}`) : "—")}
      ${row("request", run.ingest.event.request ? code(`${run.ingest.event.request.method} ${run.ingest.event.request.url} → ${run.ingest.event.request.status_code ?? ""}`) : "—")}
      ${row("signal", code(`${run.ingest.signal.kind} · ${run.ingest.signal.message}`))}
    </table>
  </div>
  <div class="panel"><h2>MCP call</h2>${json({ args: ingestCall?.args, calledAt: ingestCall?.calledAt })}</div>
</section>

<section id="step-2">
  <div class="panel">
    <h2>Step 2 · create_draft_mr (GitLab, fixture)</h2>
    <table>
      ${row("mode", modeBadge(run.draftMr.mode))}
      ${row("title", code(run.draftMr.title))}
      ${row("draft / state", `${code(run.draftMr.draft)} ${code(run.draftMr.state)}`)}
      ${row("branches", code(`${run.draftMr.sourceBranch} → ${run.draftMr.targetBranch}`))}
      ${row("fixture MR SHA", code(run.draftMr.sha))}
      ${row("web URL (fixture)", code(run.draftMr.webUrl))}
      ${row("author", code(run.draftMr.actorId))}
      ${row("merge", `<span class="badge no">blocked for agent</span> human must review and merge`)}
    </table>
  </div>
  <div class="panel"><h2>MCP call args</h2>${json(mrCall?.args)}</div>
</section>

<section id="step-3">
  <div class="panel">
    <h2>Step 3 · stage_notify (Slack, staged)</h2>
    <table>
      ${row("mode", notifyCall ? modeBadge((notifyCall.result as { mode: { effective: string; reason?: string } }).mode) : "—")}
      ${row("staged", `<span class="badge">true</span>`)}
      ${row("sent", `<span class="badge no">false</span>`)}
      ${row("channel", code(staged?.channel ?? ""))}
      ${row("stagedId", code(staged?.stagedId ?? ""))}
      ${row("stagedAt", code(staged?.stagedAt ?? ""))}
    </table>
  </div>
  <div class="panel"><h2>Staged message preview</h2><div class="slack">${esc(staged?.text ?? "")}</div></div>
</section>
</main>
<script>
  function show() {
    var id = (location.hash || "#overview").slice(1);
    document.querySelectorAll("section").forEach(function (s) { s.classList.toggle("active", s.id === id); });
    document.querySelectorAll("nav a").forEach(function (a) { a.classList.toggle("active", a.dataset.step === id); });
  }
  window.addEventListener("hashchange", show);
  show();
</script>
</body>
</html>
`;
}
