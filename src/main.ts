import "./style.css";
import { installMenuNavigation } from "./ui/menu-navigation";
import {
  playerScoreMarkup,
  updatePlayerInventory,
  itemGuideMarkup,
  pickupIconMarkup,
} from "./ui/player-inventory";
import { ArenaRenderer } from "./render/arena";
import {
  applyItem,
  applyMysteryItem,
  createGame,
  stepGame,
} from "./core/simulation";
import { botInput } from "./ai/bot";
import {
  awardWinnerBonus,
  BONUS_LABELS,
  type WinnerBonus,
} from "./rules/bonus";
import { exportBackup, importBackup } from "./storage/backup";
import { loadTour, saveTour } from "./storage/tour";
import { pickupFeedback } from "./rules/pickups";
import { DEFAULT_SETTINGS } from "./rules/settings";
import { THEMES, SCHEMES } from "./content/catalog";
import {
  Controls,
  isBinding,
  keyLabel,
  SOLO_BINDINGS,
  type InputAssignment,
} from "./input/controls";
import { Sound } from "./audio/sound";
import { MapEditor } from "./editor/editor";
import {
  loadSettings,
  saveSettings,
  loadMaps,
  loadProgress,
  saveProgress,
  storageWarning,
} from "./storage/storage";
import {
  EMPTY_INPUT,
  TICK_RATE,
  type GameState,
  type ItemType,
  type MatchSettings,
  type Scheme,
} from "./core/types";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header class="masthead">
    <a href="#" class="wordmark" aria-label="Inkblast home">INKBLAST<span>LOCAL DUELS. LOUD CONSEQUENCES.</span></a>
    <div class="match-clock" hidden><span id="round-label">ROUND 1</span><strong id="clock">02:00</strong></div>
    <div class="header-actions"><button id="sound-toggle" class="icon-button" aria-label="Mute sound" title="Mute sound">♪</button><button id="fullscreen" class="icon-button" aria-label="Fullscreen" title="Fullscreen">⛶</button><button id="pause-button" hidden>PAUSE Ⅱ</button><span class="edition">THE COMIC ARENA BRAWLER</span></div>
  </header>
  <main>
    <section id="home" class="home-screen" aria-labelledby="menu-title">
      <div class="arcade-title"><h1 id="menu-title">INKBLAST</h1><p>SMALL ARENA. BIG TROUBLE.</p></div>
      <div class="menu-content">
        <nav id="main-menu" class="arcade-list" aria-label="Main menu">
          <button id="quick-play" data-hint="You against the computer. Straight into the arena.">1 PLAYER</button>
          <button id="local-play" data-hint="Two players. One keyboard or your own gamepads.">2 PLAYERS</button>
          <button id="tour-menu" data-hint="Five arenas. One champion.">ARCADE TOUR</button>
          <button id="custom-button" data-hint="Match rules, controls, sound and display.">OPTIONS</button>
          <button id="extras-button" data-hint="Practice, map workshop and field guide.">EXTRAS</button>
        </nav>
        <nav id="extras-menu" class="arcade-list" aria-label="Extras" hidden>
          <h2>EXTRAS</h2>
          <button id="practice-button" data-hint="Learn the controls in a safe arena.">PRACTICE</button>
          <button id="workshop-button" data-hint="Build a map. Make your own trouble.">MAP WORKSHOP</button>
          <button id="help-button" data-hint="Bombs, power-ups and how to survive them.">FIELD GUIDE</button>
          <button id="about-button" data-hint="Local records, device backups and game credits.">ABOUT &amp; BACKUPS</button>
          <button data-menu-back>BACK</button>
        </nav>
        <nav id="tour-menu-list" class="arcade-list" aria-label="Arcade Tour" hidden>
          <h2>ARCADE TOUR</h2>
          <button id="resume-tour" hidden>CONTINUE TOUR</button>
          <button id="tour-button">NEW TOUR</button>
          <button data-menu-back>BACK</button>
        </nav>
        <p id="menu-hint" class="menu-hint" aria-live="polite">You against the computer. Straight into the arena.</p>
      </div>
      <p class="menu-keys"><span><kbd>↑</kbd><kbd>↓</kbd> SELECT</span><span><kbd>ENTER</kbd> CONFIRM</span><span><kbd>ESC</kbd> BACK</span></p>
      <div id="arena-parking" hidden><div id="arena-host" aria-label="Inkblast game arena"></div></div>
    </section>
    <section id="battle" class="battle-screen" hidden><div id="battle-arena-slot"></div><div id="battle-announcement" class="battle-announcement" aria-live="polite"></div><div class="score-strip">${playerScoreMarkup(1)}<div class="duel-label"><span id="battle-theme">CLASSIC</span><b>VS</b><small id="battle-mode">FIRST TO 3</small></div>${playerScoreMarkup(2)}</div><div id="controls-hint" class="controls-hint"></div><div id="touch-controls" class="touch-controls"><div class="joystick" data-joystick role="group" aria-label="Movement joystick" aria-describedby="joystick-help"><span class="joystick-base" aria-hidden="true"></span><span class="joystick-stick" aria-hidden="true"></span><span class="joystick-label" aria-hidden="true">MOVE</span></div><span id="joystick-help" class="sr-only">Touch anywhere on the pad, then slide to move. Release to stop steering. Keyboard controls also work.</span><div class="touch-actions"><button data-control="action">ACTION</button><button data-control="bomb" class="bomb-button">BOMB</button></div></div><div id="practice-tip" class="practice-tip" hidden></div><div id="practice-tools" class="practice-tools" hidden><label>Try a power-up <select id="practice-item"><option value="mystery">Mystery pickup</option><option value="bomb">Extra Bomb</option><option value="flame">Flame</option><option value="goldflame">Goldflame</option><option value="skate">Skates</option><option value="kick">Kick</option><option value="punch">Punch</option><option value="grab">Grab</option><option value="spooge">Spooge</option><option value="trigger">Trigger</option><option value="jelly">Jelly</option><option value="disease">Disease</option><option value="superDisease">Super disease</option></select></label><button id="practice-give">GIVE ITEM</button><button id="practice-reset">RESET INVENTORY</button></div></section>
    <section id="workshop" hidden></section>
  </main>
  <dialog id="setup-dialog" class="panel-dialog arcade-dialog" aria-label="Options"><form id="setup-form">
    <h2 id="options-title">OPTIONS</h2>
    <nav id="options-menu" class="arcade-list" aria-label="Options">
      <button type="button" data-settings-link="match">MATCH SETTINGS</button>
      <button type="button" data-settings-link="controls">CONTROLS &amp; KEYS</button>
      <button type="button" data-settings-link="audio">SOUND &amp; DISPLAY</button>
      <button type="button" data-settings-link="rules">ADVANCED RULES</button>
      <button type="button" data-options-close>BACK</button>
    </nav>
