# Reproducible bot and map evaluation

Run from the repository root after installing the locked dependencies:

```sh
rtk npm run balance -- --seeds=6 --output=artifacts/balance/current-1296.json
```

The evaluator is `scripts/balance-report.ts`. It uses the existing esbuild installation to bundle the simulation and bot into one immutable Node runner. The report records that runner's SHA-256 fingerprint, the relevant source-file fingerprint at process startup, configuration, per-round records and final-state digests. Rebuild the runner after source changes. Do not edit its inputs between bundling and starting it. The fixed runner fingerprint identifies the actual evaluated code even if working files change during a long run.

The default `--seeds=2` is a 432-round smoke sample. `--seeds=6` runs 1,296 rounds; `--seeds=11` runs 2,376 and covers every map/theme combination once. `--seed=41000` chooses the base seed, `--seconds=60` the round clock, and `--maps=classic,duel-2` restricts layouts without changing their seed/theme assignments. JSON reports are local, ignored artifacts under `artifacts/balance/`.

For a separate held-out environment set, use `--seed-layout=mixed --seed=2907134103`. The mixer avalanches each map/seed input into a 32-bit value. Keep held-out outcomes distinct from the original paired comparison and avoid repeatedly tuning against the validation set.

The retained validation command also uses the actual default three-minute clock:

```sh
rtk npm run balance -- --seeds=2 --seed=2907134103 --seed-layout=mixed --seconds=180 --output=artifacts/balance/heldout-432.json
```

Its cap is 240 simulated seconds. The changed clock and seed set make it an external check, not an apples-to-apples baseline comparison. Compact baseline, final and validation summaries, including source fingerprints and per-map metrics, are retained in `docs/qa/balance-results.json`; full per-round records remain in ignored artifacts.

## Protocol

Each map/seed/theme cell runs all three self-pairs twice with physical starts exchanged. Each of the three mixed difficulty pairs runs four times: both difficulty assignments to player IDs, each with both physical starts exchanged. That is 18 rounds per environment, 108 per map at six seeds. A swap exchanges positions and initial facing after board generation, preserving the same brick thinning, hidden pickups and simulation RNG state. Both planners observe the same pre-step state; planner invocation order does not advance simulation time.

Map index `m` and seed index `s` select seed `41000 + 1000*m + s` and theme index `(m + 5*s) % 11`. Six seeds cover six of eleven themes per map and every hazard across the aggregate. They do not cover the complete Cartesian product of maps, themes and random environments.

Rounds start immediately in the active phase, run at the simulation's fixed 60 Hz, use a 60-second clock, four enclosure rings, and a 120-second evaluator cap. Other gameplay rules retain the defaults. Random starts and winner bonuses are disabled. Both actors are bots, but the simulation uses **local mode**, so both receive the Hockey Rink steering delay. CPU mode exempts player 1 from this delay; using it would silently favor one seat in a bot-vs-bot comparison. Single-round local results therefore do not directly predict the CPU mode human experience. Every new report includes a `withoutHockey` subgroup for difficulty comparisons. Equal-delay Hockey self-play is a separate stress diagnostic and should not drive tuning for the latency-exempt CPU seat.

Metrics distinguish player-ID wins from physical-spawn wins, completed draws from evaluator timeouts, and clock expiry from either outcome. A round reaching its clock can continue into enclosure and finish decisively. Durations include the normal result-resolution period but exclude the opening countdown. Bomb plants count successful simulation `plant` events. Bomb action presses count rising action inputs, which can be ineffective; they are not a count of successful throws or detonations.

The stationary flag means at least one living actor did not change its exact position for five consecutive active seconds. The offensive inactivity flag means neither actor planted for fifteen consecutive active seconds. These are inspection prompts: safe waiting, defending a corridor or an exhausted map can legitimately trigger them. Motion loops do not trigger the stationary flag. Death causes are inferred from the first remaining flame at the victim's post-step cell, classed as self, opponent or environment; the core event does not contain a killer ID, so this is diagnostic attribution rather than a new scoring rule.

## Baseline

The baseline preserved source before the AI and directional-hazard fixes on 22 October 2026, at repository HEAD `fc7ea7b381894060145efd1125494c5450d6af07`. It uses the same paired environments and settings as the final comparison. The 1,296 baseline rounds produced 514 wins per player ID, 268 draws and no evaluator timeouts. Physical spawn wins were 578 versus 450. Mean duration was 33.36 seconds, median 25.43, p90 69.05; mean plants per round were 24.71. There were 144 stationary flags, 76 offensive inactivity flags and 218 rounds shorter than ten seconds.

