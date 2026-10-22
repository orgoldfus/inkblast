import { describe, expect, it } from "vitest";
import { runMatch, summarize } from "../scripts/balance-report";
import { SCHEMES, THEMES } from "../src/content/catalog";

describe("balance evaluator", () => {
  const scenario = {
    scheme: SCHEMES[0],
    theme: THEMES.find((theme) => theme.id === "hockey")!,
    seed: 41000,
    difficulties: ["normal", "hard"] as ["normal", "hard"],
    swapSpawns: false,
    seconds: 30,
    maxSeconds: 20,
  };

  it("replays the same seed and ignores planner invocation order", () => {
    const first = runMatch(scenario);
    expect(runMatch(scenario)).toEqual(first);
    expect(runMatch({ ...scenario, reversePlannerOrder: true })).toEqual(first);
  });

  it("keeps evaluator timeouts separate from finished draws", () => {
    const result = runMatch({ ...scenario, maxSeconds: 1 });
    expect(result.timeout).toBe(true);
    const report = summarize([result, { ...result, timeout: false }]);
    expect(report.timeouts).toBe(1);
    expect(report.draws).toBe(1);
    expect(report.seatWins).toEqual([0, 0]);
    expect(report.seat0DecisiveWinPercent).toBeNull();
  });

  it("counts physical spawn and player-id wins independently", () => {
    const result = runMatch(scenario);
    const report = summarize([
      { ...result, timeout: false, winner: 0, swapSpawns: false },
      { ...result, timeout: false, winner: 1, swapSpawns: true },
    ]);
    expect(report.seatWins).toEqual([1, 1]);
    expect(report.spawnWins).toEqual([2, 0]);
  });
});
