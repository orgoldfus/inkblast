import type { Disease, ItemType, Player } from "../core/types";
import { DISEASE_LABELS, type ActiveEffect } from "../rules/pickups";
import { RULES } from "../rules/settings";

const POWER_UPS = {
  bomb: { label: "BOMB", description: "Carry one more active bomb" },
  flame: { label: "FLAME", description: "Increase your blast range" },
  goldflame: { label: "GOLD FLAME", description: "Reach maximum blast range" },
  skate: { label: "SKATES", description: "Move faster through corridors" },
  kick: {
    label: "KICK",
    description: "Walk into a bomb to kick it; Action stops it",
  },
  punch: {
    label: "PUNCH",
    description: "Face a bomb and press Action to launch it",
  },
  grab: {
    label: "GRAB",
    description: "Action picks up a nearby bomb; Action throws it",
  },
  spooge: {
    label: "LINE",
    description: "Action lays a line of your available bombs",
  },
  trigger: {
    label: "REMOTE",
    description: "Detonate remote bombs with Action",
  },
  jelly: { label: "BOUNCE", description: "Kicked bombs bounce off obstacles" },
  disease: {
    label: "DISEASE",
    description:
      "A temporary surprise: speed changes, reversed controls, automatic bombs and more",
  },
  superDisease: {
    label: "SUPER DISEASE",
    description: "Multiple temporary effects at once",
  },
  random: {
    label: "RANDOM",
    description: "A pickup from the map's eligible pool",
  },
} satisfies Record<ItemType, { label: string; description: string }>;

const EFFECTS = {
  slow: { icon: "effect-slow", label: "SLOW" },
  fast: { icon: "effect-fast", label: "FAST" },
  noBomb: { icon: "effect-no-bomb", label: "NO BOMBS" },
  autoBomb: { icon: "effect-auto-bomb", label: "LEAK" },
  weak: { icon: "effect-weak", label: "WEAK FIRE" },
  fastBomb: { icon: "effect-fast-bomb", label: "FAST LEAK" },
  shortFuse: { icon: "effect-short-fuse", label: "SHORT FUSE" },
  swap: { icon: "effect-swap", label: "SWAP" },
  reverse: { icon: "effect-reverse", label: "REVERSE" },
} satisfies Record<Disease, { icon: string; label: string }>;

export function inventoryIcon(item: string): string {
  return `<img src="${import.meta.env.BASE_URL}hud/${item}.webp" alt="" width="64" height="64" draggable="false">`;
}

export function itemGuideMarkup(): string {
  return Object.entries(POWER_UPS)
    .map(
      ([item, { label, description }]) =>
        `<p>${inventoryIcon(item)}<span><b>${label}</b>${description}.</span></p>`,
    )
    .join("");
}

function stat(item: "bomb" | "flame", value: number): string {
  const label = item === "bomb" ? "BOMBS" : "RANGE";
  const description = item === "bomb" ? "Bomb capacity" : "Flame range";
  const art = item === "flame" && value === RULES.maxRange ? "goldflame" : item;
  return `<div class="inventory-stat" role="group" aria-label="${description}: ${value}" title="${description}: ${value}">
    ${inventoryIcon(art)}<div class="inventory-count"><b>${value}</b><span>${label}</span></div>
  </div>`;
}

function powerUp(item: ItemType, label: string, description: string): string {
  return `<li class="inventory-power" data-item="${item}" title="${description}" aria-label="${description}">${inventoryIcon(item)}<span>${label}</span></li>`;
}

function temporaryEffect({ type }: ActiveEffect): string {
  const { icon, label } = EFFECTS[type];
  return `<li class="inventory-power inventory-effect" data-effect="${type}">${inventoryIcon(icon)}<span>${label}</span><span class="effect-time"></span></li>`;
}

export function pickupIconMarkup(item: ItemType, diseases: Disease[]): string {
  return diseases.includes("swap")
    ? inventoryIcon(EFFECTS.swap.icon)
    : inventoryIcon(item);
}

export function playerScoreMarkup(number: 1 | 2): string {
  return `<div class="player-score ${number === 1 ? "red" : "blue"}">
    <div class="player-heading">
      <span class="portrait" aria-hidden="true">${number}</span>
      <strong id="p${number}-name" class="player-name">${number === 1 ? "PLAYER ONE" : "THE COMPUTER"}</strong>
      <div id="p${number}-score" class="score-dots"></div>
    </div>
    <div id="p${number}-items" class="player-inventory" role="group" aria-label="Player ${number} inventory"></div>
    <div class="player-feedback"><output id="p${number}-pickup" class="pickup-notice" aria-label="Player ${number} pickup" aria-live="polite"></output></div>
  </div>`;
}

export function updatePlayerInventory(
  player: Player,
  effects: ActiveEffect[],
): void {
  const inventory = document.getElementById(`p${player.id + 1}-items`)!;
  const signature = [
    player.alive,
    player.capacity,
    player.range,
    player.speed,
    ...player.abilities,
    ...effects.map(({ type }) => type),
  ].join(":");
  if (inventory.dataset.inventory !== signature) {
    inventory.dataset.inventory = signature;
    inventory.classList.toggle("is-out", !player.alive);
    if (!player.alive) {
      inventory.innerHTML =
        '<span class="inventory-out">OUT <small>NICE TRY</small></span>';
      return;
    }
    const powers = Object.entries(POWER_UPS)
      .filter(([item]) => player.abilities.includes(item as ItemType))
      .map(([item, { label, description }]) =>
        powerUp(item as ItemType, label, description),
      );
    if (player.speed > 0) {
      powers.unshift(
        powerUp(
          "skate",
          `SPEED +${player.speed}`,
          `Speed upgrades: ${player.speed}`,
        ),
      );
    }
    powers.push(...effects.map(temporaryEffect));
    inventory.innerHTML = `${stat("bomb", player.capacity)}${stat("flame", player.range)}${
      powers.length
        ? `<ul class="inventory-powers" aria-label="Power-ups and active effects">${powers.join("")}</ul>`
        : '<span class="inventory-empty">NO POWER-UPS<span>Collect pickups</span></span>'
    }`;
  }
  for (const { type, seconds } of effects) {
    const badge = inventory.querySelector<HTMLElement>(
      `[data-effect="${type}"]`,
    )!;
    if (badge.dataset.seconds === String(seconds)) continue;
    badge.dataset.seconds = String(seconds);
    badge.querySelector(".effect-time")!.textContent = `${seconds}s`;
    badge.title = `${DISEASE_LABELS[type]} · ${seconds}s remaining`;
    badge.setAttribute("aria-label", badge.title);
  }
}