<section data-settings-page="match" hidden><h2>MATCH SETTINGS</h2><div class="settings-grid"><label>Opponent<select name="mode"><option value="cpu">Computer</option><option value="local">Two Players</option></select></label>
      <label>Computer difficulty<select name="difficulty"><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></label>
      <label>Arena theme<select name="themeId"></select></label>
      <label>Map layout<select name="schemeId"></select></label>
      <label>First to<select name="targetScore"><option value="1">1 point · quick duel</option><option value="3">3 points</option><option value="5">5 points</option><option value="7">7 points</option><option value="10">10 points</option></select></label>
      <label>Round clock<select name="roundSeconds"><option value="60">1 minute</option><option value="90">1½ minutes</option><option value="120">2 minutes</option><option value="150">2½ minutes</option><option value="180">3 minutes</option><option value="240">4 minutes</option><option value="300">5 minutes</option><option value="600">10 minutes</option><option value="0">Unlimited</option></select></label>
      <label class="check mystery-option"><input type="checkbox" name="mysteryPickups" aria-describedby="mystery-description">Mystery pickups</label></div><p id="theme-description" class="field-note"></p><p id="mystery-description" class="field-note">Mystery pickups: 75% helpful, 25% trouble. Bad effects last 7 seconds.</p></section>
    <section data-settings-page="controls" hidden><h2>CONTROLS &amp; KEYS</h2><div class="settings-grid"><label>Controllers<select id="input-assignment"><option value="keyboard">Shared keyboard</option><option value="mixed">Keyboard + gamepad</option><option value="gamepads">Two gamepads</option></select></label>
      <label id="solo-keyboard-field">Solo keyboard<select id="solo-keyboard"><option value="wasd">WASD</option><option value="arrows">Arrow keys</option><option value="custom" disabled>Custom keys</option></select></label></div><p id="controller-status" class="field-note">Keyboard ready.</p><div id="key-bindings"></div><p class="field-note">Select a key and press its replacement. Escape cancels.</p></section>
    <section data-settings-page="audio" hidden><h2>SOUND &amp; DISPLAY</h2><div class="settings-grid"><label>Music<input name="music" type="range" min="0" max="1" step="0.01"></label>
      <label>Sound effects<input name="effects" type="range" min="0" max="1" step="0.01"></label>
      <label>Character sounds<input name="voices" type="range" min="0" max="1" step="0.01"></label>
      <label class="check"><input type="checkbox" name="reducedMotion">Reduce motion & particles</label></div><div class="arcade-list"><button id="menu-sound" type="button">MUTE SOUND</button><button id="menu-fullscreen" type="button">FULLSCREEN</button></div></section>
    <section data-settings-page="rules" hidden><h2>ADVANCED RULES</h2><div class="settings-grid"><label>Score by<select name="scoring"><option value="wins">Round wins</option><option value="kills">Opponent eliminations</option></select></label>
      <label>Closing walls<select name="enclosureDepth"><option value="0">Off</option><option value="1">One ring</option><option value="2">Two rings</option><option value="3">Three rings</option><option value="4">Four rings</option><option value="5">To the center</option></select></label>
      <label>Conveyor speed<select name="conveyorSpeed"><option value="0.5">Slow</option><option value="1">Normal</option><option value="2">Fast</option></select></label>
      <label class="check"><input type="checkbox" name="randomStarts">Swap starting corners</label>
      <label class="check"><input type="checkbox" name="winnerBonus">Winner roulette bonus</label>
      <label class="check"><input type="checkbox" name="destroyDiseases">Flames destroy disease pickups</label>
      <label class="check"><input type="checkbox" name="stompBombs">Landing bombs detonate on contact</label>
      <label class="check"><input type="checkbox" name="wally">Wally throwing loadout</label></div><p class="field-note">Starting items and pickup selection are editable in Map Workshop.</p></section>
    <div id="settings-actions" class="arcade-list" hidden><button type="button" id="options-back">BACK</button><button type="submit">START MATCH</button></div>
    <p class="menu-keys"><span><kbd>↑</kbd><kbd>↓</kbd> SELECT</span><span><kbd>ENTER</kbd> CHANGE</span><span><kbd>ESC</kbd> BACK</span></p>
    <p class="field-note">Changes save automatically.</p><p id="setup-error" role="alert"></p>
  </form></dialog>
  <dialog id="rotate-dialog" class="panel-dialog compact rotate-dialog" aria-labelledby="rotate-title" aria-describedby="rotate-help"><span class="rotate-device" aria-hidden="true"></span><h2 id="rotate-title">TURN UP THE CHAOS.</h2><p id="rotate-help">Rotate your device to landscape to play.<br>Your game is on hold.</p><button id="rotate-leave" class="text-button">Back to main menu</button></dialog>
  <dialog id="pause-dialog" class="panel-dialog compact"><p class="eyebrow">TAKE A BREATHER</p><h2>FUSE ON HOLD.</h2><p id="pause-reason">Your arena will be right here.</p><button id="resume-button" class="primary">BACK TO THE BLAST</button><button id="restart-button">RESTART MATCH</button><button id="export-replay" class="text-button">Save a replay record</button><button id="leave-button" class="text-button">Leave for main menu</button></dialog>
  <dialog id="result-dialog" class="panel-dialog result-dialog"><p id="result-kicker" class="eyebrow">THAT’S A WRAP</p><div id="winner-mark" class="winner-mark">1</div><h2 id="result-title">PLAYER ONE WINS!</h2><p id="result-copy"></p><p id="result-bonus" class="bonus-note" hidden></p><div class="result-score"><span id="result-p1">0</span><small>—</small><span id="result-p2">0</span></div><button id="next-button" class="primary">NEXT ROUND ↗</button><button id="result-setup">CHANGE THE SETUP</button><button id="result-home" class="text-button">Main menu</button></dialog>
  <dialog id="help-dialog" class="panel-dialog"><div class="dialog-heading"><div><p class="eyebrow">A SHORT COURSE IN CHAOS</p><h2>THE FIELD GUIDE.</h2></div><button data-close class="close-button" aria-label="Close guide">×</button></div><div class="guide-steps"><article><b>01</b><h3>MAKE AN EXIT.</h3><p>Bombs explode in a cross. Solid blocks stop fire; orange bricks break. Turn a corner before your fuse runs out.</p></article><article><b>02</b><h3>TAKE A CHANCE.</h3><p>Broken bricks reveal pickups. Mystery pickups are on by default: one icon, 75% helpful, 25% trouble. Watch your player’s strip for the reveal and a 7-second penalty countdown. Switch them off in match setup for visible items.</p></article><article><b>03</b><h3>THINK ONE BOMB AHEAD.</h3><p>Fire lights other bombs instantly. Trap a rival with a chain reaction—but leave yourself a way out.</p></article></div><div class="item-guide">
  ${itemGuideMarkup()}</div><p class="field-note">Action priority depends on your loadout. Keep an eye on the inventory strip below your player. Hazards and closing walls vary with your setup.</p><button id="guide-practice" class="primary">TRY PRACTICE ↗</button></dialog>
  <dialog id="about-dialog" class="panel-dialog"><div class="dialog-heading"><h2>THE SMALL PRINT.</h2><button data-close class="close-button" aria-label="Close about">×</button></div><p>Inkblast is an original, device-local browser interpretation of classic bomb duels. All artwork and audio are created for this game, including original music and arcade effects generated with ElevenLabs.</p><p>Two participants, eleven scenery themes, curated duel layouts, and a local map workshop. Arcade Tour is an Inkblast mode.</p><p>Original-game fidelity is still under verification. Fixed 60 Hz timing, some item interactions, environmental placement, scoring details, and imported scheme behavior may differ from the 1997 game. This build does not claim exact emulation.</p><p>No account, network matches, trackers, or application server. Settings and maps stay in this browser; export maps from the workshop to keep a copy.</p><p id="local-record"></p><div class="dialog-footer"><button id="export-backup">EXPORT DEVICE BACKUP</button><button id="restore-backup">RESTORE BACKUP</button><input id="backup-file" type="file" accept=".json,application/json" hidden></div></dialog>
  <div id="toast" class="toast" role="status" hidden></div>
