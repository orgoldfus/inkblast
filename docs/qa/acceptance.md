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

Automated self-play found and fixed off-center bomb planting that trapped bots while turning, and rolling-bomb forecasting on conveyors. Self-play detects stalls and obvious tactical errors; it does not establish subjective fun or fair difficulty for every human.

## Performance and assets

- Isolated browser playtest: core update p95 approximately 0.10ms across 820 samples. This excludes AI, GPU work and display timing.
- Renderer stress: CPU render submission p95 approximately 0.30ms over 180 samples with 16 bombs and 117 flame cells. This excludes GPU/display completion.
- See `simulation-matrix.md` for the final two-bot-plus-simulation measurements and theme/layout coverage.
- Production entry JavaScript is about 80KB gzip, CSS about 6KB gzip, plus locally bundled Pixi chunks and a roughly 20KB font. The measured full build is 684,007 bytes uncompressed and approximately 225,123 bytes gzip across all 15 files, below the 5MB first-playable target. Actual network latency is environment-dependent.
- Artwork is generated locally from original drawing code. Music/effects/chirps use local Web Audio synthesis. No runtime service or external font requests.

## Automated acceptance totals

- 58 unit/scenario tests passed across six files. This includes 132 theme/layout self-play combinations plus maximum-inventory stress.
- Seven production Chromium journeys passed in a single run (47.3 seconds before countdown-wait cleanup).

## Open release gates

- Original executable comparison, the audited original two-player scheme catalog, timing conflicts, duds and exact special-item/environment interactions remain unverified or incomplete. See the rule ledger for specific differences.
- Real Edge/Safari and iOS/Android hardware, physical gamepad behavior, keyboard rollover, end-to-end input latency, integrated-GPU frame-time targets, long-session memory stability and WebGL recovery still need device testing.
- Firefox 157.0 and WebKit 27.2 desktop-engine smoke passed rendering, quick play, pause/resume, a full local round/rematch and saved-map reload, with no page errors or external requests. See `browser-engines.md`; these results are not equivalent to the physical-device matrix.
- GitHub Pages is verified only after its workflow succeeds and the live URL completes a real browser round.

The game should be described as a playable Inkblast beta while these plan requirements remain open.
