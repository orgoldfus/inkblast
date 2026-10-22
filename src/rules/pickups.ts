import {
  TICK_RATE,
  type Disease,
  type ItemType,
  type Player,
} from "../core/types";

export const MYSTERY_RULES = {
  harmfulChance: 0.25,
  penaltyDuration: 7 * TICK_RATE,
  feedbackDuration: 3 * TICK_RATE,
  penalties: ["slow", "autoBomb", "weak", "reverse"] satisfies Disease[],
  fallbackItems: ["bomb", "flame", "skate"] satisfies ItemType[],
} as const;

const ITEM_LABELS: Record<ItemType, string> = {
  bomb: "EXTRA BOMB!",
  flame: "LONGER FLAMES!",
  goldflame: "MAXIMUM FLAMES!",
  skate: "SPEED UP!",
  kick: "BOMB KICK!",
  punch: "BOMB PUNCH!",
  grab: "BOMB GRAB!",
  spooge: "BOMB LINE!",
  trigger: "REMOTE BOMBS!",
  jelly: "BOUNCING BOMBS!",
  disease: "BAD LUCK!",
  superDisease: "DOUBLE TROUBLE!",
  random: "SURPRISE!",
};

export const DISEASE_LABELS: Record<Disease, string> = {
  slow: "SLOW MOTION",
  fast: "OUT OF CONTROL",
  noBomb: "NO BOMBS",
  autoBomb: "LEAKING BOMBS",
  weak: "WEAK FLAMES",
  fastBomb: "RAPID BOMB LEAK",
  shortFuse: "SHORT FUSES",
  swap: "POSITIONS SWAPPED",
  reverse: "REVERSED CONTROLS",
};

export interface ActiveEffect {
  type: Disease;
  seconds: number;
}

export function activeEffects(player: Player, tick: number): ActiveEffect[] {
  return player.alive
    ? player.diseases
        .filter((disease) => disease.until > tick)
        .map(({ type, until }) => ({
          type,
          seconds: Math.ceil((until - tick) / TICK_RATE),
        }))
    : [];
}

export function pickupFeedback(player: Player, tick: number) {
  const feedback = player.pickupFeedback;
  const effects = activeEffects(player, tick);
  return {
    effects,
    item:
      player.alive && feedback && feedback.until > tick ? feedback.item : null,
    notice:
      player.alive && feedback && feedback.until > tick
        ? feedback.diseases.length
          ? feedback.diseases
              .map((type) => `${DISEASE_LABELS[type]}!`)
              .join(" · ")
          : ITEM_LABELS[feedback.item]
        : "",
    harmful: Boolean(feedback?.diseases.length),
    countdown: effects
      .map(({ type, seconds }) => `${DISEASE_LABELS[type]} · ${seconds}s`)
      .join(" / "),
  };
}
