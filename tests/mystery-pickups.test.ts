import { describe, expect, it } from "vitest";
import { applyItem, applyMysteryItem, plantBomb } from "../src/core/simulation";
import { botInput } from "../src/ai/bot";
import { TICK_RATE, type ItemType } from "../src/core/types";
import {
  activeEffects,
  MYSTERY_RULES,
  pickupFeedback,
} from "../src/rules/pickups";
import { normalizeSettings } from "../src/storage/storage";
import { advance, createTestGame } from "./core-fixture";

function mysteryGame() {
  const state = createTestGame();
  state.settings.mysteryPickups = true;
  state.players.forEach((player) => (player.invulnerableUntil = Infinity));
  return state;
}

describe("mystery pickups", () => {
  it("keeps separate timers for overlapping effects and removes expired or eliminated-player effects", () => {
    const player = mysteryGame().players[0];
    player.diseases = [
      { type: "slow", until: 7 * TICK_RATE },
      { type: "reverse", until: 12 * TICK_RATE },
      { type: "weak", until: TICK_RATE },
    ];
    expect(activeEffects(player, TICK_RATE)).toEqual([
      { type: "slow", seconds: 6 },
      { type: "reverse", seconds: 11 },
    ]);
    expect(activeEffects(player, 7 * TICK_RATE)).toEqual([
      { type: "reverse", seconds: 5 },
    ]);
    expect(activeEffects(player, 12 * TICK_RATE)).toEqual([]);
    player.alive = false;
    expect(activeEffects(player, TICK_RATE)).toEqual([]);
  });

  it("defaults older settings to on and preserves an explicit opt-out", () => {
    expect(normalizeSettings({}).mysteryPickups).toBe(true);
    expect(normalizeSettings({ mysteryPickups: false }).mysteryPickups).toBe(
      false,
    );
    expect(normalizeSettings({ mysteryPickups: "false" }).mysteryPickups).toBe(
      true,
    );
  });

  it("rolls about 75% helpful results reproducibly, even on disease-only maps", () => {
    const state = mysteryGame();
    state.scheme = { ...state.scheme, itemPool: ["disease"] };
    let harmful = 0;
    const outcomes: string[] = [];
    for (let count = 0; count < 10000; count++) {
      applyMysteryItem(state, state.players[0]);
      const feedback = state.players[0].pickupFeedback!;
      harmful += Number(feedback.item === "disease");
      outcomes.push(`${feedback.item}:${feedback.diseases.join()}`);
    }
    expect(harmful / 10000).toBeGreaterThan(0.23);
    expect(harmful / 10000).toBeLessThan(0.27);
    const replay = mysteryGame();
    replay.scheme = state.scheme;
    for (const expected of outcomes) {
      applyMysteryItem(replay, replay.players[0]);
      const feedback = replay.players[0].pickupFeedback!;
      expect(`${feedback.item}:${feedback.diseases.join()}`).toBe(expected);
    }
  });

  it("resolves on collection without using the hidden type; off restores known items", () => {
    const collect = (type: ItemType, enabled: boolean) => {
      const state = mysteryGame();
      state.settings.mysteryPickups = enabled;
      state.pickups = [{ x: 1, y: 1, type }];
      advance(state, 1);
      expect(state.pickups).toEqual([]);
      return state.players[0];
    };
    expect(collect("bomb", true)).toEqual(collect("superDisease", true));
    expect(collect("bomb", false).capacity).toBe(2);
    expect(collect("flame", false).range).toBe(3);
  });

  it("replaces penalties, counts down seven seconds, and restores normal behavior", () => {
    const state = mysteryGame();
    const player = state.players[0];
    for (let count = 0; count < 100; count++) {
      applyMysteryItem(state, player);
      expect(player.diseases.length).toBeLessThanOrEqual(1);
    }
    while (player.pickupFeedback?.item !== "disease")
      applyMysteryItem(state, player);
    expect(player.diseases[0].until).toBe(7 * TICK_RATE);
    expect(pickupFeedback(player, state.tick).notice).toMatch(/!$/);
    expect(pickupFeedback(player, state.tick).countdown).toMatch(/7s$/);
    advance(state, TICK_RATE);
    expect(pickupFeedback(player, state.tick).countdown).toMatch(/6s$/);
    advance(state, 6 * TICK_RATE);
    expect(player.diseases).toEqual([]);
    expect(pickupFeedback(player, state.tick).countdown).toBe("");
    expect(pickupFeedback(player, state.tick).notice).toBe("");
  });

  it("does not spread mystery penalties to the other player", () => {
    const state = mysteryGame();
    state.players[1].x = state.players[0].x;
    state.players[1].y = state.players[0].y;
    state.players[0].diseases = [
      { type: "slow", until: MYSTERY_RULES.penaltyDuration },
    ];
    advance(state, TICK_RATE);
    expect(state.players[1].diseases).toEqual([]);
  });

  it("keeps explicit item grants intact and reports their actual result", () => {
    const state = mysteryGame();
    applyItem(state, state.players[0], "skate");
    expect(state.players[0].speed).toBe(1);
    expect(pickupFeedback(state.players[0], state.tick).notice).toBe(
      "SPEED UP!",
    );
    state.scheme = {
      ...state.scheme,
      itemPool: ["random"],
      randomPool: ["kick"],
    };
    for (let i = 0; i < 50; i++) {
      applyMysteryItem(state, state.players[0]);
      expect(["kick", "disease"]).toContain(
        state.players[0].pickupFeedback?.item,
      );
    }
  });

  it("burns every mystery icon uniformly even when classic diseases are indestructible", () => {
    for (const enabled of [true, false]) {
      const state = mysteryGame();
      state.settings.mysteryPickups = enabled;
      state.settings.destroyDiseases = false;
      state.pickups = [{ x: 3, y: 1, type: "disease" }];
      plantBomb(state, state.players[0], 2, 1)!.fuse = 1;
      advance(state, 1);
      expect(state.pickups).toHaveLength(enabled ? 0 : 1);
    }
  });

  it.each(["easy", "normal", "hard"] as const)(
    "does not reveal hidden outcomes to the %s bot",
    (difficulty) => {
      const a = mysteryGame();
      const b = mysteryGame();
      a.pickups = [{ x: 2, y: 1, type: "bomb" }];
      b.pickups = [{ x: 2, y: 1, type: "disease" }];
      expect(botInput(a, 0, difficulty)).toEqual(botInput(b, 0, difficulty));
    },
  );
});
