# Inkblast

A comic arena game for exactly two rivals: one human versus a computer, or two local humans. Eleven themed arenas, twelve new duel maps, practice, Arcade Tour and a local map workshop run entirely in the browser. All artwork and synthesized audio are original to this project.

[Play Inkblast](https://orgoldfus.github.io/inkblast/) · [Acceptance record and remaining release gates](docs/qa/acceptance.md)

## Play and develop

Use Node.js 24 and npm. Install with `npm ci`, then run `npm run dev`. `npm run build` typechecks and produces the static site in `dist/`; `npm run preview` serves that build. Assets are bundled locally and use relative paths, including on a GitHub Pages project URL.

Choose your opponent and press **Let’s Blast**. The match setup offers independent theme/map choices, duration, score rules, input assignment, sound and motion settings. Against the computer, choose **Solo keyboard → WASD or Arrow keys** in **Set up a match**; both presets plant bombs with Space and use E for the special action. This device remembers your solo controls for matches, Practice and solo Arcade Tour, separately from two-player bindings. Custom keys are available under **Sound, motion & keyboard**; inspect the on-screen hints for the current layout. Escape pauses. Local player two and gamepad controls are shown in setup and below the arena. On mobile, a left-thumb joystick and large Bomb/Action buttons support moving and bombing together. The joystick has a neutral center and snaps to four directions; release it to stop steering. Controls sit at the bottom in portrait and beside the arena in landscape, with space for phone safe areas. Touch controls support one human against the computer. Switching tabs pauses the battle.

The Workshop supports pointer/touch drawing and keyboard editing. Choose a drawing tool, use arrow keys to move through the grid and Space to paint. A map needs two distinct open starts and a route through floor/destructible bricks between them. Edit density, healthy starting items, field overrides and Random eligibility. Undo/redo, save, duplicate, delete, JSON backup and `.sch` import/export stay on the device. Original files with more than two starts require choosing two; explicitly team-labelled schemes are rejected.

## Verification

`npm test` runs the deterministic simulation/content/storage tests. Install Chromium with `npx playwright install chromium`, then run `npm run test:browser` for production-build browser checks. They build to a separate temporary folder and run under `/inkblast/` to exercise a real project subpath. Browser checks cover static-only requests, keyboard bomb → result → rematch, pause/resume, Workshop editing/undo/save/reload/import/export, and a narrow touch viewport. Failed runs keep screenshots and traces in `test-results/`.

`npm run balance -- --seeds=6` runs paired bot matches with player assignments and physical starts swapped. The [balance report](docs/qa/balance.md) explains the protocol, before/after results and limits of self-play. `node scripts/browser-soak.mjs` runs 33 complete local rounds across all eleven themes using installed Chrome and records post-GC heap and DOM samples; see the [bounded browser soak](docs/qa/browser-soak.md). Browser checks also inject storage failures and WebGL loss/restoration, including an attempted premature resume.

The GitHub workflow runs unit tests, Chromium checks and the production build before publishing to Pages. Select **GitHub Actions** as the repository's Pages source. A deployment is only verified after that workflow completes and the live URL is tested. There are no runtime accounts, hosted matches, application APIs, telemetry, secrets or cloud saves.

## Compatibility status

This build is a browser interpretation of Atomic Bomberman, **not a verified exact emulation**. [The implementation plan](IMPLEMENTATION_PLAN.md) is the target scope; it is not a statement that every release gate has passed. The [reference audit](docs/reference-audit.md), [rule ledger](docs/rule-ledger.md) and [options manifest](docs/options-manifest.md) identify sources, adaptations and outstanding work.

- The eleven original names and hazard families follow pinned external research. Theme palettes, artwork, audio, exact extra placement and all twelve supplied layouts are new Inkblast adaptations.
- The original two-player scheme catalog has not been audited because original scheme files were unavailable. The supplied layouts are labeled adaptations. Original `.sch` support is a validated version-2 subset; JSON is the preferred lossless Inkblast backup.
- Fixed 60 Hz timing and simplified mechanics differ from the original. Movement, thrown bombs, Jelly, disease interactions, scoring edges, regeneration, roulette and environmental effects still require controlled comparison. Dud-bomb behavior is not implemented because its activation conditions remain unverified. The unfinished original hidden campaign is not reproduced. Arcade Tour is a new mode.
- Automated Chromium success does not certify physical gamepads, actual Safari/Edge, iOS/Android hardware, audio startup on every browser, 60 fps on representative devices, or human map balance. Injected WebGL recovery is covered in Chromium; this does not reproduce every driver failure. Physical-device checks remain release work; two user playtest rounds have informed and confirmed faster movement. See the acceptance record for engine-specific results.

Settings use versioned local storage; maps and progress use IndexedDB. If storage is unavailable, the current session remains playable and the Workshop reports that its save is temporary. Export JSON backups to keep custom maps beyond browser data clearing or eviction. This release has no service worker, so a fresh load needs access to the static host.

About this edition includes a full settings/maps/records backup and restore. Arcade Tour saves a checkpoint between arenas. Practice offers safe movement and selectable item training. Pause includes a downloadable seed/state/input record for reproducible bug investigation; the record is never uploaded. See [asset provenance](docs/ASSETS.md) for artwork, audio and font details.
