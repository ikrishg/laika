import { describe, expect, it } from "vitest";
import { fixAgentSignature } from "../src/agents/fix-agent.js";
import { AGENT_IDS } from "../src/agents/types.js";

/**
 * Kill test helper: custom agents must be identifiable vs stock GitLab Duo.
 */
describe("kill test — custom agents vs Duo", () => {
  it("uses laika-prefixed agent IDs and harness signatures", () => {
    expect(AGENT_IDS.user).toBe("laika-agent:user-simulator");
    expect(AGENT_IDS.hostile).toBe("laika-agent:hostile-exerciser");
    expect(AGENT_IDS.fix).toBe("laika-agent:fix-writer");
    expect(fixAgentSignature()).toMatch(/^laika-fix-writer/);
  });

  it("does not reference GitLab Duo in agent identifiers", () => {
    const ids = Object.values(AGENT_IDS).join(" ");
    expect(ids.toLowerCase()).not.toContain("duo");
  });
});
