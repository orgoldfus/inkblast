# Rule ledger

Reference baseline and links: [reference audit](reference-audit.md). “Implemented/tested” establishes Inkblast behavior only. It never upgrades externally reported behavior to an observation of the original executable.

| ID | Rule / evidence | Implementation and regression evidence | Status / remaining verification |
| --- | --- | --- | --- |
| G01 | Exactly two participants is the requested scope | `core/types.ts`, scheme validator; `tests/content.test.ts` rejects a third start | Implemented/tested scope adaptation; original supported up to ten |
| G02 | 15 × 11 scheme grid, three tile kinds; externally reported extracted constants | `content/schemes.ts`; malformed counts/rows/tiles tested | Implemented/tested; no original observation here |
| G03 | Original data has no wall border; externally reported analysis | Imported edge cells permitted; authored presets have perimeter | Explicit layout adaptation; not identical original usable area |
| G04 | Two valid open starts, possible route between them | Flood-fill through floor/brick; solid partitions rejected; curated geometry tests | Implemented/tested Inkblast acceptance rule |
| G05 | Density independently removes candidate bricks | `Scheme.density`, editor percentage, simulation generation | Implemented; original RNG/seed identity unverified |
| C01 | Eleven original names from external extracted message table | `content/catalog.ts`, eleven unique theme IDs test | Implemented/tested manifest; original extraction not independently verified |
| C02 | Extras by theme from external extracted data | Catalog hazard declarations; simulation/rendering consume selected theme | Browser adaptations; exact original placement/timing not claimed |
| C03 | Complete original scheme inventory requested | No original game data available; twelve new presets labeled | **Incomplete original catalog audit**; source files needed |
| C04 | Twelve curated duel maps | Unique geometry, symmetry, open starts and reachability tests | Implemented/tested geometry; human fun/balance review remains |
| I01 | Manual describes bomb/flame/skate/kick/punch/grab/spooge/trigger and disease families | Item definitions, simulation systems, editor inventory | Documented families; exact interactions and timing need reference comparisons |
| I02 | Ten bombs in manual versus eight in external tuning research | Browser profile uses ten | Explicit unresolved original-rule conflict |
| I03 | Per-item born-with, overrides, Random exclusions from BombEdit and external scheme parser | `EditableScheme`, editor item table, JSON/SCH roundtrip tests | Implemented/tested content representation; core effects tested separately |
| I04 | Starting diseases and Random prohibited in BombEdit | Validator rejects positive starting amount for those items | Implemented/tested |
| F01 | Original `.sch` version-2 records and item numbering | Independent parser; duplicate/missing rows, versions, bounds tested | Implemented/tested documented subset |
| F02 | Original files can carry ten starts | Explicit two-start selection on imports; negative-coordinate test | Implemented/tested adaptation; no extra participants activated |
| F03 | Team-only layout exclusion | Explicit `(n)(n)` designation rejected; solid-separated starts rejected | Implemented/tested known convention; undocumented team labels need review |
| F04 | Lossless local backup | Versioned JSON validated, cloned and roundtripped; unknown fields stripped | Implemented/tested; SCH omits Inkblast-only metadata by design |
| P01 | Local settings/maps/progress | Versioned settings, IndexedDB maps/progress; bounded value tests, memory fallback tests | Implemented/tested fallback; browser transaction persistence verified separately |
| P02 | Unavailable or full storage must not lose session work silently | `storageWarning`; editor reports session-only state and JSON export | Implemented; storage exhaustion and cross-browser eviction still require browser QA |
| M01 | Manual wins/kills match selection and Wally throwing | Match UI/core | Documented; exact suicide/tie/late-chain scoring parity unverified |
| M02 | Fixed 60 Hz browser simulation | `TICK_RATE`, `rules/settings.ts` | Explicit timing adaptation; original used machine/update-dependent paths |
| M03 | Winner roulette | Bonus option and browser flow | Family implemented; original wheel physics/carryover timing require direct verification |
| H01 | Arrows turn sliding bombs; conveyors carry bombs and players | Environment systems | Externally reported; exact original coordinate and cadence parity unverified |
| H02 | Warps/trampolines temporarily remove player from danger | Environment systems | Externally reported; animation, landing and immunity parity unverified |
| H03 | Hockey delay and haunted regeneration | Theme-specific environment systems | Externally reported; browser profile adaptation |
| H04 | Clock, hurry, closing walls, stomped bombs | Round/environment systems | Externally reported; spiral corners, wall-clock timing and depth mapping require direct comparison |
| X01 | Legacy networks and >2 seats | Excluded by requested static local duel scope | Explicit exclusion |
| X02 | Hidden unfinished campaign, hidden original editor shortcut, attract sequence | New Workshop and Arcade Tour are separate modern features | Compatibility research remains; no original campaign parity claim |

The simulation scenarios in `tests/core.test.ts` and other tests added during implementation supply the current regression list. Review those tests alongside source and the [options manifest](options-manifest.md) before changing the browser profile. A source claim marked “observed” in the external project is still **reported by external research** in this ledger.

## Automated content matrix

The local Node/Vitest matrix in `tests/ai-matrix.test.ts` exercised all 132 combinations of eleven themes and twelve schemes: 185,985 simulation steps, 2,297 planted bombs, 155 player deaths and 23 draws. Active rounds lasted 256–3,101 ticks. On this implementation host, the measured p95 for **both bots plus simulation** was 0.650459 ms (maximum 43.34 ms; full matrix 31.6 seconds). This measurement excludes browser rendering, input-to-display latency, audio, representative hardware and physical devices. It does not establish 60 fps, original parity or human enjoyment. Re-running the matrix may produce different wall-clock performance figures.