`;

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
const home = el("home");
const battle = el("battle");
const host = el("arena-host");
const setupForm = el<HTMLFormElement>("setup-form");
let settings: MatchSettings = { ...DEFAULT_SETTINGS };
let state: GameState;
let renderer: ArenaRenderer;
let screen: "home" | "battle" | "workshop" = "home";
let paused = false;
let round = 1;
let scores: [number, number] = [0, 0];
let matchOver = false;
let mode: "battle" | "practice" | "tour" = "battle";
let tourRound = 0;
let customScheme: Scheme | null = null;
let maps: Scheme[] = [];
let editor: MapEditor | null = null;
let progress = { played: 0, wins: 0, tourBest: 0, seenThemes: [] as string[] };
let accumulator = 0;
let previousTime = 0;
let resultHandled = false;
let muted = false;
let previousHud = "";
let bonus: WinnerBonus | null = null;
let bonusWinner: 0 | 1 | null = null;
let practiceStarted = 0;
const updateTimes: number[] = [];
let replayInputs: number[][] = [];
let replayStart: GameState | null = null;
const directions = [null, "up", "down", "left", "right"];
const controls = new Controls();
const touchScreen = window.matchMedia("(pointer: coarse)");
const portraitScreen = window.matchMedia("(orientation: portrait)");
const sound = new Sound();
function needsRotation(): boolean {
  return touchScreen.matches && portraitScreen.matches;
}
function syncOrientation(): void {
  const rotate = el<HTMLDialogElement>("rotate-dialog");
  const blocked = screen === "battle" && needsRotation();
  if (blocked) {
    pause("Device rotated. Resume when you’re ready to play in landscape.");
    if (!rotate.open) rotate.showModal();
  } else if (rotate.open) {
    rotate.close();
  }
}
window.addEventListener("resize", syncOrientation);
portraitScreen.addEventListener("change", syncOrientation);
touchScreen.addEventListener("change", syncOrientation);
el("rotate-dialog").addEventListener("cancel", (event) =>
  event.preventDefault(),
);
el("rotate-leave").onclick = goHome;
controls.onPause = () => {
  if (screen === "battle")
    paused ? resume() : pause("Your arena will be right here.");
};
controls.bindTouch(el("touch-controls"));

function toast(message: string): void {
  el("toast").textContent = message;
  el("toast").hidden = false;
  window.setTimeout(() => {
    el("toast").hidden = true;
  }, 4000);
}
function openDialog(id: string): void {
  const dialog = el<HTMLDialogElement>(id);
  if (!dialog.open) dialog.showModal();
}
function closeDialogs(): void {
  document
    .querySelectorAll<HTMLDialogElement>("dialog[open]")
    .forEach((dialog) => dialog.close());
}
function persist(): void {
  void saveSettings(settings).then((saved) => {
    if (!saved)
      toast(
        "Settings could not be saved on this device. Changes last for this session only.",
      );
  });
}
function currentScheme(): Scheme {
  return (
    customScheme ??
    [...SCHEMES, ...maps].find((scheme) => scheme.id === settings.schemeId) ??
    SCHEMES[0]
  );
}
function currentTheme() {
  return THEMES.find((theme) => theme.id === settings.themeId) ?? THEMES[0];
}
function renderScores(): void {
  ([0, 1] as const).forEach((id) => {
    el(`p${id + 1}-score`).innerHTML =
      settings.scoring === "wins" && settings.targetScore <= 7
        ? Array.from(
            { length: settings.targetScore },
            (_, i) => `<i class="${i < scores[id] ? "earned" : ""}"></i>`,
          ).join("")
        : `<strong>${scores[id]}</strong>`;
  });
}
function hints(): void {
  const key = (value: string) => `<kbd>${keyLabel(value)}</kbd>`;
  const a = controls.activeBindings[0];
  const b = controls.bindings[1];
  el("controls-hint").innerHTML =
    controls.assignment === "gamepads"
      ? "<span>STICK / D-PAD <b>MOVE</b></span><span><kbd>A</kbd> BOMB</span><span><kbd>B</kbd> ACTION</span>"
      : `<span>${key(a.up)}${key(a.left)}${key(a.down)}${key(a.right)} <b>MOVE</b></span><span>${key(a.bomb)} BOMB</span><span>${key(a.action)} ACTION</span>${!controls.solo ? `<span class="p2-hint">P2: ${controls.assignment === "mixed" ? "GAMEPAD · A / B" : `${key(b.up)}${key(b.left)}${key(b.down)}${key(b.right)} · ${key(b.bomb)} / ${key(b.action)}`}</span>` : ""}`;
  el("touch-controls").classList.toggle(
    "local-disabled",
    settings.mode === "local" && mode !== "practice",
  );
}
function startRound(): void {
  closeDialogs();
  resultHandled = false;
  paused = false;
  battle.dataset.paused = "false";
  battle.classList.toggle("reduced-motion", settings.reducedMotion);
  previousHud = "";
  accumulator = 0;
  controls.clear();
  controls.solo = mode === "practice" || settings.mode === "cpu";
  const theme =
    mode === "tour"
      ? THEMES[(tourRound * 2) % THEMES.length]
      : settings.themeId === "random"
        ? THEMES[Math.floor(Math.random() * THEMES.length)]
        : currentTheme();
  const scheme =
    mode === "tour" ? SCHEMES[tourRound % SCHEMES.length] : currentScheme();
  state = createGame(
    scheme,
    theme,
    settings,
    Math.floor(Math.random() * 0x7fffffff),
  );
  if (mode === "tour" && !saveTour({ round: tourRound, scores, settings }))
    toast("Tour progress could not be saved on this device.");
  if (bonus && bonusWinner !== null)
    awardWinnerBonus(state, bonusWinner, bonus);
  if (mode === "practice") {
    state.remaining = Infinity;
    state.settings = { ...state.settings, roundSeconds: 0, enclosureDepth: 0 };
    state.players[0].invulnerableUntil = Number.MAX_SAFE_INTEGER;
    practiceStarted = 0;
  }
  replayInputs = [];
  replayStart = structuredClone(state);
  battle.dataset.phase = state.phase;
  home.hidden = true;
  battle.hidden = false;
  el("workshop").hidden = true;
  el("battle-arena-slot").append(host);
  screen = "battle";
  controls.enabled = true;
  el("pause-button").hidden = false;
  document.querySelector<HTMLElement>(".match-clock")!.hidden = false;
  document.querySelector<HTMLElement>(".edition")!.hidden = true;
  el("p2-name").textContent =
    mode === "practice"
      ? "PRACTICE DUMMY"
      : settings.mode === "cpu"
        ? `CPU / ${settings.difficulty.toUpperCase()}`
        : "PLAYER TWO";
  el("battle-theme").textContent = state.theme.name.toUpperCase();
  el("battle-mode").textContent =
    mode === "tour"
      ? `STOP ${tourRound + 1} / 5`
      : mode === "practice"
        ? "SAFE PRACTICE"
        : `FIRST TO ${settings.targetScore}`;
  el("practice-tip").hidden = mode !== "practice";
  el("practice-tools").hidden = mode !== "practice";
  renderScores();
  hints();
  sound.configure(
    muted ? { ...settings, music: 0, effects: 0, voices: 0 } : settings,
  );
  sound.start(state.theme.music, state.hurry);
  document.body.classList.add("in-battle");
  document.body.dataset.screen = "battle";
  el("pause-button").focus();
  (touchScreen.matches ? el("pause-dialog") : battle).append(
    el("practice-tools"),
  );
  syncOrientation();
}
async function startMatch(kind: typeof mode = "battle"): Promise<void> {
  if (!renderer) {
    toast("The arena is still loading. Please try again in a moment.");
    return;
  }
  if (!renderer.graphicsAvailable) {
    toast(
      "The graphics connection is still recovering. Please wait for the arena to return.",
    );
    return;
  }
  if (kind !== "practice" && controllerError()) {
    showSetup("controls");
    el("setup-error").textContent = controllerError();
    return;
  }
  mode = kind;
  scores = [0, 0];
  round = 1;
  tourRound = 0;
  matchOver = false;
  bonus = null;
  if (kind === "practice") controls.assignment = "keyboard";
  await sound.unlock();
  startRound();
}
function goHome(): void {
  closeDialogs();
  screen = "home";
  controls.enabled = false;
  controls.clear();
  sound.stop();
  paused = false;
  home.hidden = false;
  battle.hidden = true;
  el("workshop").hidden = true;
  el("arena-parking").append(host);
  el("pause-button").hidden = true;
  document.querySelector<HTMLElement>(".match-clock")!.hidden = true;
  document.querySelector<HTMLElement>(".edition")!.hidden = false;
  el("resume-tour").hidden = !loadTour();
  document.body.classList.remove("in-battle");
  document.body.dataset.screen = "home";
  showHomeMenu("main-menu", "quick-play");
  editor?.destroy();
  editor = null;
}
function pause(reason: string): void {
  if (screen !== "battle" || state.phase === "finished" || paused) return;
  paused = true;
  battle.dataset.paused = "true";
  controls.enabled = false;
  controls.clear();
  sound.stop();
  el("pause-reason").textContent = reason;
  openDialog("pause-dialog");
}
function resume(): void {
  if (screen !== "battle") return;
  if (needsRotation()) {
    syncOrientation();
    return;
  }
  if (!renderer.graphicsAvailable) {
    el("pause-reason").textContent =
      "The graphics connection is still recovering. Please wait for the arena to return.";
    return;
  }
  if (controllerError()) {
    el("pause-reason").textContent = controllerError();
    return;
  }
  closeDialogs();
  controls.clear();
  paused = false;
  battle.dataset.paused = "false";
  controls.enabled = true;
  accumulator = 0;
  void sound.unlock();
  sound.start(state.theme.music, state.hurry);
  el("pause-button").focus();
}
function finishRound(): void {
  resultHandled = true;
  battle.dataset.paused = "true";
  controls.enabled = false;
  sound.stop();
  const winner = state.winner;
  if (settings.scoring === "kills") {
    scores[0] += state.players[0].kills;
    scores[1] += state.players[1].kills;
  } else if (winner !== null) scores[winner]++;
  matchOver =
    mode === "tour"
      ? tourRound >= 4
      : scores.some((score) => score >= settings.targetScore);
  if (mode === "practice") matchOver = true;
  renderScores();
  const winningName =
    winner === 0
      ? "PLAYER ONE"
      : settings.mode === "cpu"
        ? "THE COMPUTER"
        : "PLAYER TWO";
  el("result-kicker").textContent =
    mode === "tour"
      ? matchOver
        ? "TOUR COMPLETE"
        : `ARENA ${tourRound + 1} / 5 COMPLETE`
      : matchOver
        ? "MATCH COMPLETE"
        : `ROUND ${round} COMPLETE`;
  const champion =
    scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
  el("result-title").textContent = matchOver
    ? champion === null
      ? "HONOURS EVEN."
      : `${champion === 0 ? "PLAYER ONE" : settings.mode === "cpu" ? "THE COMPUTER" : "PLAYER TWO"} TAKES IT!`
    : winner === null
      ? "IT’S A DRAW."
      : `${winningName} WINS!`;
  el("winner-mark").textContent =
    (matchOver ? champion : winner) === null
      ? "×"
      : String((matchOver ? champion! : winner!) + 1);
  el("winner-mark").classList.toggle(
    "blue",
    (matchOver ? champion : winner) === 1,
  );
  el("result-copy").textContent =
    winner === null
      ? "A draw. Nobody gets the last laugh this time."
      : winner === 0
        ? "A well-placed bomb is good. A way out is better."
        : state.players[0].kills < 0
          ? "Your own blast caught you. Move away, then turn a corner before the fuse runs out."
          : "Caught in the blast. Use solid blocks as cover and leave yourself an escape route.";
  el("result-p1").textContent = String(scores[0]);
  el("result-p2").textContent = String(scores[1]);
  el("next-button").textContent = matchOver
    ? "RUN IT BACK ↗"
    : mode === "tour"
      ? "NEXT ARENA ↗"
      : "NEXT ROUND ↗";
  bonus = null;
  bonusWinner = winner;
  if (settings.winnerBonus && winner !== null && !matchOver) {
    bonus = awardWinnerBonus(structuredClone(state), winner);
    el("result-bonus").hidden = false;
    el("result-bonus").textContent =
      `WINNER ROULETTE → ${BONUS_LABELS[bonus].toUpperCase()} · carries into the next round`;
  } else el("result-bonus").hidden = true;
  if (mode === "tour")
    saveTour(matchOver ? null : { round: tourRound + 1, scores, settings });
  if (mode !== "practice") {
    progress.played++;
    if (winner === 0) progress.wins++;
    if (!progress.seenThemes.includes(state.theme.id))
      progress.seenThemes.push(state.theme.id);
    if (mode === "tour" && matchOver)
      progress.tourBest = Math.max(progress.tourBest, scores[0]);
    void saveProgress(progress).catch(() => {});
  }
  openDialog("result-dialog");
  el("next-button").focus();
}
function updateHud(): void {
  battle.dataset.phase = state.phase;
  const seconds = Math.max(0, Math.ceil(state.remaining / TICK_RATE));
  const feedback = state.players.map((player) =>
    pickupFeedback(player, state.tick),
  );
  const signature = `${JSON.stringify(feedback)}:${seconds}:${state.phase}:${Math.ceil(state.countdown / TICK_RATE)}:${state.players.map((p) => [p.capacity, p.range, p.speed, p.abilities.join(), p.diseases.map((d) => d.type).join(), p.alive].join(":")).join("/")}`;
  if (signature === previousHud) return;
  previousHud = signature;
  el("round-label").textContent =
    mode === "tour"
      ? `TOUR ${tourRound + 1}/5`
      : mode === "practice"
        ? "PRACTICE"
        : `ROUND ${round}`;
  el("clock").textContent =
    settings.roundSeconds === 0 || mode === "practice"
      ? "∞"
      : `${Math.floor(seconds / 60)
          .toString()
          .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  el("clock").classList.toggle(
    "urgent",
    seconds <= 30 && settings.roundSeconds > 0 && mode !== "practice",
  );
  const announcement = el("battle-announcement");
  announcement.textContent =
    state.phase === "countdown"
      ? String(Math.max(1, Math.ceil(state.countdown / TICK_RATE)))
      : state.phase === "resolving"
        ? "…"
        : "";
  announcement.hidden = !announcement.textContent;
  state.players.forEach((player, id) => {
    updatePlayerInventory(player, feedback[id].effects);
    const notice = el(`p${id + 1}-pickup`);
    if (
      notice.textContent !== feedback[id].notice ||
      notice.dataset.item !== (feedback[id].item ?? "")
    ) {
      const item = feedback[id].item;
      notice.dataset.item = item ?? "";
      notice.innerHTML = item
        ? `${pickupIconMarkup(item, player.pickupFeedback?.diseases ?? [])}<span>${feedback[id].notice}</span>`
        : "";
    }
    notice.classList.toggle("harmful", feedback[id].harmful);
  });
}
function frame(time: number): void {
  if (screen === "battle") controls.pollPause();
  const delta = Math.min(100, time - (previousTime || time));
  previousTime = time;
  if (
    renderer?.graphicsAvailable &&
    state &&
    screen === "battle" &&
    !paused &&
    !resultHandled
  ) {
    accumulator += delta;
    let iterations = 0;
    while (accumulator >= 1000 / TICK_RATE && iterations++ < 6) {
      const p1 = controls.read(0);
      const p2 =
        mode === "practice"
          ? { ...EMPTY_INPUT }
          : settings.mode === "cpu"
            ? botInput(state, 1, settings.difficulty)
            : controls.read(1);
      if (replayInputs.length < 72_000)
        replayInputs.push([
          directions.indexOf(p1.direction),
          +p1.bomb,
          +p1.action,
          directions.indexOf(p2.direction),
          +p2.bomb,
          +p2.action,
        ]);
      const updateStart = performance.now();
      // Catch-up frames still interpolate only the most recent simulation step.
      renderer.capturePositions(state);
      stepGame(state, [p1, p2]);
      updateTimes.push(performance.now() - updateStart);
      if (updateTimes.length > 1200) updateTimes.shift();
      sound.play(state.events);
      accumulator -= 1000 / TICK_RATE;
      if (mode === "practice") {
        practiceStarted++;
        const seconds = practiceStarted / TICK_RATE;
        el("practice-tip").textContent =
          seconds < 12
            ? `01 / MOVE · ${touchScreen.matches ? "Slide the joystick to steer. Power-ups are in Pause" : `Use ${(["up", "left", "down", "right"] as const).map((direction) => keyLabel(controls.soloBinding[direction])).join(" / ")}`}. Your red player is 1. You’re safe in practice.`
            : seconds < 25
              ? `02 / PLANT · Tap ${touchScreen.matches ? "BOMB" : keyLabel(controls.soloBinding.bomb)} to place a bomb. Move away and turn a corner before it explodes.`
              : seconds < 45
                ? "03 / POWER UP · Break orange bricks and collect the items underneath. Watch your inventory below."
                : `04 / READY? · Try trapping the blue practice dummy. ${touchScreen.matches ? "Tap Pause" : "Escape pauses the game"}; leave anytime.`;
      }
      if (state.phase === "finished") {
        finishRound();
        break;
      }
    }
    updateHud();
    renderer.render(state, accumulator / (1000 / TICK_RATE));
  }
  requestAnimationFrame(frame);
}

