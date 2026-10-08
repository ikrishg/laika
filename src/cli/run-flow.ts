import { runHarness, type FlowName } from "../harness.js";

const flow = process.argv[2] as FlowName | undefined;

if (!flow || (flow !== "prod-incident" && flow !== "pr-exercise")) {
  console.error("Usage: run-flow.ts <prod-incident|pr-exercise>");
  process.exit(1);
}

const prNumber = process.env.LAIKA_PR_NUMBER
  ? Number(process.env.LAIKA_PR_NUMBER)
  : undefined;

runHarness({ flow, prNumber })
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
