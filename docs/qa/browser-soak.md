# Bounded browser lifecycle soak

Run from the repository root:

```sh
rtk proxy node scripts/browser-soak.mjs
```

The script builds the current workspace into a temporary directory, serves that
isolated production build at `http://127.0.0.1:4187/inkblast/`, and launches installed
Google Chrome through Playwright. It uses the existing dependencies. Port 4187
must be free. The preview process and temporary build are cleaned up afterward.
The complete run has a five-minute watchdog.

One browser context and page remain alive throughout three cycles of all eleven
themes, producing 33 completed local matches. Every match uses Classic Clash and
a one-point target. The script waits for the actual `data-phase="active"` state,
checks the selected theme and local opponent, plants Player One's bomb without
moving either player, checks the completed 0–1 result, returns home, and verifies
that exactly one canvas remains. The next match changes the theme through the
normal setup form.

At the initial home screen and after every eleven matches, Chrome's DevTools
Protocol forces garbage collection and records `Runtime.getHeapUsage` and
`Memory.getDOMCounters`. The report compares the final sample with the first
completed cycle, after every theme has had a chance to initialize its resources.
Memory differences are observations, without an arbitrary percentage pass limit.
Lifecycle assertions, uncaught exceptions, browser console errors, failed
requests, and the deadline determine the script's exit status.

The default output directory is `artifacts/browser-soak/`, which is ignored by
Git. Set `INKBLAST_SOAK_OUTPUT` to retain a separate run directory. Outputs are
`report.json`, `first-round.png`, and `last-result.png`, with `failure.png` when a
failure can still be captured. The report includes the source commit, workspace
dirty state, production entry hash, browser version, host, per-match timings,
error lists, and raw samples.

## Interpretation

This checks repeated match completion, theme switching, retained JavaScript heap,
DOM objects, event listeners, and canvas count within a short real-browser run.
It does not establish multi-hour stability, physical GPU behavior, GPU memory
stability, controller reliability, or human gameplay quality. A small heap change
alone neither proves a leak nor establishes that none exists. Longer runs and
heap allocation traces are appropriate if repeated samples show continuing
growth.

## Recorded run

On 2026-10-22 at 15:44 UTC, Chrome `155.0.8059.85` on macOS arm64 completed all
33 matches in **252.5 seconds**, with zero uncaught page errors, zero console
errors, and zero failed requests. Every match ended 0–1 and returned to the main
menu successfully. The build used commit
`fc7ea7b381894060145efd1125494c5450d6af07` **plus uncommitted workspace changes**;
its production entry was `/inkblast/assets/index-sOcRDHFo.js`. This identifies a
local QA build rather than a released commit.

| Sample       | Completed matches | Used JS heap after GC | Documents | DOM nodes | JS listeners | Canvases |
| ------------ | ----------------: | --------------------: | --------: | --------: | -----------: | -------: |
| Initial home |                 0 |           5,613,528 B |         1 |     1,237 |          104 |        1 |
| Warm cycle 1 |                11 |           7,665,296 B |         1 |     1,314 |          105 |        1 |
| Cycle 2      |                22 |           7,939,420 B |         1 |     1,315 |          105 |        1 |
| Cycle 3      |                33 |           8,114,480 B |         1 |     1,314 |          105 |        1 |

From the warmed first cycle to the final cycle, used JavaScript heap increased
**449,184 bytes (0.428 MiB, 5.86%)**. The two later increments were 274,124 and
175,060 bytes. Embedder heap increased 57,456 bytes; backing storage decreased
699 bytes. Documents, DOM nodes, listeners, and canvases ended at exactly their
warmed counts. The observed heap increase remains a measurement to follow up in
longer profiling; these three samples do not establish a leak or a plateau.

The first attempt built successfully but could not bind the local preview port
inside the filesystem/network sandbox. The recorded run used the reviewed local
server/browser permission and completed the full sequence once.

Local evidence: [raw report](../../artifacts/browser-soak/report.json),
[first active round](../../artifacts/browser-soak/first-round.png), and
[last match result](../../artifacts/browser-soak/last-result.png). These ignored
artifacts need to be copied separately when sharing the QA evidence.