function syncSetup(): void {
  for (const [key, value] of Object.entries(settings)) {
    const field = setupForm.elements.namedItem(key);
    if (field instanceof HTMLInputElement && field.type === "checkbox")
      field.checked = Boolean(value);
    else if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement
    )
      field.value = String(value);
  }
  el<HTMLSelectElement>("input-assignment").value = controls.assignment;
  controls.solo = settings.mode === "cpu";
  updateThemeDescription();
  syncPickupRule();
  renderBindings();
  updateSettingValues();
}
function updateSettingValues(): void {
  document.body.classList.toggle("reduced-motion", settings.reducedMotion);
  setupForm
    .querySelectorAll<HTMLInputElement>('input[type="range"]')
    .forEach((input) => {
      let output = input.parentElement!.querySelector("output");
      if (!output) {
        output = document.createElement("output");
        input.before(output);
      }
      output.textContent = `${Math.round(Number(input.value) * 100)}%`;
    });
}
function syncPickupRule(): void {
  const mystery = setupForm.elements.namedItem(
    "mysteryPickups",
  ) as HTMLInputElement;
  const destroyDiseases = setupForm.elements.namedItem(
    "destroyDiseases",
  ) as HTMLInputElement;
  destroyDiseases.disabled = mystery.checked;
}
(setupForm.elements.namedItem("mysteryPickups") as HTMLInputElement).onchange =
  syncPickupRule;

