# Laika — Path B supervised watchdog harness

Working copy for the **GitLab Transcend** hackathon ([`ikrishg/laika`](https://github.com/ikrishg/laika) on GitHub; GitLab is the intended final home). This repo implements **Path B only**: supervised agents that may open or update merge requests and post observability events — **never** merge or deploy without a human.

Path A (fully autonomous merge/deploy) is explicitly out of scope.

## Signed flows (two)

### 1. Production downtime / error

```
Prod signal → observability lookup → fix-agent opens supervised MR (fixture) → Slack notify
```

1. HTTP health check against `TARGET_APP_URL` (or ingest a signal).
2. **fix-agent** builds a fixture MR proposal (GitLab adapter; dry-run logs when unconfigured).
3. Slack notification with MR link and explicit human-merge reminder.
4. Event recorded to the in-process observability sink (extend to your backend later).

### 2. New PR / MR exercise

```
New PR/MR → user-agent + hostile-agent exercise change → fix-agent pushes supervised fix to PR branch → observability
```

1. **user-agent** (`laika-user-sim-v1`) runs happy-path API calls.
2. **hostile-agent** (`laika-hostile-v1`) runs adversarial probes (oversized paths, bad methods, injection-style query strings).
3. **fix-agent** pushes a supervised fix commit to the PR branch (GitHub working copy adapter; GitLab adapter for final home).
4. Results posted to observability — **no merge**.

## Human gates

| Action | Agents | Humans |
|--------|--------|--------|
| Open / update MR, push to PR branch | Allowed (supervised) | Allowed |
| Merge MR | **Blocked** | Allowed |
| Deploy staging / production | **Blocked** | Allowed |
| Push to protected branch | **Blocked** | Allowed |

Gate logic lives in `src/gates/policy.ts` and is covered by `tests/gates.test.ts`.

## Kill test (when to stop building custom agents)

> If **stock GitLab Duo alone** reaches the same stages — observability triage, MR authoring, adversarial review, and notifications — **without** custom agents, **kill** this approach.

Laika stays valuable only when these pieces are **visibly distinct** from Duo:

- Explicit `laika-agent:*` identities and `laika-*-v1` harness signatures in logs and MR bodies.
- Paired **user** + **hostile** exercisers (Duo does not ship this dual-agent pattern in this harness).
- Hard **human gates** enforced in code (agents throw `HumanGateViolation` on merge/deploy attempts).

See `tests/agents-distinct.test.ts`.

## Repository layout

| Path | Purpose |
|------|---------|
| `target/` | Placeholder for the future MIT-licensed watched app (see `target/README.md`). |
| `examples/sample-app/` | Tiny HTTP app for local end-to-end runs today. |
| `src/adapters/` | GitLab, GitHub, Slack, observability — **dry-run** when env is missing. |
| `src/agents/` | Custom user, hostile, and fix agents. |
| `src/flows/` | Flow 1 and Flow 2 orchestration. |
| `tests/` | Gate tests + both flows in dry-run. |

## Configuration

| Variable | Purpose |
|----------|---------|
| `LAIKA_DRY_RUN` | `true` / `1` forces dry-run adapters (default when no tokens/webhook). |
| `TARGET_APP_URL` | Base URL for health + agent exercise (default `http://localhost:3456`). |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook; omitted → log-only dry-run. |
| `GITLAB_TOKEN` / `GITLAB_PRIVATE_TOKEN` | GitLab API token for MR creation. |
| `GITLAB_PROJECT_ID` | GitLab project id or URL-encoded path. |
| `GITLAB_API_URL` | Optional (default `https://gitlab.com/api/v4`). |
| `GITHUB_TOKEN` / `GH_TOKEN` | GitHub API for PR context / push dry-run. |
| `GITHUB_OWNER`, `GITHUB_REPO` | Repo coordinates (defaults `ikrishg` / `laika`). |
| `LAIKA_PR_NUMBER` | PR number for CLI flow 2. |
| `LAIKA_INCIDENT_DRILL` | `true` / `1` runs flow 1 against a **healthy** target (otherwise skipped). |

## Quick start

```bash
npm install
npm test
npm run build

# Terminal A — sample app
cd examples/sample-app && node server.js

# Terminal B — flows (dry-run)
npm run flow:prod-incident
LAIKA_PR_NUMBER=1 npm run flow:pr-exercise
```

Simulate unhealthy target:

```bash
SAMPLE_APP_ERROR=1 node examples/sample-app/server.js
TARGET_APP_URL=http://localhost:3456 npm run flow:prod-incident
```

## Importing the MIT target app (later)

1. Vendor the chosen app under `target/` with its `LICENSE` intact.
2. Point `TARGET_APP_URL` at the deployed instance.
3. Re-run both flows against real URLs; keep `LAIKA_DRY_RUN` until Slack and forge tokens are ready.

## Wiring Slack and live forge APIs

1. Create a Slack incoming webhook → set `SLACK_WEBHOOK_URL`.
2. GitLab: `GITLAB_TOKEN` + `GITLAB_PROJECT_ID` for MR creation on the final GitLab project.
3. GitHub: `GITHUB_TOKEN` for PR metadata in this working copy.
4. Unset `LAIKA_DRY_RUN` only when you intend live API calls. MR **merge** and **deploy** remain human-only regardless.

## License

MIT — see repository license. The future app under `target/` keeps its own license when imported.
