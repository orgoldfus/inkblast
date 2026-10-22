# Inkblast implementation plan

Date: 22 October 2026. Status: a playable Inkblast beta has been implemented. This document remains the target scope; it is not a completion claim. See [acceptance evidence and open release gates](docs/qa/acceptance.md) and the [rule ledger](docs/rule-ledger.md).

## 1. Product and scope

Build a complete browser game that recreates Atomic Bomberman's gameplay and options applicable to one-on-one matches, with the selected Inkblast comic art direction. Deploy a static build to GitHub Pages. Gameplay, bots, settings, maps, audio, and local progress run entirely on the player's device.

Selected visual target: [Inkblast concept](docs/reference/inkblast-concept.png).

The game should offer:

- Exactly two participants per battle: one human against one computer opponent, or two local humans against each other.
- A simple mode choice: **Player vs Computer** or **Two Players**. No additional seats, team mode or extra bots.
- Two-player input combinations: shared keyboard, keyboard plus gamepad, or two gamepads. Touch controls support one human against the computer.
- All 11 original arena theme definitions and their level-specific behavior, reinterpreted in Inkblast artwork. Theme and scheme remain independent.
- Original one-on-one battle rules, power-ups, diseases, applicable match options, winner bonus, and custom schemes.
- A short tutorial, immediate rematches, and a multi-arena tournament to make the content easy to enjoy.
- A useful local map editor, persistent settings, and file import/export.

### Hosting and multiplayer boundary