Baseline mixed-pair wins were easy/normal 129/117 with 42 draws, easy/hard 118/124 with 46 draws, and normal/hard 111/97 with 80 draws. Even the original bot does not establish an ordered difficulty ladder. Difficulty names should not be presented as measured ratings from these figures.

Excluding Hockey leaves 1,188 baseline rounds, 491 wins per player ID and 206 draws. Non-Hockey mixed pairs have 264 rounds each: easy/normal 119/115 with 30 draws, easy/hard 108/122 with 34 draws, and normal/hard 107/93 with 64 draws. The missing difficulty ordering also appears outside the equal-delay stress case.

## Candidate 1: stable tactical fixes

The candidate-1 1,296-round run and 432-round held-out run used the same immutable runner: SHA-256 `1bcb85c040a7df22521896d5b2c73f828c2d3bb026854b6c07bb457f590e0d41`. The four-file source fingerprint at startup was `1330f838699b9a88bae42106bd2b731da44ae50a9af08a4e380e0e2a923c33a9`. Both completed with **zero evaluator timeouts**.

| Metric                                   | Original 60-second clock | Candidate-1 60-second clock |
| ---------------------------------------- | -----------------------: | --------------------------: |
| Player-ID wins, 0 / 1                    |                514 / 514 |                   495 / 498 |
| Physical-spawn wins, 0 / 1               |                578 / 450 |                   522 / 471 |
| Draws                                    |                      268 |                         303 |
| Mean / median duration, seconds          |            33.36 / 25.43 |               40.92 / 37.05 |
| Mean successful bomb plants              |                    24.71 |                       33.55 |
| Action button presses                    |                    1,429 |                       3,869 |
| Stationary flags, at least five seconds  |                      144 |                          95 |
| No-plant flags, at least fifteen seconds |                       76 |                          67 |
| Rounds shorter than ten seconds          |                      218 |                         178 |

The final bots plant more bombs and trigger fewer stationary flags in this sample. Rounds last longer and draws increase. These changes describe behavior; they do not establish that the game is more enjoyable. Physical-start skew changes with the seed set: the held-out run has 154/227 spawn wins, so a single near-even aggregate cannot establish map fairness.

Candidate-1 per-map results below contain 108 rounds each, including the equal-delay Hockey stress cases. Stationary/no-plant flags can overlap.

| Map     | Player-ID wins, 0/1 | Draws/timeouts | Mean seconds | Mean plants | Stationary/no-plant flags | Spawn wins, 0/1 |
| ------- | ------------------: | -------------: | -----------: | ----------: | ------------------------: | --------------: |
| classic |               46/47 |           15/0 |        29.47 |       24.16 |                       2/2 |           61/32 |
| duel-2  |               38/37 |           33/0 |        36.28 |       32.57 |                       2/2 |           32/43 |
| duel-3  |               43/46 |           19/0 |        42.28 |       27.83 |                     20/14 |           44/45 |
| duel-4  |               43/43 |           22/0 |        42.08 |       26.09 |                     22/22 |           22/64 |
| duel-5  |               39/37 |           32/0 |        50.65 |       36.84 |                      12/4 |           42/34 |
| duel-6  |               50/49 |            9/0 |        30.19 |       23.27 |                       0/0 |           76/23 |
| duel-7  |               37/39 |           32/0 |        46.33 |       38.36 |                       1/1 |           39/37 |
| duel-8  |               26/27 |           55/0 |        56.07 |       40.56 |                       4/0 |           24/29 |
| duel-9  |               45/44 |           19/0 |        41.09 |       36.32 |                       6/0 |           45/44 |
| duel-10 |               51/52 |            5/0 |        35.54 |       27.04 |                      12/8 |           62/41 |
| duel-11 |               45/41 |           22/0 |        32.32 |       25.97 |                      11/7 |           37/49 |
| duel-12 |               32/36 |           40/0 |        48.72 |       63.63 |                       3/7 |           38/30 |

Quick Draw (`duel-8`) still has many draws: 55/108. Brick by Brick (`duel-4`) has 22 stationary and 22 no-plant flags; Long Fuse (`duel-3`) has 20 and 14. These are useful targets for replay inspection, not automatic evidence that the layouts should change.

Difficulty comparisons exclude Hockey. Each primary pair has 264 rounds; each held-out pair has 88.

| Pair          | Original wins / draws | Candidate-1 wins / draws | Held-out 180-second wins / draws |
| ------------- | --------------------: | -----------------------: | -------------------------------: |
| Easy / Normal |          119/115 / 30 |             121/105 / 38 |                        37/48 / 3 |
| Easy / Hard   |          108/122 / 34 |             112/116 / 36 |                        35/44 / 9 |
| Normal / Hard |           107/93 / 64 |               93/86 / 85 |                       42/28 / 18 |