function readSetup(): void {
  const data = new FormData(setupForm);
  const next = { ...settings };
  for (const [key, old] of Object.entries(settings)) {
    const field = setupForm.elements.namedItem(key);
    if (
      !(
        field instanceof HTMLInputElement || field instanceof HTMLSelectElement
      ) ||
      field.disabled
    )
      continue;
    const value = data.get(key);
    (next as unknown as Record<string, unknown>)[key] =
      typeof old === "boolean"
        ? value !== null
        : typeof old === "number"
          ? Number(value)
          : String(value);
  }
  settings = next;
  controls.assignment = el<HTMLSelectElement>("input-assignment")
    .value as InputAssignment;
  controls.solo = settings.mode === "cpu";
  sound.configure(
    muted ? { ...settings, music: 0, effects: 0, voices: 0 } : settings,
  );
  updateSettingValues();
  persist();
  try {
    localStorage.setItem("inkblast.input-assignment.v1", controls.assignment);
  } catch {
    /* Controllers remain assigned for the current session. */
  }
}
function updateThemeDescription(): void {
  const id = (setupForm.elements.namedItem("themeId") as HTMLSelectElement)
    .value;
  el("theme-description").textContent =
    id === "random"
      ? "A surprise theme every round. Your chosen map layout stays the same."
      : (THEMES.find((theme) => theme.id === id)?.subtitle ?? "");
  const local =
    (setupForm.elements.namedItem("mode") as HTMLSelectElement).value ===
    "local";
  (setupForm.elements.namedItem("difficulty") as HTMLSelectElement).disabled =
    local;
}
let cancelBinding = () => {};
function saveBindings(): void {
  try {
    localStorage.setItem(
      "inkblast.bindings.v1",
      JSON.stringify(controls.bindings),
    );
    localStorage.setItem(
      "inkblast.solo-bindings.v1",
      JSON.stringify(controls.soloBinding),
    );
  } catch {
    toast(
      "Keyboard preferences could not be saved. They last for this session only.",
    );
  }
}
el<HTMLSelectElement>("solo-keyboard").onchange = (event) => {
  const preset = (event.target as HTMLSelectElement).value;
  if (preset !== "wasd" && preset !== "arrows") return;
  controls.soloBinding = { ...SOLO_BINDINGS[preset] };
  controls.clear();
  saveBindings();
};
function renderBindings(): void {
  cancelBinding();
  el("solo-keyboard-field").hidden =
    !controls.solo || controls.assignment === "gamepads";
  el<HTMLSelectElement>("solo-keyboard").value =
    Object.entries(SOLO_BINDINGS).find(([, preset]) =>
      Object.entries(preset).every(
        ([action, code]) =>
          controls.soloBinding[action as keyof typeof preset] === code,
      ),
    )?.[0] ?? "custom";
  const focusedBinding = el("key-bindings").contains(document.activeElement)
    ? (document.activeElement as HTMLElement).dataset.binding
    : undefined;
  const container = el("key-bindings");
  container.replaceChildren();
  controls.activeBindings.forEach((binding, player) => {
    const row = document.createElement("div");
    row.className = "binding-row";
    const name = document.createElement("b");
    name.textContent = `P${player + 1}`;
    row.append(name);
    for (const [action, key] of Object.entries(binding)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.binding = `${player}-${action}`;
      button.textContent = `${action}: ${keyLabel(key)}`;
      button.onclick = () => {
        cancelBinding();
        button.textContent = "Press a key…";
        const handler = (event: KeyboardEvent) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (
            event.code !== "Escape" &&
            ![
              "Tab",
              "MetaLeft",
              "MetaRight",
              "ControlLeft",
              "ControlRight",
            ].includes(event.code)
          ) {
            const duplicate = controls.activeBindings.some((item) =>
              Object.values(item).includes(event.code),
            );
            if (duplicate && event.code !== key) {
              toast("That key is already assigned. Pick another key.");
              return;
            }
            binding[action as keyof typeof binding] = event.code;
            saveBindings();
          }
          window.removeEventListener("keydown", handler, true);
          renderBindings();
        };
        window.addEventListener("keydown", handler, true);
        cancelBinding = () =>
          window.removeEventListener("keydown", handler, true);
      };
      row.append(button);
    }
    container.append(row);
  });
  if (focusedBinding)
    container
      .querySelector<HTMLElement>(`[data-binding="${focusedBinding}"]`)
      ?.focus();
}
function fillOptions(): void {
  const themeSelect = setupForm.elements.namedItem(
    "themeId",
  ) as HTMLSelectElement;
  const schemeSelect = setupForm.elements.namedItem(
    "schemeId",
  ) as HTMLSelectElement;
  themeSelect.replaceChildren(
    ...THEMES.map((theme) => new Option(theme.name, theme.id)),
    new Option("Surprise me · random theme", "random"),
  );
  (
    setupForm.elements.namedItem("targetScore") as HTMLSelectElement
  ).replaceChildren(
    ...Array.from(
      { length: 20 },
      (_, index) =>
        new Option(`${index + 1} point${index ? "s" : ""}`, String(index + 1)),
    ),
  );
  schemeSelect.replaceChildren(
    ...[...SCHEMES, ...maps].map(
      (scheme) => new Option(scheme.name, scheme.id),
    ),
  );
}
let settingsPage: string | null = null;
function showSettingsPage(page: string | null): void {
  settingsPage = page;
  el("options-menu").hidden = page !== null;
  el("options-title").hidden = page !== null;
  el("settings-actions").hidden = page === null;
  document
    .querySelectorAll<HTMLElement>("[data-settings-page]")
    .forEach((section) => {
      section.hidden = section.dataset.settingsPage !== page;
    });
  const scope = page
    ? document.querySelector<HTMLElement>(`[data-settings-page="${page}"]`)!
    : el("options-menu");
  scope.querySelector<HTMLElement>("button, select, input")?.focus();
}
function showSetup(page: string | null = null): void {
  fillOptions();
  syncSetup();
  el("setup-error").textContent = "";
  openDialog("setup-dialog");
  showSettingsPage(page);
}
document
  .querySelectorAll<HTMLElement>("[data-settings-link]")
  .forEach((button) => {
    button.onclick = () => showSettingsPage(button.dataset.settingsLink!);
  });