GitHub Pages serves static HTML, JavaScript, CSS, and assets; it does not run our game server. All launch play happens within one browser session. There are no accounts, hosted rooms, matchmaking, cloud saves, global leaderboards, telemetry, runtime APIs, or paid services. GitHub Actions is only a build/deployment service. [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

The original's IPX/modem/serial connection options will not be reproduced. Reliable internet multiplayer is outside this backend-free scope. WebRTC can use manually exchanged connection information, but reliable connections across arbitrary networks still introduce signaling/NAT-traversal concerns and often relay infrastructure. We will not make that an unreliable launch feature. [WebRTC connectivity](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity)

The two-participant limit supersedes the earlier ten-player scope. Team play, matches with more than two participants, legacy networking and obsolete operating-system/hardware settings are explicit exceptions to “all original options.” Applicable one-on-one gameplay settings remain in scope.

## 2. Technology decision

| Area | Choice | Reason |
| --- | --- | --- |
| Language | Strict TypeScript | Readable gameplay code, explicit state, easy browser integration and testing. |
| Rendering | PixiJS 8, production WebGL renderer | GPU-accelerated sprites fit Inkblast's illustrated arena and animation. Pin a stable release in the lockfile. |
| Build | Vite, static output | Straightforward local development and GitHub Pages deployment. |
| Menus and settings | Semantic HTML and CSS with small TypeScript controllers | Accessible controls, text and focus management without a second large UI framework. |
| Game simulation | Independent TypeScript module | Test rules without graphics; share identical rules between humans and bots. |
| Audio | Browser Web Audio API | Local assets, bounded sound mixing, separate music/effects/voice controls. |
| Input | Keyboard, Gamepad API, Pointer Events | One input abstraction for local players, controllers and touch. |
| Storage | Versioned localStorage for settings; IndexedDB for maps/progress | Device-local persistence; downloadable backups. |
| Tests | Vitest plus automated browser checks | Rules, deterministic scenarios, menus, storage, deployment and performance. |
| Delivery | GitHub Actions → GitHub Pages | Reproducible static artifact with no application backend. |

PixiJS recommends WebGL for production; WebGPU is not needed for the launch renderer. [PixiJS renderer documentation](https://github.com/pixijs/pixijs/blob/dev/src/rendering/__docs__/rendering.md)

**Three.js is unnecessary for this visual target.** The depth comes from painted tile faces, layered sprites, shadows and animation. A 3D engine would add cameras, lighting, meshes and asset work without improving the underlying grid game.

**WASM is not part of the initial implementation.** A small grid with two participants is a reasonable TypeScript workload. Measure it before adding a compiled runtime. If profiling reveals a real bottleneck, first reduce allocations and redundant searches; consider a worker for bot planning only if measurements justify the coordination overhead. Neither workers nor WASM are prerequisites for a smooth game.

## 3. Fidelity contract and evidence

“Feels like Bomberman” is not the completion criterion. Maintain a rule ledger with:

`rule ID → description → source/version → observed result → implementation → regression test → status`.

Use four statuses: documented, reported by external research, directly observed, and implemented/tested. Our own passing test does not establish that its expected behavior matches the original.

Evidence order:

1. A nominated original release and its bundled help, settings, tuning values and schemes.
2. Controlled observations of that release.
3. The original printed manual.
4. External behavioral research and editor documentation, used as leads and cross-checks.

The [original manual](https://www.bestoldgames.net/download/games/atomic-bomberman/atomic-bomberman-win-manual.pdf) establishes the core controls, battle modes and many items, but is not a complete timing specification. The [modern reimplementation's validation report](https://github.com/elraro/atomic-bomberman/blob/main/docs/testing/validation-status.md) distinguishes observed mechanics from unobserved ones; its results are external evidence, not verification of Inkblast. Some of that project's summary pages have stale status wording, so consult individual scenarios and pin the reference commit.

### Resolve before declaring original-rule compatibility

- Bomb capacity: the printed manual describes a default maximum of ten, while extracted-data research reports a pickup cap of eight. Do not silently choose one.
- Short-fuse disease: historical editor documentation and newer research disagree on the multiplier.
- Original update-rate quirks: some effects depend on machine-dependent update counts, not elapsed time.
- Kill attribution through chains, suicides and ties in one-on-one matches.
- Whether an item blocks a blast; reveal, destruction and recycling order.
- Trigger-bomb supply, action priority, inventory exclusions and death transitions.
- Disease duration, spread, cure, stacking and local/network-only differences.
- Exact level extras, two-player-compatible original scheme inventory, applicable option defaults and selectable ranges.

The implementation can begin with documented behavior. Final claims of exact parity require access to a reference copy or adequate reproducible original-game recordings. Missing evidence remains visible in the ledger; it does not become an invented rule.

## 4. Original gameplay checklist

### Movement and arena

- Reconstruct the original 15 × 11 logical playfield, with blank, solid and destructible cells.
- Match continuous movement within grid corridors, corner sliding, alignment, directional priority and collision reference points.
- Support walking off a newly planted bomb while preventing re-entry as appropriate.
- Preserve start-position rules and starting-area clearing.
- Keep visual sprite overlap separate from collision and damage decisions.

The selected concept is the art target, not authoritative geometry. Correct any generated-image inconsistency in cell counts, blast reach or tile placement. [Map specification research](https://github.com/elraro/atomic-bomberman/blob/main/docs/specifications/maps.md)

### Bombs and explosions

- Model resting, kicked, airborne and carried bombs as explicit states.
- Support fuse progression, timed explosions, cross-shaped blasts, obstacles, destructible blocks and ordered chain reactions.
- Preserve differences between kick, punch and grab/throw, including flight, wrapping, landing and head-hit behavior where verified.
- Implement regular, trigger and jelly variants, plus the original dud behavior after verification.
- Account for bomb ownership changes, capacity release, owner death, wall impacts and interactions with floor extras.
- Define same-update ordering explicitly so a cascade cannot depend accidentally on array iteration.

The detailed interactions are acceptance scenarios, not just visual effects. [Bomb specification research](https://github.com/elraro/atomic-bomberman/blob/main/docs/specifications/bombs.md)

### Items

| Item | Required behavior family |
| --- | --- |
| Extra Bomb | Concurrent bomb capacity. |
| Flame | Increased blast range. |
| Goldflame / Golden Boy | Maximum-range blast behavior. |
| Skate | Movement-speed increases and limits. |
| Kick / Boot | Kick bombs and applicable stopping behavior. |
| Punch / Boxing Glove | Punch bombs over obstacles. |
| Grab / Blue Hand | Pick up, carry and throw bombs. |
| Spooge | Lay a line of available bombs. |
| Trigger | Remote detonation, order and supply rules. |
| Jelly | Bouncing-bomb behavior. |
| Disease | Negative status effects and transmission. |
| Super disease | Multiple simultaneous negative effects. |
| Random | Select from eligible item types. |

Implement caps, starting inventory, exclusions, drop generation, reveal restrictions and redistribution as data-driven rules. Include the winner-roulette speed penalty separately from regular field pickups. [Power-up specification research](https://github.com/elraro/atomic-bomberman/blob/main/docs/specifications/powerups.md)

Disease coverage: slow, fast, inability to plant bombs, involuntary planting, reduced flame, fast involuntary planting, shortened fuse, position swap and reversed controls. Verify exact multipliers and interaction precedence. [BombEdit author's gameplay reference](https://www.geocities.ws/mheid.geo/about.html)

### Round and match flow

Include round start, active play, death resolution, draws, results, rematch and match winner. Support one-on-one battle and compatible Wally Bomb throwing configurations. Win-count and kill-total match modes must use their verified scoring rules. Team configurations are outside the revised scope. [Original manual](https://www.bestoldgames.net/download/games/atomic-bomberman/atomic-bomberman-win-manual.pdf)

Reproduce the clock, unlimited rounds, hurry warning, closing-wall sequence, depth limits and late simultaneous-death handling. Test when remaining bombs and hazards stop relative to the declared outcome. [Round-flow research](https://github.com/elraro/atomic-bomberman/blob/main/docs/specifications/gameplay.md)

### Settings inventory

Create a manifest that maps every original player-facing option to its Inkblast equivalent or an explicit exclusion under the two-participant scope:

| Group | Planned coverage |
| --- | --- |
| Players | Player vs Computer or Two Players, input assignment, two distinct player identities, keyboard layouts and bot difficulty. |
| Arena | Theme selection, random theme, independent scheme selection. |
| Match | Target score, wins versus kills, random starts between the two valid spawn points, round duration including unlimited. |
| Hazards | Enclosure depth, conveyor speed, stomped-bomb detonation. |
| Items | Destroyable diseases, scheme starting inventory, item overrides and Random eligibility. |
| Bonus | Gold Bomberman winner roulette and carryover award. |
| Presentation | Gameplay music, sound controls, fullscreen, help and control configuration. |

Exact option labels, defaults, values and conditional availability are captured in milestone 1. Browser volume sliders and quality settings are modern conveniences. Legacy memory-model and network configuration screens are replaced by relevant browser controls or omitted with an explicit compatibility note. [Game-mode and settings research](https://github.com/elraro/atomic-bomberman/blob/main/docs/specifications/game-modes.md), [Launcher setting reference](https://ablauncher.sourceforge.net/settings.php)

### Editor and obscure original features

Support drawing tiles, placing exactly two player starts, density, per-item starting amounts, overrides and Random exclusions. Include undo/redo, validation, save, duplicate, delete, import and export. Read compatible `.sch` files locally; export a documented versioned JSON format and, where lossless, `.sch`. Never upload imported files. For imported schemes with more than two starts, require selection of two valid starts and validate the resulting duel layout before play. Reject team-only schemes with a clear explanation; never silently activate additional participants. [BombEdit documentation](https://www.geocities.ws/mheid.geo/bombedit.html)

Audit hidden campaign/editor shortcuts, attract mode, bonus screens and unfinished features separately. External research describes a hidden unfinished campaign, but has not observed it running. Record it as a legacy compatibility item requiring verification, not as a finished original campaign that we can confidently promise to reproduce. Our tournament mode is a new, clearly identified wrapper around battle rounds. [Game-mode research](https://github.com/elraro/atomic-bomberman/blob/main/docs/specifications/game-modes.md)

## 5. Levels, variety and fun

### Two independent content layers

**Level theme:** Inkblast scenery, animation, music and that original level's environmental behavior.

**Scheme:** Tile layout, two player starts, density and item configuration.

Keep these separate in data and UI. A scenery choice should not quietly overwrite a player's scheme.

### Launch content target

- Recreate all 11 original theme definitions; inventory their names and exact extras during the reference audit rather than fabricating an original level list.
- Audit the original scheme catalog and include its two-player-compatible layouts. Record excluded team/group schemes explicitly. Any adapted layout must be labeled as an Inkblast duel adaptation, rather than an exact original scheme.
- Add at least 12 curated duel presets using the same rules: compact encounters, open tactical maps, dense demolition, Wally-style throwing and layouts built around the different environmental hazards. Tune routes, spawn separation and item density for two participants.
- Include representative arrow, conveyor, warp, trampoline, delayed-control and regenerating-brick levels. Match where and how the original uses each mechanic.
- Give each theme its own palette, breakable-block art, floor details, perimeter scenery and musical identity, while keeping hazards recognizable.
- Validate every supported theme/scheme combination, or clearly restrict incompatible combinations with an explanation.

### Play modes

1. **Player vs Computer:** quick start against one bot, with easy, normal and hard difficulty.
2. **Two Players:** local head-to-head play with a short input-assignment check.
3. **Custom Match:** applicable original settings and theme/scheme selection for either of the two battle modes.
4. **Arcade Tour:** a short sequence of one-on-one arenas with cumulative standings and a final celebration, playable against one bot or the same local human opponent; no extra participants or changes to the selected underlying combat rules.
5. **Practice:** safe introduction to movement, planting, escape routes and each advanced item.
6. **Map Workshop:** create, test and share local map files.

All battle content is immediately available. Cosmetic medals and local records can reward exploration without locking away rules or arenas.

### Bot design

Bots receive only the observable match state; they do not inspect unrevealed items or future random outcomes. Build decisions around escape, safe movement, item pursuit, breaking routes, attacking and special abilities. Use time-aware danger intervals so a square can be safe now and unsafe before the bot reaches it.

Before placing a bomb, a bot evaluates an escape route. Re-evaluate when a bomb moves, a chain starts or the arena changes. Budget the single bot's searches and schedule strategic decisions at a bounded frequency; immediate danger response still runs every simulation step.

Offer easy, normal and hard presets through reaction delay, planning depth, aggression and bounded mistakes—not different damage, movement or hidden knowledge. Keep these as Inkblast difficulty choices; original AI parity is a separate measured target. Include personality variation without making controls or rules unpredictable.

### Make fun measurable

- First match is reachable within two deliberate actions using defaults.
- Rematch is one action from results; setup remains available without losing preferences.
- In human playtests, record deaths without understood cause, time spent stuck, ease of tracking a character, and desire for another round.
- Test Player vs Computer at every difficulty and Two Players independently, including prolonged duels, excessive hiding and unfair spawn advantages.
- Use automated bot matches to discover stalls, unreachable pickups and broken maps; do not treat bot win rates as proof of fun.
- Run at least two human playtest iterations: one after the first complete arena and another after the full item/hazard set.
- Tune new presets and bot behavior from feedback. Preserve verified classic rule values while doing so.

## 6. Inkblast art and sound production

Match the chosen image's dark navy outlines, cream typography, slate arena, orange brickwork, bright player identities and crisp yellow-orange flames.

### Asset inventory

- Character idle, four-direction run, plant, kick, punch, carry, throw, stun, disease, death and victory states.
- Two distinguishable player identities, with numbers/patterns as well as color.
- Permanent and breakable tiles, destruction animations and environment extras for each theme.
- Regular, remote, jelly and dud bomb states; readable fuses and flight animation.
- Flame center, straight segments and endcaps that communicate exact dangerous cells.
- Item icons, portraits, winner/roulette art and restrained comic impact accents.
- Original music and sound assets with documented provenance; no bundled assets copied from the 1997 game.

Use generated concept art as reference, then create consistent production sprites and atlases. Verify registration, animation continuity, transparent edges and tile seams; a generated sprite sheet is not accepted without frame-by-frame inspection. Share a small finished character/tile/explosion set before producing all eleven themes.

Draw order: floor → ground extras → pickups → blocks/characters/bombs with controlled depth ordering → airborne objects → effects. Keep opaque effects out of safe corridors. Cosmetic particles, screen shake and hit flashes can be reduced independently; all dangerous flame cells stay visible at every quality level.

Use punchy short audio cues for placement, fuse danger, explosions, pickups, throws, deaths and results. Cap simultaneous voices and vary repeated effects. Start/resume audio after a user gesture. Music, effects and character voices each have separate levels and mute controls.

The desktop layout follows the mock's style: compact top clock, dominant arena and a two-player score strip below. Replace the concept's six-character scene and six-player HUD with two characters and two score groups. Label the opponent as CPU in Player vs Computer. Fit narrow screens without cropping the playfield. Touch play against the computer uses a landscape direction pad and two large action buttons; portrait mode shows a clear rotate prompt or a deliberately fitted layout. Two Players uses the supported keyboard/gamepad combinations rather than two overlapping touch-control sets.

## 7. Runtime architecture

### Modules

| Module | Responsibility |
| --- | --- |
| `core/` | State, movement, bombs, blasts, items, hazards, scoring and round lifecycle. |
| `rules/` | Verified constants, compatibility choices and preset definitions. |
| `content/` | Theme and scheme manifests, validation and loading. |
| `ai/` | Observations, danger prediction, movement search and decisions. |
| `input/` | Keyboard/gamepad/touch normalization and player assignment. |
| `render/` | PixiJS scene, atlases, animation, camera sizing and effects. |
| `audio/` | Local sound loading and event playback. |
| `ui/` | Menus, HUD, setup, results, help and accessibility. |
| `storage/` | Versioned persistence, migrations and export/import. |
| `editor/` | Scheme editing and validation through shared content functions. |

Use a few clear systems and typed state objects. Battle state contains exactly two participants, validated at setup, import and match start; do not retain a hidden ten-seat lobby or generalized team system. Do not introduce a generic ECS, physics engine, plugin framework or network abstraction before a concrete need exists. Share movement and collision rules across humans and bots; keep bot forecasts side-effect-free.

### Simulation and time

- Start with a fixed 60 Hz simulation and rendering synchronized to the display, with interpolated visual positions.
- Store gameplay time and movement in controlled integer units; use seeded random generation and stable event ordering.
- Use simulation events for visuals/audio, so effects cannot alter rules or consume gameplay randomness.
- Keep a bounded catch-up policy. Pause on tab hiding or focus loss; never resume into an unexplained instant death.
- Record seed, rules version and tick inputs for reproducible tests and local bug captures.

The fixed rate is a deliberate browser adaptation: external research describes a variable-rate original with some update-count-dependent behavior. Milestone 1 must select and document a reference timing profile. Preserve observed elapsed durations; explicitly document any remaining update-rate-dependent discrepancy rather than claiming an arbitrary 60 Hz choice is exact original emulation. [Timing research](https://github.com/elraro/atomic-bomberman/blob/main/docs/specifications/gameplay.md)

### Asset and storage lifecycle

Load the UI and first arena first; load other theme bundles between matches. Decode audio and prepare textures before starting a round. Persist settings on change, maps on save and tournament progress between rounds, not per frame. Handle unavailable/full storage gracefully and offer JSON backup/restore. No service worker in the first release; add offline caching only after update/version behavior is verified.

## 8. Performance and browser acceptance

These are engineering targets, not measured results.

| Measure | Initial target |
| --- | --- |
| Desktop play | Stable 60 fps at 1080p on representative integrated graphics. |
| Touch play | Target 60 fps on representative recent iOS/Android devices; validate actual hardware. |
| CPU game update | Below 4 ms at the 95th percentile in the two-participant stress scenario. |
| Full active frame | Aim for 16.7 ms or better at the 95th percentile on the baseline device. |
| Input pipeline | Apply captured input on the next simulation step; measure end-to-end responsiveness separately. |
| First playable download | Target at most 5 MB compressed for shell and first arena. |
| Long play | No progressive heap/texture growth after repeated matches and theme changes. |

Batch sprites into atlases, cache static floor/background work, reuse temporary effect objects, cap particles, cap device pixel ratio and minimize render-text updates. Scale decorative effects and render resolution before sacrificing hazard readability. Avoid expensive whole-screen filters in the baseline.

Stress scenarios include one human input stream and one hard bot, the maximum simultaneous bombs reachable by two participants under supported settings, long-range chains, thrown jelly bombs, closing walls, conveyors, disease spread and repeated match restarts. Verify sound mixing and input remain responsive during the busiest moments.

Test current stable Chrome, Edge, Firefox and Safari on desktop; Safari iOS and Chrome Android for touch. Record browser, OS, device and graphics settings with results. Include real gamepad hot-plug, disconnect/reconnect, keyboard rollover, resizing, fullscreen exit, audio resume and WebGL context loss. “Perfect in every browser” is not a measurable guarantee; passing this recorded support matrix is.

## 9. Test strategy

### Rule scenarios

- Blast boundaries, blocker ordering, chain ownership and capacity release.
- Off-center turns, corner assistance and leaving/re-entering a planted bomb.
- Kick/stop, grab/throw, punch/wrap, landing, jelly and trigger interactions.
- Every item, exclusion pair, disease and relevant compound effect.
- One-on-one results in both battle modes, kill scoring, ties, death-resolution windows and roulette awards.
- Reject third participants, extra bots and team-only configurations through setup and imported data.
- Every environment extra, closing walls and their interactions.
- Scheme parsing, densities, start locations, overrides and invalid imports.

### Invariants and reproducibility

For recorded seed/input scenarios, repeated runs must produce identical state hashes. Check that entities stay within valid logical bounds, no item duplication occurs, no bomb bypasses capacity rules, results are emitted once and every active hazard is rendered. Use deliberately invalid map inputs to test bounded validation.

### Browser and visual checks

Exercise setup → match → results → rematch, controller assignment, key rebinding, pause, volume, storage migration, import/export and all editor actions. Compare a controlled gameplay screenshot with the selected concept for composition and art; judge geometry and rules against the ledger. Verify animation in motion, not just screenshots.

## 10. Implementation milestones

| Milestone | Deliverables | Exit condition |
| --- | --- | --- |
| 1. Reference audit | Release baseline, complete option/theme/scheme manifests, rule ledger, unresolved conflicts, timing decision. | Every known original feature mapped to an implementation task, verification task or explicit participant-count/hosting/platform exception. |
| 2. Playable core | Movement, bombs, blasts, one arena, Player vs Computer with one basic bot, Two Players, round/results flow. | Playable test match; core rule scenarios pass; early performance trace recorded. |
| 3. Inkblast vertical slice | Finished art for one arena, character animation, HUD, sound, both one-on-one modes and easy/normal bot presets. | Visually matches the chosen direction and survives first human playtest; art pipeline approved for reuse. |
| 4. Rules completion | Full items/diseases, special bomb behavior, duel kill scoring, closing walls, bonus roulette and settings. | Rule ledger covered by tests; unresolved original behaviors clearly identified. |
| 5. Complete content | Eleven theme definitions, audited two-player-compatible original schemes, curated duel presets and all environment mechanics. | Content manifest coverage and combination validation pass; no placeholder themes. |
| 6. Product and tools | Tutorial, Arcade Tour, editor, local saves, import/export, full gamepad/touch flow, accessibility. | Complete journeys work; a new player can start and rematch without assistance. |
| 7. Fidelity and fun pass | Direct original comparisons, timing resolution, stronger bots, second human playtest and balance adjustments. | No unresolved core parity discrepancies hidden behind “complete”; documented exceptions accepted as scope. |
| 8. Browser release | Performance optimization, cross-browser/device checks, static build and deployment workflow. | Support matrix and production-path checks pass; runtime works without application services. |

The vertical slice is an early review checkpoint, not the finished game. Do not declare completion after one arena or basic planting/explosions. Any verified hidden playable feature discovered in milestone 1 that fits the revised scope receives an explicit task; unfinished/unknown features stay recorded rather than being silently omitted.

## 11. GitHub Pages delivery

1. Use the repository's actual project URL to configure Vite's base path, for example `/bomberman/` for a project site.
2. Keep navigation in application state or hash routes so refresh does not require server rewrites.
3. Bundle fonts, textures, sound and content locally; use base-aware asset URLs everywhere.
4. CI installs from the lockfile, checks types, runs rule/browser checks, builds and uploads `dist/`.
5. Deploy with the official Pages workflow and least-required workflow permissions.
6. Verify the real hosted URL, nested asset paths, refresh, controller input, audio startup and an entire match.
7. Inspect runtime network requests: only static asset delivery is allowed; no hidden application-service dependency.
8. Retain release artifacts/source tags for rollback. Account for saved-data migrations before rolling backward.

Follow [Vite's GitHub Pages deployment guidance](https://vite.dev/guide/static-deploy.html#github-pages). Planning does not publish anything; implementation will use the user's repository and Pages configuration when available.

## 12. Definition of done

- Inkblast's selected look is implemented as animated game assets, not a static background screenshot.
- Eleven complete original theme definitions, the audited two-player-compatible scheme catalog and curated duel layouts are playable.
- Core one-on-one rules and all applicable audited gameplay options are implemented, tested and traceable to evidence.
- Any remaining original-game discrepancy is named; no blanket exact-parity claim while such gaps remain.
- Every battle has exactly two participants: one human plus one bot, or two local humans, with tested keyboard/gamepad combinations. No third participant can be added through the UI or imported data.
- Tutorial, tournament, editor, rematches, local persistence and export/import work.
- Two human playtest passes have informed improvements; no known match-blocking bugs remain.
- The recorded performance and browser acceptance matrix passes.
- GitHub Pages serves the entire game with no backend, runtime secrets or external game services.

**Recommended starting point:** milestone 1 followed immediately by a playable one-arena Inkblast slice. Establish fidelity, responsiveness and fun before multiplying the art/content workload.
