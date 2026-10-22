import { applyItem, random } from "../core/simulation";
import type { GameState, ItemType } from "../core/types";

export type WinnerBonus =
  Exclude<ItemType, "disease" | "superDisease" | "random"> | "speedPenalty";
export const WINNER_BONUSES: readonly WinnerBonus[] = [
  "bomb",
  "flame",
  "goldflame",
  "skate",
  "kick",
  "punch",
  "grab",
  "spooge",
  "trigger",
  "jelly",
  "speedPenalty",
];
export const BONUS_LABELS: Record<WinnerBonus, string> = {
  bomb: "Extra bomb",
  flame: "Longer flame",
  goldflame: "Goldflame",
  skate: "Extra speed",
  kick: "Kick",
  punch: "Punch",
  grab: "Grab",
  spooge: "Spooge",
  trigger: "Trigger bombs",
  jelly: "Jelly bombs",
  speedPenalty: "Heavy boots · speed reduced",
};

export function awardWinnerBonus(
  state: GameState,
  playerId: 0 | 1,
  selected?: WinnerBonus,
): WinnerBonus {
  const player = state.players[playerId];
  const eligible = WINNER_BONUSES.filter((type) => {
    if (type === "trigger")
      return (
        !player.abilities.includes("jelly") &&
        !player.abilities.includes("trigger")
      );
    if (type === "jelly")
      return (
        !player.abilities.includes("trigger") &&
        !player.abilities.includes("jelly")
      );
    return !player.abilities.includes(type as ItemType);
  });
  const bonus =
    selected ?? eligible[Math.floor(random(state) * eligible.length)];
  if (bonus === "speedPenalty") player.speed = Math.max(-2, player.speed - 1);
  else applyItem(state, player, bonus);
  return bonus;
}
