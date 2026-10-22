# Original options → Inkblast

The source for the original option inventory is the [pinned game-mode research](https://github.com/elraro/atomic-bomberman/blob/8dc7f1f772fbc6fe3fa6d4cbb02e028453771c84/docs/specifications/game-modes.md), cross-checked for wins/kills and controls against the [printed manual](https://www.bestoldgames.net/download/games/atomic-bomberman/atomic-bomberman-win-manual.pdf). Defaults below are externally reported original tuning/options-file values, not original executable observations performed here. Inkblast defaults are defined in `src/rules/settings.ts`; its browser profile deliberately differs.

| Original setting | Reported choices/default | Inkblast equivalent / disposition |
| --- | --- | --- |
| Player slots/input | Ten slots OFF / keyboard / joystick / AI; first human plus AI | Exactly two: Player vs Computer or Two Players; input assignment, keyboard/gamepad/touch support |
| AI difficulty | Reference difficulty details not fully audited | Easy/normal/hard are Inkblast presets; no original AI parity claim |
| Level | 0–10 or random per game; default 0 | Eleven original theme names, separate from scheme; new visuals and extras placement |
| Scheme | Local `.sch` files | Twelve new duel adaptations, Workshop, validated local import/export; original catalog incomplete |
| Target wins | Research tuning reports 2; other ports/settings references differ | Configurable target score; browser default in settings file is authoritative for Inkblast |
| Win Matches By Kill Total | No/Yes; No | Wins/Kills; direct original scoring-edge comparison outstanding |
| Team Play | No/Yes; No | Excluded under individual two-participant scope; explicitly team-labelled imports rejected |
| Random Start | No/Yes; No | Shuffle only the two chosen spawn points; original ten-seat shuffling intentionally absent |
| Conveyor Speed | Low/Medium/High; Medium | Belt-speed setting in browser profile |
| Stomped Bombs Detonate | No/Yes; Yes | Closing-wall bomb detonation toggle |
| Gold Bomberman | No/Yes; No | Winner bonus/roulette option; browser presentation and timing adaptation |
| Enclosement Depth | None/A Little/A Lot/All the way; A Little | Closing-depth setting; exact original 0–3 to ring-depth mapping needs comparison |
| Play Time | 60, 90, 120, 150, 180, 240, 300, 600 seconds or infinite; 150 | Round timer with unlimited option (`0`); browser default differs |
| Diseases Can Be Destroyed | No/Yes; Yes | Destroy-disease setting; recycling/order details need direct original comparison |
| Disable Music During Gameplay | No/Yes; No | Music volume, with zero as mute; browser effects/voice controls are modern additions |
| Fullscreen | Platform-dependent legacy presentation | Browser fullscreen action where available |
| Assign Keyboard Player | Select a keyboard set | Two local keyboard sets; physical gamepads are browser devices |
| Define Keyboard Layouts | Twelve direction/action keys plus reset | Browser control setup; parity of every original key code is not claimed |
| Scheme brick density | 0–100 percent | Workshop integer percentage, JSON/SCH persisted |
| Scheme born-with | Per item; diseases/Random disallowed | Workshop starting inventory, 0–10 bounded input |
| Scheme item overrides | Enabled count, or negative 1-in-n chance | Workshop per-item override and separate field-drop availability |
| Scheme Random exclusions | Per item forbidden flag | Workshop separate Random-eligibility checkbox |
| Wally Bomb | Throwing across a solid partition with hand/glove | Wally option and Throwdown preset are duel adaptations; original team layouts omitted |
| Adjust Audio | Research reports unfinished placeholder screen | Working browser volume controls; new functionality |
| Enhanced Memory Model | Restart-required old memory/audio caching tradeoff | Excluded obsolete platform setting; browser asset lifecycle replaces it |
| Network/node/modem/protocol | IPX, modem, serial | Excluded; game runs within one local browser session |
| Hidden campaign/editor | Unfinished campaign; multi-key editor entry | New Arcade Tour and visible Workshop; original hidden modes not certified reproduced |

Persisted settings are sanitized by field and range. Unknown keys, invalid types and unsupported values do not flow into a match. Maps and progress use versioned device storage with session fallback and a downloadable map backup. Imported files never upload to a server.

This manifest inventories known original options and explicit exceptions. It is not a claim that every original conditional interaction, original default, controller behavior or hidden mode has passed parity testing. The [rule ledger](rule-ledger.md) records those limits.
