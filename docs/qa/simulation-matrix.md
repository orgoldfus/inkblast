# Simulation validation — 22 October 2026

This records Inkblast's browser rules and automated simulation results. It does not establish original Atomic Bomberman parity or human enjoyment. See the [reference audit](../reference-audit.md) and [rule ledger](../rule-ledger.md) for remaining original-game evidence gaps.

## Human playtest adjustment

During the first human playtest, the user described movement as responsive and requested slightly faster movement. Base speed changed from 65 to **75 fixed-point units per tick**, a 15.4% increase from 3.9 to 4.5 tiles per second. The 150-tick bomb fuse remained unchanged. Bots derive traversal estimates from the same movement-speed function. Core, AI, all-combination simulation and browser acceptance were repeated after this adjustment; the parent release record contains browser results.

## Current automated coverage

`tests/core.test.ts` has 29 passing scenarios. They cover wall collision/corner assistance; leaving and re-entering bombs; stable chain reactions and brick blockers; late simultaneous deaths; inventory caps/exclusions; trigger bombs and owner death; carrying and expiring carried fuses; full-board punch wrapping; kick/stop/jelly; all disease families and selected precedence/transmission cases; Random eligibility/overrides; warp and trampoline transit; human-only hockey input delay; conveyor/arrow behavior; haunted regeneration; roulette penalties/carryover; imported map and settings validation; perimeter enclosure; and deterministic input replay.

`tests/ai.test.ts` has nine passing scenarios. They cover chain-aware forecasts, refusing inescapable plants, single-bomb survival at all three difficulties, independence from hidden item placement, capacity-safe demolition, all twelve curated layouts, and rejecting off-center planting. The Classic opening has a specific survival regression. A blanket minimum round duration is deliberately not used: a short round can be a valid opponent trap, as observed in a Throwdown trace where simultaneous opposing bombs sealed the normal bot's escape.

`tests/ai-matrix.test.ts` has two passing sustained scenarios. These are additional to the core and AI tests above: **40 core/AI scenarios in total**. The TypeScript check passes. Run them with:

```sh
rtk npm test -- tests/core.test.ts tests/ai.test.ts tests/ai-matrix.test.ts
rtk proxy npx tsc --noEmit
```

## Theme × layout matrix

All eleven themes were paired with all twelve curated schemes, for **132 combinations**. Easy, normal and hard rotate evenly across combinations, 44 each. Both seats use the observable-state bot input generator; the human seat still receives hockey's intentional 15-tick steering delay. Each scenario uses a recorded deterministic seed, a 30-second clock and five enclosure rings. Assertions require a finished result, finite positions and bomb counts within each owner's capacity.

Final run with base speed 75:

| Measurement | Observed |
| --- | ---: |
| Combinations passed | 132 / 132 |
| Simulation steps | 202,813 |
| Bombs planted | 2,632 |
| Eliminations | 156 |
| Draws | 24 |
| Round lengths, including death resolution | 266–3,017 ticks |
| CPU p95, both bots plus simulation | 0.6704 ms |
| Largest measured update | 64.1345 ms |
| Matrix test elapsed time | 41.133 seconds |

There were fifteen rounds shorter than 600 ticks. Ten were hockey's delayed human-seat proxy. Other early rounds included legitimate attacks and some Easy/conveyor or item-related self-eliminations. These remain useful human-playtest/bot-tuning candidates; the aggregate pass is not a claim that every defeat is understandable or that every bot match is enjoyable. A systematic normal-difficulty conveyor opening suicide was corrected by forecasting the possible rolling-bomb path rather than only its current cell. Planned new bombs also participate in chain forecasts before the bot commits to placement.

## Maximum-inventory stress

Two hard planners ran for 1,800 updates with capacity ten, maximum blast range, kick/punch/grab/jelly and moving bombs on conveyors. Invulnerability keeps both seats alive so the stress run can continue through repeated full-capacity cascades; it is not a balance measurement.

| Measurement | Observed |
| --- | ---: |
| Peak simultaneous bombs | 20 |
| Peak simultaneous flame cells, including overlapping entries | 420 |
| CPU p95, both bots plus simulation | 0.8162 ms |
| Largest measured update | 2.2088 ms |
| Stress test elapsed time | 0.763 seconds |

## Measurement limits

Measurements use Node.js 24.14.0 / Vitest 5.0.5 on macOS 27.0.1 ARM64. Timing surrounds both bot decisions and `stepGame`; assertions and summary output are outside the measured interval. Other desktop/browser work can contend for this host. CPU p95 was below the plan's 4 ms target in these runs, but the matrix includes an update outlier, and these measurements exclude rendering, audio, controller polling and browser input latency. They do not certify 60 fps or a physical desktop/mobile device support matrix.

The exact original scheme catalog, original timing parity, dud behavior and direct executable comparisons remain unresolved as described in the reference audit. The supplied layouts and hazard coordinates are labeled Inkblast adaptations.
