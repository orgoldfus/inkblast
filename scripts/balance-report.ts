import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { botInput } from "../src/ai/bot";
import { SCHEMES, THEMES } from "../src/content/catalog";
import { createGame, stepGame } from "../src/core/simulation";
import {
  TICK_RATE,
  cellOf,
  type InputFrame,
  type MatchSettings,
  type Scheme,
  type Theme,
} from "../src/core/types";
import { DEFAULT_SETTINGS } from "../src/rules/settings";

type Difficulty = MatchSettings["difficulty"];
const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

function mixedSeed(value: number): number {
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

export interface MatchCase {
  scheme: Scheme;
  theme: Theme;
  seed: number;
  difficulties: [Difficulty, Difficulty];
  swapSpawns: boolean;
  seconds?: number;
  maxSeconds?: number;
  reversePlannerOrder?: boolean;
}

export function runMatch(test: MatchCase) {
  const seconds = test.seconds ?? 60;
  const state = createGame(
    test.scheme,
    test.theme,
    {
      ...DEFAULT_SETTINGS,
      mode: "local",
      roundSeconds: seconds,
      enclosureDepth: 4,
      randomStarts: false,
      winnerBonus: false,
    },
    test.seed,
  );
  if (test.swapSpawns) {
    const [a, b] = state.players;
    [a.x, b.x] = [b.x, a.x];
    [a.y, b.y] = [b.y, a.y];
    [a.direction, b.direction] = [b.direction, a.direction];
  }
  state.phase = "active";
  const plants = [0, 0],
    actionPresses = [0, 0],
    stationaryTicks = [0, 0],
    longestStationary = [0, 0];
  const previousAction = [false, false];
  const deaths: {
    player: number;
    cause: "self" | "opponent" | "environment";
  }[] = [];
  let activeTicks = 0,
    longestWithoutPlant = 0,
    withoutPlant = 0,
    clockReached = false;
  const cap = (test.maxSeconds ?? seconds + 60) * TICK_RATE;
  for (
    let tick = 0;
    tick < cap && (state.phase as string) !== "finished";
    tick++
  ) {
    const active = state.phase === "active";
    const before = state.players.map((player) => ({
      x: player.x,
      y: player.y,
      alive: player.alive,
    }));
    const inputs: [InputFrame, InputFrame] = [
      { direction: null, bomb: false, action: false },
      { direction: null, bomb: false, action: false },
    ];
    for (const id of test.reversePlannerOrder
      ? ([1, 0] as const)
      : ([0, 1] as const))
      inputs[id] = botInput(state, id, test.difficulties[id]);
    stepGame(state, inputs);
    for (const event of state.events.filter(
      (event) => event.type === "death",
    )) {
      const player = state.players[event.player!];
      const flame = state.flames.find(
        (flame) => flame.x === cellOf(player.x) && flame.y === cellOf(player.y),
      );
      deaths.push({
        player: player.id,
        cause: flame
          ? flame.owner === player.id
            ? "self"
            : "opponent"
          : "environment",
      });
    }
    if (!active) continue;
    activeTicks++;
    clockReached ||= state.remaining === 0;
    const planted = state.events.filter((event) => event.type === "plant");
    withoutPlant = planted.length ? 0 : withoutPlant + 1;
    longestWithoutPlant = Math.max(longestWithoutPlant, withoutPlant);
    for (const id of [0, 1] as const) {
      plants[id] += planted.filter((event) => event.player === id).length;
      actionPresses[id] += Number(inputs[id].action && !previousAction[id]);
      previousAction[id] = inputs[id].action;
      if (!before[id].alive) continue;
      stationaryTicks[id] =
        before[id].x === state.players[id].x &&
        before[id].y === state.players[id].y
          ? stationaryTicks[id] + 1
          : 0;
      longestStationary[id] = Math.max(
        longestStationary[id],
        stationaryTicks[id],
      );
    }
  }
  return {
    map: test.scheme.id,
    theme: test.theme.id,
    seed: test.seed,
    difficulties: test.difficulties,
    swapSpawns: test.swapSpawns,
    winner: state.winner,
    timeout: (state.phase as string) !== "finished",
    clockReached,
    seconds: state.tick / TICK_RATE,
    activeSeconds: activeTicks / TICK_RATE,
    plants,
    actionPresses,
    deaths,
    longestStationarySeconds: longestStationary.map(
      (ticks) => ticks / TICK_RATE,
    ),
    longestWithoutPlantSeconds: longestWithoutPlant / TICK_RATE,
    digest: createHash("sha256")
      .update(JSON.stringify(state))
      .digest("hex")
      .slice(0, 16),
  };
}

type Result = ReturnType<typeof runMatch>;
const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const rounded = (value: number) => Math.round(value * 100) / 100;

export function summarize(results: Result[]) {
  const finished = results.filter((result) => !result.timeout);
  const decisive = finished.filter((result) => result.winner !== null);
  const lengths = results.map((result) => result.seconds).sort((a, b) => a - b);
  return {
    matches: results.length,
    seatWins: [0, 1].map(
      (id) => decisive.filter((result) => result.winner === id).length,
    ),
    spawnWins: [0, 1].map(
      (spawn) =>
        decisive.filter(
          (result) =>
            (result.swapSpawns ? 1 - result.winner! : result.winner) === spawn,
        ).length,
    ),
    draws: finished.length - decisive.length,
    timeouts: results.length - finished.length,
    reachedClock: results.filter((result) => result.clockReached).length,
    medianSeconds: rounded(lengths[Math.floor(lengths.length / 2)]),
    p90Seconds: rounded(
      lengths[Math.min(lengths.length - 1, Math.floor(lengths.length * 0.9))],
    ),
    minSeconds: rounded(lengths[0]),
    maxSeconds: rounded(lengths.at(-1)!),
    meanSeconds: rounded(mean(lengths)),
    meanPlants: rounded(
      mean(results.map((result) => result.plants[0] + result.plants[1])),
    ),
    bombActionPresses: results.reduce(
      (sum, result) => sum + result.actionPresses[0] + result.actionPresses[1],
      0,
    ),
    inferredDeaths: results.every((result) => Array.isArray(result.deaths))
      ? Object.fromEntries(
          ["self", "opponent", "environment"].map((cause) => [
            cause,
            results.reduce(
              (count, result) =>
                count +
                result.deaths.filter((death) => death.cause === cause).length,
              0,
            ),
          ]),
        )
      : null,
    roundsWithStationary5s: results.filter((result) =>
      result.longestStationarySeconds.some((seconds) => seconds >= 5),
    ).length,
    roundsWithoutPlant15s: results.filter(
      (result) => result.longestWithoutPlantSeconds >= 15,
    ).length,
    roundsUnder10s: results.filter((result) => result.seconds < 10).length,
    seat0DecisiveWinPercent: decisive.length
      ? rounded(
          (100 * decisive.filter((result) => result.winner === 0).length) /
            decisive.length,
        )
      : null,
  };
}

export function comparison(results: Result[]) {
  const schemes = SCHEMES.filter((scheme) =>
    results.some((result) => result.map === scheme.id),
  );
  return {
    overall: summarize(results),
    maps: Object.fromEntries(
      schemes.map((scheme) => [
        scheme.id,
        summarize(results.filter((result) => result.map === scheme.id)),
      ]),
    ),
    difficulties: Object.fromEntries(
      DIFFICULTIES.map((difficulty) => {
        const entries = results.flatMap((result) =>
          result.difficulties.flatMap((value, seat) =>
            value === difficulty ? [{ result, seat }] : [],
          ),
        );
        return [
          difficulty,
          {
            appearances: entries.length,
            wins: entries.filter(
              ({ result, seat }) => !result.timeout && result.winner === seat,
            ).length,
            losses: entries.filter(
              ({ result, seat }) =>
                !result.timeout &&
                result.winner !== null &&
                result.winner !== seat,
            ).length,
            draws: entries.filter(
              ({ result }) => !result.timeout && result.winner === null,
            ).length,
            timeouts: entries.filter(({ result }) => result.timeout).length,
            meanPlants: rounded(
              mean(entries.map(({ result, seat }) => result.plants[seat])),
            ),
          },
        ];
      }),
    ),
    pairs: Object.fromEntries(
      DIFFICULTIES.flatMap((a, i) =>
        DIFFICULTIES.slice(i + 1).map((b) => {
          const paired = results.filter(
            (result) =>
              result.difficulties.includes(a) &&
              result.difficulties.includes(b),
          );
          return [
            `${a}/${b}`,
            {
              ...summarize(paired),
              difficultyWins: [a, b].map(
                (difficulty) =>
                  paired.filter(
                    (result) =>
                      !result.timeout &&
                      result.winner !== null &&
                      result.difficulties[result.winner] === difficulty,
                  ).length,
              ),
            },
          ];
        }),
      ),
    ),
  };
}

function main() {
  const args = process.argv.slice(2);
  const option = (name: string, fallback: string) =>
    args
      .find((argument) => argument.startsWith(`--${name}=`))
      ?.slice(name.length + 3) ?? fallback;
  const seeds = Number(option("seeds", "2"));
  const baseSeed = Number(option("seed", "41000"));
  const seconds = Number(option("seconds", "60"));
  const seedLayout = option("seed-layout", "adjacent");
  if (
    ![seeds, baseSeed, seconds].every(Number.isSafeInteger) ||
    seeds < 1 ||
    seeds > 100 ||
    baseSeed < 0 ||
    baseSeed > 0xffffffff ||
    seconds < 1 ||
    seconds > 600
  )
    throw new Error("Use integer --seeds=1..100, --seed>=0, --seconds=1..600.");
  if (!["adjacent", "mixed"].includes(seedLayout))
    throw new Error("Use --seed-layout=adjacent or mixed.");
  const output = resolve(option("output", "artifacts/balance/current.json"));
  const selectedMaps = option("maps", "").split(",").filter(Boolean);
  const schemes = SCHEMES.filter(
    (scheme) => !selectedMaps.length || selectedMaps.includes(scheme.id),
  );
  if (
    !schemes.length ||
    selectedMaps.some((id) => !SCHEMES.some((scheme) => scheme.id === id))
  )
    throw new Error("Unknown map id.");
  const results: Result[] = [];
  const bundleHash = createHash("sha256")
    .update(readFileSync(fileURLToPath(import.meta.url)))
    .digest("hex");
  const sourceHash = createHash("sha256");
  for (const path of [
    "src/ai/bot.ts",
    "src/content/catalog.ts",
    "src/core/simulation.ts",
    "src/rules/settings.ts",
  ])
    sourceHash.update(readFileSync(path));
  const sourceHashAtStart = sourceHash.digest("hex");
  const started = performance.now();
  for (const scheme of schemes) {
    const mapIndex = SCHEMES.indexOf(scheme);
    for (let seedIndex = 0; seedIndex < seeds; seedIndex++) {
      const theme = THEMES[(mapIndex + seedIndex * 5) % THEMES.length];
      const seedInput = (baseSeed + mapIndex * 1000 + seedIndex) >>> 0;
      const seed = seedLayout === "mixed" ? mixedSeed(seedInput) : seedInput;
      for (let a = 0; a < DIFFICULTIES.length; a++)
        for (let b = a; b < DIFFICULTIES.length; b++) {
          const assignments: [Difficulty, Difficulty][] = [
            [DIFFICULTIES[a], DIFFICULTIES[b]],
          ];
          if (a !== b) assignments.push([DIFFICULTIES[b], DIFFICULTIES[a]]);
          for (const difficulties of assignments)
            for (const swapSpawns of [false, true])
              results.push(
                runMatch({
                  scheme,
                  theme,
                  seed,
                  difficulties,
                  swapSpawns,
                  seconds,
                }),
              );
        }
    }
    console.error(
      `${scheme.id}: ${results.length} matches, ${((performance.now() - started) / 1000).toFixed(1)}s elapsed`,
    );
  }
  const report = {
    protocol: "paired-difficulty-and-spawn-v1",
    bundleHash,
    sourceHashAtStart,
    configuration: {
      seeds,
      baseSeed,
      seedLayout,
      seconds,
      mode: "local",
      enclosureDepth: 4,
      randomStarts: false,
      winnerBonus: false,
    },
    ...comparison(results),
    withoutHockey: comparison(
      results.filter((result) => result.theme !== "hockey"),
    ),
    results,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        output,
        ...report.overall,
        difficulties: report.difficulties,
        pairs: report.pairs,
      },
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