function backToOptions(): void {
  const previous = settingsPage;
  cancelBinding();
  showSettingsPage(null);
  document
    .querySelector<HTMLElement>(`[data-settings-link="${previous}"]`)
    ?.focus();
}
el("options-back").onclick = backToOptions;
document.querySelector<HTMLElement>("[data-options-close]")!.onclick = () =>
  el<HTMLDialogElement>("setup-dialog").close();
el("menu-sound").onclick = () => el("sound-toggle").click();
el("menu-fullscreen").onclick = () => el("fullscreen").click();
el<HTMLDialogElement>("setup-dialog").addEventListener("close", () =>
  cancelBinding(),
);
document
  .querySelectorAll<HTMLButtonElement>("[data-close]")
  .forEach(
    (button) => (button.onclick = () => button.closest("dialog")?.close()),
  );
document.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) =>
  dialog.addEventListener("cancel", (event) => {
    if (dialog.id === "pause-dialog") {
      event.preventDefault();
      resume();
    }
    if (dialog.id === "result-dialog") {
      event.preventDefault();
      goHome();
    }
  }),
);
document.querySelector<HTMLAnchorElement>(".wordmark")!.onclick = (event) => {
  event.preventDefault();
  if (screen === "battle")
    pause("Match paused. Choose Leave for main menu to exit.");
  else goHome();
};
function quickPlay(opponent: MatchSettings["mode"]): void {
  settings.mode = opponent;
  customScheme = null;
  persist();
  void startMatch();
}
el("quick-play").onclick = () => quickPlay("cpu");
el("local-play").onclick = () => quickPlay("local");
el("custom-button").onclick = () => showSetup();
function showHomeMenu(id: string, focusId?: string): void {
  for (const menu of home.querySelectorAll<HTMLElement>("nav"))
    menu.hidden = menu.id !== id;
  const menu = el(id);
  (focusId
    ? el(focusId)
    : menu.querySelector<HTMLElement>("button:not([hidden])")
  )?.focus();
  el("menu-hint").textContent =
    (document.activeElement as HTMLElement)?.dataset.hint ?? "";
}
el("extras-button").onclick = () => showHomeMenu("extras-menu");
el("tour-menu").onclick = () => {
  if (loadTour()) showHomeMenu("tour-menu-list");
  else el("tour-button").click();
};
home.querySelectorAll<HTMLElement>("[data-menu-back]").forEach((button) => {
  button.onclick = () =>
    showHomeMenu(
      "main-menu",
      button.closest("nav")?.id === "extras-menu"
        ? "extras-button"
        : "tour-menu",
    );
});
home.addEventListener("focusin", (event) => {
  el("menu-hint").textContent =
    (event.target as HTMLElement).dataset.hint ?? "";
});
el("practice-button").onclick = () => void startMatch("practice");
el("guide-practice").onclick = () => void startMatch("practice");
el("resume-tour").onclick = () => {
  const checkpoint = loadTour();
  if (!checkpoint) return;
  settings = checkpoint.settings;
  if (controllerError()) {
    showSetup("controls");
    el("setup-error").textContent = controllerError();
    return;
  }
  scores = checkpoint.scores;
  tourRound = checkpoint.round;
  round = tourRound + 1;
  mode = "tour";
  matchOver = false;
  bonus = null;
  void sound.unlock().then(startRound);
};
el("practice-give").onclick = () => {
  if (mode === "practice") {
    const item = el<HTMLSelectElement>("practice-item").value;
    if (item === "mystery") applyMysteryItem(state, state.players[0]);
    else applyItem(state, state.players[0], item as ItemType);
    previousHud = "";
  }
};
el("practice-reset").onclick = () => {
  const player = state.players[0];
  player.capacity = 1;
  player.range = 2;
  player.speed = 0;
  player.abilities = [];
  player.diseases = [];
  delete player.pickupFeedback;
  previousHud = "";
};
el("tour-button").onclick = () => {
  settings.mode = "cpu";
  persist();
  void startMatch("tour");
};
el("help-button").onclick = () => openDialog("help-dialog");
function download(name: string, text: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
el("export-backup").onclick = () => {
  void exportBackup()
    .then((text) => download("inkblast-backup.json", text))
    .catch(() => toast("Could not export the backup."));
};
el("restore-backup").onclick = () =>
  el<HTMLInputElement>("backup-file").click();
el<HTMLInputElement>("backup-file").onchange = async (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error("The backup limit is 2 MB.");
    const count = await importBackup(await file.text());
    settings = await loadSettings();
    maps = await loadMaps();
    progress = await loadProgress();
    toast(storageWarning || `Restored settings, records and ${count} maps.`);
  } catch (error) {
    toast(
      error instanceof Error
        ? error.message
        : "This backup could not be restored.",
    );
  }
  input.value = "";
};
el("about-button").onclick = () => {
  el("local-record").textContent =
    `YOUR LOCAL RECORD: ${progress.played} rounds played · ${progress.wins} wins · ${progress.seenThemes.length}/${THEMES.length} arenas visited`;
  openDialog("about-dialog");
};
el("pause-button").onclick = () => pause("Your arena will be right here.");
el("resume-button").onclick = resume;
el("restart-button").onclick = () => void startMatch(mode);
el("leave-button").onclick = goHome;
el("export-replay").onclick = () =>
  download(
    "inkblast-replay.json",
    JSON.stringify(
      {
        format: "inkblast-replay",
        version: 1,
        rulesVersion: "browser-0.1",
        initialState: replayStart,
        inputs: replayInputs,
        truncated: replayInputs.length >= 72_000,
      },
      (_key, value) => (value === Infinity ? "Infinity" : value),
    ),
  );
