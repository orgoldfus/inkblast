# Reference audit — 22 October 2026

Inkblast is a new local browser duel game. It uses original names and documented mechanic families as reference, with new art, layouts, music and environmental placement. **Exact original-game compatibility has not been established.** No licensed reference executable or original scheme directory was available for direct comparison during this implementation.

## Evidence baseline

1. [Atomic Bomberman printed manual, June 1997](https://www.bestoldgames.net/download/games/atomic-bomberman/atomic-bomberman-win-manual.pdf), English pages 2–9: primary published evidence for controls, wins/kills, Wally play and item families. The manual explicitly directs readers to the bundled help for later changes. It supplies no complete theme or scheme inventory.
2. [External reimplementation, pinned commit `8dc7f1f772fbc6fe3fa6d4cbb02e028453771c84`](https://github.com/elraro/atomic-bomberman/tree/8dc7f1f772fbc6fe3fa6d4cbb02e028453771c84), committed 12 October 2026. The audit read this fixed revision's [map specification](https://github.com/elraro/atomic-bomberman/blob/8dc7f1f772fbc6fe3fa6d4cbb02e028453771c84/docs/specifications/maps.md), [map reverse engineering](https://github.com/elraro/atomic-bomberman/blob/8dc7f1f772fbc6fe3fa6d4cbb02e028453771c84/docs/reverse-engineering/maps.md), [extra research](https://github.com/elraro/atomic-bomberman/blob/8dc7f1f772fbc6fe3fa6d4cbb02e028453771c84/docs/reverse-engineering/extras.md), [game modes](https://github.com/elraro/atomic-bomberman/blob/8dc7f1f772fbc6fe3fa6d4cbb02e028453771c84/docs/specifications/game-modes.md), [theme name table](https://github.com/elraro/atomic-bomberman/blob/8dc7f1f772fbc6fe3fa6d4cbb02e028453771c84/src/app/names.hpp) and [scheme reader/writer](https://github.com/elraro/atomic-bomberman/blob/8dc7f1f772fbc6fe3fa6d4cbb02e028453771c84/src/resources/scheme_file.cpp). This is first-party evidence for that project's research and implementation, and external evidence about the 1997 executable. Its observations are not Inkblast observations.
3. [BombEdit author's documentation](https://www.geocities.ws/mheid.geo/bombedit.html): primary evidence for that editor's UI and authored interpretation of scheme fields. It documents tile editing, density, inventory, override counts/chances and Random exclusions. It does not establish timing parity.

No game art, audio, original maps, or source from the reference project is bundled. The `.sch` implementation is an independent TypeScript parser of the documented text records. There is no original executable, emulator or runtime service dependency.

## Eleven-theme inventory

Names below are externally reported original message strings 150–160. Hazard associations are externally reported extracted data. The number of original extra records is reference information; Inkblast does not claim to reproduce those coordinates or counts.

| Index | Name | External original behavior | Inkblast content |
| --- | --- | --- | --- |
| 0 | Green Acres | No extra file reported | New green palette; plain floor |
| 1 | Classic Green Acres | No extra file reported | Inkblast slate/orange palette; plain floor |
| 2 | The Hockey Rink | 12 arrows and 250 ms human control delay | Human-only 15-tick steering history and sparse arrows; placement is a browser adaptation |
| 3 | Ancient Egypt | 44 arrows | Arrow mechanic with new placement |
| 4 | The Coal Mine | Four linked warp holes in a ring | Warp mechanic with new placement |
| 5 | The Beach | No extra file reported | New sand palette; plain floor |
| 6 | Aliens | No extra file reported | New cosmic palette; plain floor |
| 7 | Haunted House | Brick regeneration attempt every four seconds | Regeneration mechanic; browser timing/selection adaptation |
| 8 | Under the Ocean | No extra file reported | New ocean palette; plain floor |
| 9 | Deep Forest Green | Eight trampolines, four fixed and four random | Trampoline mechanic with new placement |
| 10 | Inner City Trash | 32 conveyor cells | Conveyor mechanic with new placement |

Theme is independent of scheme. The supplied themes provide new palettes and audio identities; they do not import original imagery. Hazard behavior and artwork must be checked in the running build independently of this data inventory.

## Geometry and scheme catalog

The external analysis identifies **15 × 11 playable cells without an internal wall border**, with outside-grid space treated as solid. The supplied duel presets deliberately include a solid perimeter. This reduces usable space and is an explicit Inkblast layout adaptation. The importer accepts the full original cell grid, including open edge cells.

Twelve new presets are supplied: Classic Clash, Crossfire, Long Fuse, Brick by Brick, Ring Road, Four Corners, Split Decision, Quick Draw, Diamond District, Switchback, Grand Central, Throwdown. Each has 165 cells, rotationally symmetric geometry, two open starts and a route between starts after destructible bricks are removed. Throwdown supplies Punch and Grab. These are **new duel adaptations**, not traced reproductions of original schemes. Automated geometry validation does not prove that a map is enjoyable or balanced in human play.

**Original scheme catalog audit remains incomplete.** The pinned research describes the format but its repository does not bundle the original game data. No original scheme names, original two-player counts or team-map exclusion list were invented. Obtain a legally available original scheme directory, inventory every file and validate each candidate before claiming original-catalog coverage. A supplied map with a team designation such as `(4)(4)` is rejected by import; other maps with more than two starts require an explicit choice of two starts.

## Local file interchange

Supported original text records, version 2:

```text
-V,2
-N,Scheme name
-B,75
-R,0,###############
-S,0,1,1,0
-P,0,2,1,4,0
```

`-R` uses `#` for solid, `:` for destructible and `.` for floor. All eleven numbered rows must be present once. `-S` is player index, X, Y and optional team. Negative coordinates count from the far edge; out-of-range starts are rejected. `-P` is item index, born-with, override enabled, override amount and Random-forbidden. Original item order is bomb, flame, disease, kick, skate, punch, grab, spooge, goldflame, trigger, jelly, super disease, Random. Positive override means a count; negative means a 1-in-n chance, per BombEdit's account.

Imports are capped at 100 KB and validated before use. More than two starts trigger a local start-selection dialog. The chosen starts and their non-solid orthogonal neighbors are cleared; the result is labeled a duel adaptation. Explicit team-labelled layouts are rejected. Name-based team detection cannot identify every undocumented team-only layout; disconnected duels are independently rejected by geometry validation.

JSON backup is versioned: `{ "format": "inkblast-scheme", "version": 1, "scheme": { ... } }`. It preserves map ID, description, geometry and all item settings. `.sch` export preserves compatible gameplay fields, emits two starts, and omits Inkblast-only ID and description metadata. It is identified as a two-start adaptation and is **not certified as a complete ten-player file for the original editor**. JSON is the preferred lossless backup. A `.sch` name with commas or line breaks requires JSON export.

## Explicit remaining evidence gaps

- No controlled original executable observations were performed here. Exact movement, collision anchoring, action priority, blast ordering, item recycling, disease timing and scoring need direct comparisons.
- Manual maximum bomb inventory is ten; extracted research reports a cap of eight. Inkblast uses its documented browser profile; this remains a fidelity conflict.
- Short-fuse multipliers, update-count timing and disease cure/transmission need an agreed reference profile.
- Original level art, exact extra placement, animation timing and music are replaced with original Inkblast presentation.
- Hidden campaign behavior is externally reported static analysis of visibly unfinished code, never observed running in that source. Inkblast Arcade Tour is a new battle sequence, not a reproduction of that campaign. Original editor shortcut and attract mode are legacy compatibility items, not implied completed features.
- Physical device/controller coverage, broader human difficulty/map playtests and representative-device performance measurements are separate release gates. Two user playtest rounds informed and confirmed movement speed; they do not establish enjoyment across every map and difficulty. See the current acceptance record for browser evidence.

## Concrete browser rule profile

The current simulation intentionally uses 60 updates per second: regular fuse 150 ticks (2.5 seconds), visible flame 30 ticks, death-resolution window 90 ticks, disease duration 720 ticks and short-fuse multiplier 0.5. Inventory caps and all further tuning live in `src/rules/settings.ts`. These choices are not certified original timings.

Current simplifications requiring a reference comparison include: fixed hidden-item probability; blast-through behavior for floor pickups; item reveal/cascade ordering; chain attribution to each exploding bomb's owner; suicide scoring; discrete kicked-bomb motion; three-cell wrapped throws with progressing airborne fuses; simplified head hits; Jelly reversing direction; trigger inventory and owner-death transitions; and disease stacking/cure/precedence. Dud behavior is absent. Wally is a three-bomb throwing loadout rather than an imported original team partition scheme.

Environmental placement is adapted: two warp endpoints, a sparse arrow grid, alternating conveyor lanes and authored trampoline pads. Warps block input/damage for 18 ticks with transfer at tick 9; trampolines use 30 ticks with transfer halfway to a seeded safe target within two cells in both axes. The original research uses up to 100 random landing attempts; Inkblast selects from viable destinations. Hockey delays human steering 15 ticks and leaves the computer undelayed. Regeneration tries previously destroyed brick locations every 240 ticks when vacant; this differs from the externally reported broad random floor search. Exact original extra counts, coordinates, flight art and machine-dependent timing remain unverified.
