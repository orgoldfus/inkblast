# Firefox and WebKit engine smoke

Run: 22 October 2026, starting 15:07:58 UTC. Production build served at the `/inkblast/` project subpath from a separate Vite preview. Host reported `darwin 27.0.0 arm64`; viewport 1440 × 1000. Both Playwright engines ran headless with their default launch settings, without a forced WebGL preference or software-rendering flag.

The tested bundle entry was `assets/index-Ree4IKUk.js`, built from the current workspace before its first commit. Its rule data includes `baseSpeed: 75`, the faster movement setting requested during the human playtest. This identifies the tested artifact without pretending that an uncommitted workspace has a Git revision.

| Check | Firefox 157.0 | WebKit 27.2 |
| --- | --- | --- |
| Static production load; visible illustrated arena | Pass | Pass |
| Quick Player vs Computer launch | Pass | Pass |
| Escape pause, stable clock while paused, resume | Pass | Pass |
| Local match setup with one-point target | Pass | Pass |
| Keyboard bomb, stationary player's death, correct 0–1 result | Pass | Pass |
| One-action rematch | Pass | Pass |
| Workshop save to IndexedDB and reload persistence | Pass | Pass |
| Uncaught page errors | None | None |
| Browser console errors | None | None |
| Requests outside the static host | None | None |

Home screenshots from both engines were inspected: the two players, tiles, pickups and surrounding UI rendered. This was not a blank-canvas or DOM-only success. No WebGL initialization problem occurred in these runs. A first preview startup found an occupied port and stopped before launching any engine; the script then used a separate port without touching the existing server.

## Reproduce

Install the matching Playwright engines, then run the script from the repository:

```sh
PLAYWRIGHT_BROWSERS_PATH=/tmp/inkblast-playwright-browsers npx playwright install firefox webkit
PLAYWRIGHT_BROWSERS_PATH=/tmp/inkblast-playwright-browsers node scripts/cross-browser-smoke.mjs
```

The script creates its own production artifact and preview on port 4188, then closes its browsers and server. Set `INKBLAST_SMOKE_PORT` to choose another port, or `INKBLAST_SMOKE_URL` to test an already served build without rebuilding. `INKBLAST_SMOKE_OUTPUT` changes the evidence directory. By default, the JSON report and home/result/Workshop screenshots go into `inkblast-engine-smoke-results` under the operating system's temporary directory. The script exits unsuccessfully if either engine or any check fails; launch and page errors are retained in its report.

## Limits

These are automated **desktop engine smoke checks**, not a claim of physical Safari, iPhone, iPad, Android, installed Firefox release-channel support or physical controller testing. They do not measure audio audibility, end-to-end input latency, long-session memory behavior or sustained frame rate. The Chromium suite provides the broader import/export, mocked-controller, touch-emulation and backup coverage; those checks were not silently counted as Firefox or WebKit tests. Real browser/device acceptance and the two human playtest rounds are tracked in [acceptance](acceptance.md).