el("result-home").onclick = goHome;
el("result-setup").onclick = () => {
  goHome();
  showSetup();
};
el("next-button").onclick = () => {
  if (matchOver) void startMatch(mode);
  else {
    round++;
    if (mode === "tour") tourRound++;
    startRound();
  }
};
el("sound-toggle").onclick = () => {
  muted = !muted;
  sound.configure(
    muted ? { ...settings, music: 0, effects: 0, voices: 0 } : settings,
  );
  el("menu-sound").textContent = muted ? "UNMUTE SOUND" : "MUTE SOUND";
  el("sound-toggle").textContent = muted ? "♫̸" : "♪";
  el("sound-toggle").setAttribute(
    "aria-label",
    muted ? "Unmute sound" : "Mute sound",
  );
  try {
    localStorage.setItem("inkblast.muted.v1", String(muted));
  } catch {}
};
el("fullscreen").onclick = () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else
    void document.documentElement
      .requestFullscreen?.()
      .catch(() => toast("Fullscreen is unavailable in this browser."));
};
el("workshop-button").onclick = () => {
  screen = "workshop";
  document.body.dataset.screen = "workshop";
  home.hidden = true;
  el("workshop").hidden = false;
  editor = new MapEditor(el("workshop"), {
    onPlay: (scheme) => {
      customScheme = scheme;
      settings.mode = "cpu";
      void startMatch();
    },
    onClose: () => {
      void loadMaps().then((saved) => {
        maps = saved;
      });
      goHome();
    },
  });
};
setupForm.onchange = () => {
  updateThemeDescription();
  readSetup();
  renderBindings();
};
setupForm.onsubmit = (event) => {
  event.preventDefault();
  readSetup();
  if (controllerError()) {
    el("setup-error").textContent = controllerError();
    return;
  }
  customScheme = null;
  void startMatch();
};
function controllerError(): string {
  const count = Array.from(navigator.getGamepads?.() ?? []).filter(
    Boolean,
  ).length;
  const required =
    controls.assignment === "gamepads"
      ? settings.mode === "local"
        ? 2
        : 1
      : controls.assignment === "mixed" && settings.mode === "local"
        ? 1
        : 0;
  return count < required
    ? `Connect ${required} gamepad${required > 1 ? "s" : ""} and press a button, or choose shared keyboard.`
    : "";
}
window.addEventListener("blur", () =>
  pause("Paused because the game lost focus. Resume when you’re ready."),
);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause("Paused while you were away.");
});
window.addEventListener("gamepaddisconnected", () => {
  if (controls.assignment !== "keyboard")
    pause("A controller disconnected. Reconnect it, then resume.");
});
window.setInterval(() => {
  const count = Array.from(navigator.getGamepads?.() ?? []).filter(
    Boolean,
  ).length;
  el("controller-status").textContent = count
    ? `${count} gamepad${count > 1 ? "s" : ""} connected. A = bomb · B = action.`
    : "Keyboard ready. To detect a gamepad, connect it and press any button.";
}, 1000);

