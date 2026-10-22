import {
  COLS,
  ROWS,
  type Cell,
  type Hazard,
  type ItemType,
  type Scheme,
  type Theme,
} from "../core/types";

export const ITEM_TYPES: ItemType[] = [
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
  "disease",
  "superDisease",
  "random",
];
export const ITEM_LABELS: Record<ItemType, string> = {
  bomb: "Extra bomb",
  flame: "Flame",
  goldflame: "Goldflame",
  skate: "Skates",
  kick: "Kick",
  punch: "Punch",
  grab: "Grab",
  spooge: "Spooge",
  trigger: "Trigger",
  jelly: "Jelly",
  disease: "Disease",
  superDisease: "Super disease",
  random: "Random",
};

const theme = (
  id: string,
  name: string,
  subtitle: string,
  colors: number[],
  hazard: Hazard,
  music: number,
): Theme => ({
  id,
  name,
  subtitle,
  floor: colors[0],
  floorAlt: colors[1],
  wall: colors[2],
  brick: colors[3],
  accent: colors[4],
  hazard,
  music,
});

// Names follow the extracted original messages; palettes and hazard placement are Inkblast adaptations.
export const THEMES: Theme[] = [
  theme(
    "green",
    "Green Acres",
    "Sunny turf · classic duel",
    [0x365850, 0x3d6256, 0x192d31, 0xc77440, 0xa6d96a],
    "none",
    0,
  ),
  theme(
    "classic",
    "Classic Green Acres",
    "Slate, orange brick & a short fuse",
    [0x34414e, 0x3c4a57, 0x172332, 0xd8773b, 0xffc24b],
    "none",
    1,
  ),
  theme(
    "hockey",
    "The Hockey Rink",
    "Slippery decisions · delayed steering",
    [0x527c92, 0x5c889b, 0x22394e, 0xa1d4dd, 0xb9f1ff],
    "delay",
    2,
  ),
  theme(
    "egypt",
    "Ancient Egypt",
    "Arrows redirect rolling bombs",
    [0x80603c, 0x8c6c42, 0x403321, 0xd5a356, 0xf5d773],
    "arrows",
    3,
  ),
  theme(
    "mine",
    "The Coal Mine",
    "Warp tunnels cross the arena",
    [0x3b3c4e, 0x454659, 0x20202c, 0x8b6985, 0xbd8cff],
    "warp",
    4,
  ),
  theme(
    "beach",
    "The Beach",
    "Hot sand · clear sightlines",
    [0x8d7850, 0x9a8556, 0x2d4855, 0xc98958, 0x65d8df],
    "none",
    5,
  ),
  theme(
    "aliens",
    "Aliens",
    "A cosmic comic confrontation",
    [0x3b385b, 0x474166, 0x242237, 0x8e5fab, 0xb9f15e],
    "none",
    6,
  ),
  theme(
    "haunted",
    "Haunted House",
    "Bricks grow back · keep moving",
    [0x414447, 0x4d5053, 0x232531, 0x82708c, 0x9ee5bd],
    "regenerate",
    7,
  ),
  theme(
    "ocean",
    "Under the Ocean",
    "Deep blue · bright explosions",
    [0x265467, 0x2e6275, 0x163441, 0xc97965, 0x72e2c4],
    "none",
    8,
  ),
  theme(
    "forest",
    "Deep Forest Green",
    "Trampolines launch surprise attacks",
    [0x33513f, 0x3c6048, 0x1a3028, 0x947046, 0xafe57b],
    "trampoline",
    9,
  ),
  theme(
    "city",
    "Inner City Trash",
    "Conveyor lanes carry players & bombs",
    [0x50505a, 0x5d5c66, 0x282833, 0xb66e4e, 0xf0cb4d],
    "conveyor",
    10,
  ),
];

const names = [
  "Classic Clash",
  "Crossfire",
  "Long Fuse",
  "Brick by Brick",
  "Ring Road",
  "Four Corners",
  "Split Decision",
  "Quick Draw",
  "Diamond District",
  "Switchback",
  "Grand Central",
  "Throwdown",
];
const descriptions = [
  "Pillars and short routes: the essential duel.",
  "An open central cross creates fast meetings.",
  "Long lanes reward careful blast timing.",
  "Dense demolition with several routes to open.",
  "A broad outer loop circles a busy center.",
  "Four rooms connect through generous doorways.",
  "Twin side lanes meet along the center.",
  "Less rubble, more immediate tactical space.",
  "A diamond of pillars gives cover without dead ends.",
  "Staggered walls turn long blasts into close combat.",
  "A spacious central hub links narrow approaches.",
  "Open throwing lanes with Punch and Grab from the start.",
];

function layout(kind: number): Cell[] {
  return Array.from({ length: COLS * ROWS }, (_, i): Cell => {
    const x = i % COLS,
      y = Math.floor(i / COLS);
    if (!x || !y || x === COLS - 1 || y === ROWS - 1) return "wall";
    let wall = x % 2 === 0 && y % 2 === 0;
    if (kind === 1) wall &&= x !== 6 && x !== 8 && y !== 4 && y !== 6;
    if (kind === 2) wall = (x === 4 || x === 10) && y >= 3 && y <= 7 && y !== 5;
    if (kind === 3) wall ||= x === 7 && (y === 3 || y === 7);
    if (kind === 4) wall &&= x >= 4 && x <= 10 && y >= 3 && y <= 7;
    if (kind === 5)
      wall =
        (x === 7 && y !== 3 && y !== 7) || (y === 5 && x !== 3 && x !== 11);
    if (kind === 6) wall = (x === 5 || x === 9) && y % 2 === 0;
    if (kind === 7 || kind === 11)
      wall = (x === 4 || x === 10) && (y === 4 || y === 6);
    if (kind === 8)
      wall = Math.abs(x - 7) + Math.abs(y - 5) === 4 && x % 2 === 0;
    if (kind === 9)
      wall = (y === 3 && x >= 4 && x <= 8) || (y === 7 && x >= 6 && x <= 10);
    if (kind === 10) wall &&= Math.abs(x - 7) > 2 || Math.abs(y - 5) > 2;
    if (wall) return "wall";
    if ((x <= 3 && y <= 2) || (x >= 11 && y >= 8)) return "floor";
    if (kind === 1 && (x === 7 || y === 5)) return "floor";
    if (kind === 4 && (x <= 2 || x >= 12 || y <= 2 || y >= 8)) return "floor";
    if (kind === 7 && (x + y) % 3 !== 0) return "floor";
    if (kind === 10 && Math.abs(x - 7) <= 2 && Math.abs(y - 5) <= 2)
      return "floor";
    if (kind === 11 && y % 2 === 1) return "floor";
    return "brick";
  });
}

export const SCHEMES: Scheme[] = names.map((name, i) => ({
  id: i === 0 ? "classic" : `duel-${i + 1}`,
  name,
  description: `${descriptions[i]} Inkblast duel adaptation; original layouts are not bundled.`,
  cells: layout(i),
  spawns: [
    { x: 1, y: 1 },
    { x: 13, y: 9 },
  ],
  density: [75, 65, 70, 100, 80, 70, 65, 45, 70, 75, 60, 55][i],
  startingItems: i === 11 ? { punch: 1, grab: 1, bomb: 2 } : {},
  itemPool: [...ITEM_TYPES],
  curated: true,
}));
