# Inkblast acceptance record

Date: 22 October 2026. This is an implementation and test record, not a claim of original executable parity.

## Visual and interaction checks

- Compared the live arena against the supplied Inkblast concept: slate floors, heavy navy outlines, orange breakable masonry, cream typography, numbered red/blue characters, visible bomb fuses and yellow-orange connected flame cells.
- Inspected desktop gameplay, narrow-screen layout, Workshop and all eleven theme renderings. Scenery has distinct illustrated motifs, not just a theme-name replacement.
- Chrome 155.0.8059.85 on the development Mac, driven through a separate headless browser: moved the red player, planted a bomb, moved back and turned a corner, survived the explosion, paused and resumed, entered safe practice, opened Workshop and checked a 390px viewport. No page errors; no horizontal overflow. The controlled pause froze the simulation tick.
- Production-build Chromium tests exercise `/inkblast/`, same-origin static requests, reload, a complete round and rematch, both local keyboard players, simulated gamepad assignments/disconnect, touch pointer input, map edits/undo/redo/save/duplicate/delete, IndexedDB persistence, hostile-text imports, original multi-start scheme selection, JSON export and complete device-backup restore.
- Simulated gamepads exercise API routing; they do not certify real controllers, hot-plug hardware or keyboard rollover.

## Human playtest and tuning

1. The user played the preview and reported: “It feels responsive, but I think it should be a little faster. The movement, at least”. Base movement increased from 65 to 75 integer units per tick: 3.9 to 4.5 tiles per second, a 15.4% increase. Fuses remain 150 ticks (2.5 seconds). This is an intentional Inkblast tuning choice.
2. The user played another round at the faster speed and confirmed: “Yes, this speed feels right”. The 75-unit base speed is retained.
3. During the bot/map follow-up, the user was asked to compare Normal and Hard on Classic Clash in the development preview and replied: “Hard feels more challenging and fair”. This supports the human experience in that playtest. The preview was under active development; the response is not a build-fingerprinted comparison or evidence of a universal bot-vs-bot strength ranking.

Automated self-play found and fixed off-center bomb planting that trapped bots while turning, and rolling-bomb forecasting on conveyors. Self-play detects stalls and obvious tactical errors; it does not establish subjective fun or fair difficulty for every human.

## Performance and assets

- Isolated browser playtest: core update p95 approximately 0.10ms across 820 samples. This excludes AI, GPU work and display timing.
- Renderer stress: CPU render submission p95 approximately 0.30ms over 180 samples with 16 bombs and 117 flame cells. This excludes GPU/display completion.
- See `simulation-matrix.md` for the final two-bot-plus-simulation measurements and theme/layout coverage.
- Production entry JavaScript is about 80KB gzip, CSS about 6KB gzip, plus locally bundled Pixi chunks and a roughly 20KB font. The measured full build is 684,007 bytes uncompressed and approximately 225,123 bytes gzip across all 15 files, below the 5MB first-playable target. Actual network latency is environment-dependent.
- Artwork is generated locally from original drawing code. Music/effects/chirps use local Web Audio synthesis. No runtime service or external font requests.

## Automated acceptance totals

- The bot/map follow-up passes 91 unit/scenario tests across seven files, including 132 theme/layout self-play combinations plus maximum-inventory stress. The initial release had 62 tests across six files.
- Eleven production Chromium journeys pass, including four storage/graphics resilience journeys added to the original seven. The restored arena screenshot was inspected after actual WebGL context restoration.
- Firefox 157 and WebKit 27.2 smoke checks were repeated during the follow-up: load, CPU start, pause/resume, local full round/rematch and map persistence passed without page errors or external application requests. These engine checks do not certify native Safari/iOS devices.

## Open release gates

- Original executable comparison, the audited original two-player scheme catalog, timing conflicts, duds and exact special-item/environment interactions remain unverified or incomplete. See the rule ledger for specific differences.
- Real Edge/Safari and iOS/Android hardware, physical gamepad behavior, keyboard rollover, end-to-end input latency, integrated-GPU frame-time targets and long-session/GPU memory stability still need device testing. Injected WebGL loss/restoration now passes Chromium checks, including refusal to resume before restoration; hardware/driver recovery remains unverified.
- Firefox 157.0 and WebKit 27.2 desktop-engine smoke passed rendering, quick play, pause/resume, a full local round/rematch and saved-map reload, with no page errors or external requests. See `browser-engines.md`; these results are not equivalent to the physical-device matrix.


The game should be described as a playable Inkblast beta while these plan requirements remain open.

## Bot, map and resilience follow-up

The [paired balance evaluation](balance.md) records before/after and independent validation results. Bots now navigate around visible dead ends, avoid seeking disease pickups, compensate reversed controls, update unsafe escape waypoints, forecast immediate burning-bomb chains, and use safe emergency Punch/Grab actions. Trigger decisions respect chain danger and action priority. Shared throw projection keeps planning and simulation aligned. Movement remains the user-approved 75 units per tick.

All twelve authored layouts have equal starting space, two initial exits, safe first-bomb escapes, reachable territory and alternate connecting routes. Directional arrows and conveyors now rotate with the opposite starting corner, including a neutral center. Layouts retain their distinct demolition pacing; symmetry and automated matches do not establish human enjoyment.

Production browser tests inject full-storage failures and verify session-only warnings, map JSON export, settings/maps/records backup after failed overwrites, and session deletion of maps whose device copy cannot be deleted. Unsaved session values take precedence over older persisted records. A [33-round browser lifecycle run](browser-soak.md) covered all eleven themes without page errors; its small retained heap increase remains an observation requiring longer profiling.

The user confirmed no original installation or map files are available. Original scheme coverage, duds and exact executable parity therefore remain open evidence gaps; this follow-up does not mark them complete. Human difficulty feedback is positive; broader map pacing, two-human play, and real controllers/phones still need assessment. Further AI planning limits are listed in the balance report.

## Published release verification

The [public site](https://orgoldfus.github.io/inkblast/) passed a complete Chrome 155 hosted-site playtest after [release workflow 39803728668](https://github.com/orgoldfus/inkblast/actions/runs/39803728668) succeeded for code commit `e276fc3be50d551ede6697144bec00e636bef679`. The checks loaded and refreshed the project URL, started a local duel, planted a bomb, observed the correct 0–1 result, rematched, paused and returned home. No page errors, failed HTTP responses or requests outside the static site origin were recorded. The final gameplay screenshot was visually inspected.

The first CI attempt exposed a test-readiness race: the countdown element could be empty before its first frame. The browser suite now waits for the explicit active-round state. Three repeated two-keyboard scenarios and the full GitHub browser suite passed after the correction.