async function boot(): Promise<void> {
  try {
    const saved = await Promise.all([
      loadSettings(),
      loadMaps(),
      loadProgress(),
    ]);
    settings = saved[0];
    maps = saved[1];
    progress = saved[2];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      settings.reducedMotion = true;
    try {
      const bindings: unknown = JSON.parse(
        localStorage.getItem("inkblast.bindings.v1") ?? "null",
      );
      if (
        Array.isArray(bindings) &&
        bindings.length === 2 &&
        bindings.every(isBinding)
      )
        controls.bindings = bindings as typeof controls.bindings;
    } catch {
      /* A malformed preferences entry falls back to the visible default keys. */
    }
    controls.soloBinding = { ...controls.bindings[0] };
    try {
      const binding: unknown = JSON.parse(
        localStorage.getItem("inkblast.solo-bindings.v1") ?? "null",
      );
      if (isBinding(binding)) controls.soloBinding = binding;
    } catch {
      /* Existing player-one preferences also work in solo play. */
    }
    try {
      const assignment = localStorage.getItem("inkblast.input-assignment.v1");
      if (assignment && ["keyboard", "mixed", "gamepads"].includes(assignment))
        controls.assignment = assignment as InputAssignment;
      muted = localStorage.getItem("inkblast.muted.v1") === "true";
    } catch {}
    el("menu-sound").textContent = muted ? "UNMUTE SOUND" : "MUTE SOUND";
    el("sound-toggle").textContent = muted ? "♫̸" : "♪";
    el("sound-toggle").setAttribute(
      "aria-label",
      muted ? "Unmute sound" : "Mute sound",
    );
    el("resume-tour").hidden = !loadTour();
    renderer = await ArenaRenderer.create(host);
    host
      .querySelector("canvas")
      ?.addEventListener("webglcontextlost", () =>
        pause(
          "The graphics connection was interrupted. Resume after the arena returns.",
        ),
      );
    sound.configure(
      muted ? { ...settings, music: 0, effects: 0, voices: 0 } : settings,
    );
    updateSettingValues();
    el<HTMLButtonElement>("quick-play").disabled = false;
    el<HTMLButtonElement>("local-play").disabled = false;
    if (
      !document.querySelector("dialog[open]") &&
      document.activeElement === document.body
    )
      el("quick-play").focus();
    requestAnimationFrame(frame);
  } catch (error) {
    host.innerHTML =
      '<div class="load-error"><h2>THE ARENA COULDN’T START.</h2><p>Try reloading with hardware acceleration enabled in your browser.</p></div>';
    console.error(error);
    toast("The arena could not start. Please reload.");
  }
}
document.body.dataset.screen = "home";
el<HTMLButtonElement>("quick-play").disabled = true;
el<HTMLButtonElement>("local-play").disabled = true;
installMenuNavigation(
  () =>
    document.querySelector<HTMLElement>("dialog[open]") ??
    (screen === "home"
      ? home.querySelector<HTMLElement>("nav:not([hidden])")
      : null),
  () => {
    const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
    if (dialog?.id === "setup-dialog" && settingsPage) backToOptions();
    else if (dialog?.id === "pause-dialog") resume();
    else if (dialog?.id === "result-dialog") goHome();
    else if (dialog?.id === "rotate-dialog") return;
    else if (dialog) dialog.close();
    else if (screen === "home" && el("main-menu").hidden) {
      const opener = el("extras-menu").hidden ? "tour-menu" : "extras-button";
      showHomeMenu("main-menu", opener);
    }
  },
);
void boot();

if (import.meta.env.DEV || import.meta.env.MODE === "qa") {
  Object.assign(window, {
    inkblastQA: {
      snapshot: () => structuredClone({ state, paused, screen, scores, mode }),
      performance: () => {
        const times = [...updateTimes].sort((a, b) => a - b);
        return {
          samples: times.length,
          updateP95: times[Math.floor(times.length * 0.95)] ?? 0,
        };
      },
    },
  });
}