The result does **not establish an ordered Easy → Normal → Hard strength ladder**. Normal wins more than Hard in both candidate-1 sets; Easy versus Normal changes direction between them. There are distinct tactical profiles and regression-tested escape/ability behaviors, but the difficulty labels should not be advertised as validated skill ratings.

The 180-second held-out sample contains 432 rounds across 24 distinct environments. It has 381 decisive outcomes, 51 draws, a 38.52-second median, a 189.08-second p90, 55 mean plants, 33 stationary flags and 35 no-plant flags. It confirms bounded completion under the longer clock while retaining a long tail of rounds that reach enclosure. Different seeds and a different clock prevent attributing its lower draw count to one specific change.

## Candidate 2: bounded reaction-delay experiment

A subsequent candidate tested 45/18/0 ticks of hesitation before safe Easy/Normal/Hard bomb or remote attacks. Normal and Hard shared strategic weights; Hard retained its deeper search. This experiment used a fresh preselected 32-bit mixed seed set (`--seed=1928392017 --seed-layout=mixed --seeds=2 --seconds=60`), for 432 rounds across 24 environments.

It did not establish the intended difficulty ordering. Excluding Hockey, Easy/Normal won 33/22 with 29 draws and four timeouts, Easy/Hard won 41/31 with 16 draws, and Normal/Hard won 36/35 with 17 draws. Each pair had 88 rounds. The 396 non-Hockey rounds had a 63.08-second median, 39 stationary flags and 42 no-plant flags.

The four timeouts were two paired environments: Diamond District / Under the Ocean, seed `1684358569`, and Switchback / Ancient Egypt, seed `4001421563`, all involving Easy and Normal. Exact replays using the preserved candidate-1 runner finished in 66.08–74.08 seconds, with no-plant gaps at most 2.9 seconds. Candidate 2 reached the 120-second evaluator cap with no-plant gaps of 39–43 seconds. This is a concrete regression on matched inputs, so the experiment did not warrant a fresh held-out validation run. The next held-out seed (`3774148291`) was preselected and remains unused.

Candidate 2 was reverted. The selected behavior is candidate 1, retaining only a single-pass maximum-score selection that preserves the original tie order. The four regression cases finish again and match the preserved candidate-1 final-state digests exactly. A full paired replay confirmed identical records across all **1,296 original rounds**, including every final-state digest, outcome, duration, bomb/action/death count and inactivity flag. All aggregate summaries match and the optimized final run has zero timeouts.

The optimized final runner SHA-256 is `662b589b873e336a1b99a912c75d407c3bbab524d862ad4dee8a98064e668215`; its four-file source fingerprint is `1e5c211282a9a4e7ba5a79c4c3d93aa7b716c242cc873c7051d653590b3d13fb`. The three-minute held-out results above belong to the pre-optimization candidate-1 runner. They validate the selected behavior before the equivalent score-selection optimization; the full final replay establishes tested equivalence across the original paired rounds, rather than claiming another three-minute validation was run on the optimized source.

## Interpretation limits

The 1,296 rounds contain only **72 distinct map/seed/theme environments**; seat assignments and spawn swaps within one environment are correlated, and exact self-play symmetries can duplicate trajectories. There are only six such environments per map. Treating all rounds as independent samples would overstate confidence. This report does not calculate significance or claim fairness from percentages close to 50%.

The same policy family playing itself can reward mutual passivity or exploit its own blind spots. Higher win rate, more bombs, fewer draws and longer rounds are not direct measures of human enjoyment, readability or fairness. A controlled human session should separately inspect first-minute comprehension, intentional attacks, safe escape routes, repeated stalemates, recovery after a mistake and difficulty progression. Use independent seed sets before describing a tuned candidate as generally stronger.

Remaining AI development work is separate from human feedback. Moving-bomb forecasts conservatively combine possible footprints, which can reject usable routes. The planner does not model future brick destruction, future enclosure walls, transit outcomes or opponent intentions, and has no explicit plan to wait for a gap between flames. Punch and Grab are limited to rescuing an actor from an imminent fuse; offensive Spooge use and coordinated multi-bomb traps are absent. Human playtesting can assess how these limits feel, but does not implement the missing capabilities.

`tests/balance-report.test.ts` checks seeded replay, reversed planner invocation order, timeout/draw separation and independent player-ID/physical-spawn tallies. Existing core tests separately verify mirrored directional-hazard cells and conveyor movement. These establish evaluator and mechanic properties; they do not establish human balance.
