import { COLS, ROWS, cellIndex, type Cell, type Scheme } from "../core/types";
import { ITEM_LABELS, ITEM_TYPES, SCHEMES } from "../content/catalog";
import {
  cloneScheme,
  exportScheme,
  importScheme,
  mapId,
  SchemeImportError,
  validateScheme,
  type EditableScheme,
} from "../content/schemes";
import {
  deleteMap,
  loadMaps,
  saveMap,
  storageWarning,
} from "../storage/storage";

type Tool = Cell | "player1" | "player2";
type Callbacks = { onPlay: (scheme: Scheme) => void; onClose: () => void };
const node = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
function button(
  text: string,
  action: () => void,
  className = "button secondary",
): HTMLButtonElement {
  const el = node("button", text, className);
  el.type = "button";
  el.addEventListener("click", action);
  return el;
}
function field(label: string, input: HTMLElement): HTMLLabelElement {
  const el = node("label", undefined, "editor-field");
  el.append(node("span", label), input);
  return el;
}

export class MapEditor {
  private scheme = cloneScheme(SCHEMES[0]);
  private maps: Scheme[] = [];
  private undoStack: EditableScheme[] = [];
  private redoStack: EditableScheme[] = [];
  private tool: Tool = "brick";
  private painting = false;
  private disposed = false;
  private grid!: HTMLDivElement;
  private status!: HTMLParagraphElement;
  private savedSelect!: HTMLSelectElement;
  private undoButton!: HTMLButtonElement;
  private redoButton!: HTMLButtonElement;
  private message =
    "Draw tiles or choose a player start. Arrow keys move around the grid; Space paints.";
  private focusCell = COLS + 1;
  private releasePointer = (): void => {
    this.painting = false;
    this.updateStatus();
  };

  constructor(
    private host: HTMLElement,
    private callbacks: Callbacks,
  ) {
    this.render();
    window.addEventListener("pointerup", this.releasePointer);
    window.addEventListener("pointercancel", this.releasePointer);
    void loadMaps().then((maps) => {
      if (!this.disposed) {
        this.maps = maps;
        this.refreshSaved();
        if (storageWarning) this.notify(storageWarning);
      }
    });
  }

  destroy(): void {
    this.disposed = true;
    window.removeEventListener("pointerup", this.releasePointer);
    window.removeEventListener("pointercancel", this.releasePointer);
  }

  private render(): void {
    this.host.replaceChildren();
    const panel = node("section", undefined, "panel workshop");
    const heading = node("div", undefined, "section-heading");
    heading.append(
      node("div", "MAP WORKSHOP", "eyebrow"),
      node("h1", "Make a little mayhem."),
      node(
        "p",
        "A local map, two rivals, endless possibilities. All twelve presets are Inkblast duel adaptations.",
      ),
    );
    panel.append(heading);
    const top = node("div", undefined, "editor-actions");
    top.style.cssText = "display:flex;gap:.6rem;flex-wrap:wrap;margin:1rem 0";
    top.append(
      button("← Back", () => this.callbacks.onClose()),
      button("Test duel", () => this.play(), "button primary"),
      button("Save map", () => {
        void this.save();
      }),
      button("Duplicate", () => this.duplicate()),
      button("Delete saved map", () => {
        void this.remove();
      }),
    );
    panel.append(top);
    this.savedSelect = node("select");
    this.savedSelect.setAttribute("aria-label", "Load a preset or saved map");
    this.savedSelect.addEventListener("change", () => {
      const selected = [...SCHEMES, ...this.maps].find(
        (map) => map.id === this.savedSelect.value,
      );
      if (selected) {
        this.checkpoint();
        this.scheme = cloneScheme(selected);
        this.render();
        this.notify(`Loaded ${selected.name}.`);
      }
    });
    this.refreshSaved();
    panel.append(field("Start from a map", this.savedSelect));
    const settings = node("div", undefined, "editor-settings");
    settings.style.cssText =
      "display:flex;gap:1rem;flex-wrap:wrap;margin:1rem 0";
    const name = node("input");
    name.value = this.scheme.name;
    name.maxLength = 80;
    name.addEventListener("change", () => {
      this.checkpoint();
      this.scheme.name = name.value;
      this.updateStatus();
    });
    const density = node("input");
    density.type = "number";
    density.min = "0";
    density.max = "100";
    density.value = String(this.scheme.density);
    density.addEventListener("change", () => {
      this.checkpoint();
      this.scheme.density = Number(density.value);
      this.updateStatus();
    });
    settings.append(
      field("Map name", name),
      field("Brick density (%)", density),
    );
    panel.append(settings);
    const tools = node("div", undefined, "editor-tools");
    tools.setAttribute("role", "toolbar");
    tools.setAttribute("aria-label", "Drawing tools");
    tools.style.cssText =
      "display:flex;gap:.4rem;flex-wrap:wrap;margin:.75rem 0";
    const labels: Record<Tool, string> = {
      floor: "· Floor",
      wall: "■ Wall",
      brick: "▦ Brick",
      player1: "① Player 1",
      player2: "② Player 2",
    };
    for (const tool of Object.keys(labels) as Tool[]) {
      const control = button(
        labels[tool],
        () => {
          this.tool = tool;
          for (const b of tools.querySelectorAll("button[data-tool]"))
            b.setAttribute(
              "aria-pressed",
              String((b as HTMLElement).dataset.tool === tool),
            );
        },
        "button secondary",
      );
      control.dataset.tool = tool;
      control.setAttribute("aria-pressed", String(tool === this.tool));
      tools.append(control);
    }
    this.undoButton = button("Undo", () => this.undo());
    this.redoButton = button("Redo", () => this.redo());
    tools.append(this.undoButton, this.redoButton);
    panel.append(tools);
    this.grid = node("div", undefined, "editor-grid");
    this.grid.setAttribute("role", "grid");
    this.grid.setAttribute(
      "aria-label",
      "15 columns by 11 rows. Choose a tool, then paint.",
    );
    this.grid.style.cssText =
      "display:grid;gap:2px;max-width:780px;touch-action:none;user-select:none";
    for (let y = 0; y < ROWS; y++) {
      const row = node("div");
      row.setAttribute("role", "row");
      row.style.cssText =
        "display:grid;grid-template-columns:repeat(15,minmax(0,1fr));gap:2px";
      for (let x = 0; x < COLS; x++) {
        const index = cellIndex(x, y),
          cell = node("button");
        cell.type = "button";
        cell.dataset.index = String(index);
        cell.setAttribute("role", "gridcell");
        cell.tabIndex = index === this.focusCell ? 0 : -1;
        cell.style.cssText =
          "aspect-ratio:1.15;min-width:0;padding:0;border:1px solid #101c2e;border-radius:3px;font-size:clamp(.65rem,2vw,1.35rem);font-weight:900;cursor:crosshair;color:#fff8df";
        cell.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          this.focusCell = index;
          this.setGridFocus(index);
          cell.focus({ preventScroll: true });
          this.checkpoint();
          this.painting = true;
          this.paint(index);
        });
        cell.addEventListener("pointerenter", () => {
          if (this.painting) this.paint(index);
        });
        cell.addEventListener("click", (event) => {
          if (event.detail === 0) {
            this.checkpoint();
            this.paint(index);
            this.updateStatus();
          }
        });
        cell.addEventListener("keydown", (event) => this.gridKey(event, index));
        row.append(cell);
      }
      this.grid.append(row);
    }
    this.grid.addEventListener("pointermove", (event) => {
      if (!this.painting || event.pointerType !== "touch") return;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLButtonElement>("button[data-index]");
      if (target && this.grid.contains(target))
        this.paint(Number(target.dataset.index));
    });
    panel.append(this.grid);
    this.paintGrid();
    panel.append(
      node(
        "p",
        "The perimeter is editable. Players need separate floor starts and a path through floor or destructible bricks. Density randomly thins brick tiles at round start.",
        "hint",
      ),
    );
    panel.append(this.inventory());
    const fileActions = node("div", undefined, "editor-actions");
    fileActions.style.cssText =
      "display:flex;gap:.6rem;flex-wrap:wrap;margin:1rem 0";
    const file = node("input");
    file.type = "file";
    file.accept = ".json,.sch,application/json,text/plain";
    file.hidden = true;
    file.addEventListener("change", () => {
      const selected = file.files?.[0];
      if (selected) void this.readFile(selected);
      file.value = "";
    });
    fileActions.append(
      button("Import JSON / .sch", () => file.click()),
      button("Export JSON", () => this.download("json")),
      button("Export duel .sch", () => this.download("sch")),
      file,
    );
    panel.append(
      fileActions,
      node(
        "p",
        "JSON preserves all Inkblast fields. Duel .sch export has two starts; it is not a ten-player original file. Imported files stay on this device.",
        "hint",
      ),
    );
    this.status = node("p", this.message, "editor-status");
    this.status.setAttribute("role", "status");
    this.status.style.cssText = "white-space:pre-line;min-height:3em";
    panel.append(this.status);
    this.host.append(panel);
    this.updateStatus();
  }

  private inventory(): HTMLDetailsElement {
    const details = node("details");
    details.append(node("summary", "Starting inventory & item rules"));
    details.append(
      node(
        "p",
        "Born-with replaces starting amounts. Field overrides: 0 disables, a positive number sets a count, −n gives a 1-in-n chance. Random eligibility is separate from field availability.",
        "hint",
      ),
    );
    const table = node("table");
    table.style.cssText = "width:100%;font-size:.9rem";
    const head = node("thead"),
      hr = node("tr");
    for (const text of [
      "Item",
      "Born with",
      "Field drops",
      "Override",
      "From Random",
    ]) {
      const th = node("th", text);
      th.scope = "col";
      hr.append(th);
    }
    head.append(hr);
    table.append(head);
    const body = node("tbody");
    for (const type of ITEM_TYPES) {
      const row = node("tr"),
        title = node("th", ITEM_LABELS[type]);
      title.scope = "row";
      row.append(title);
      const born = node("input");
      born.type = "number";
      born.min = "0";
      born.max = "10";
      born.value = String(this.scheme.startingItems[type] ?? 0);
      born.style.width = "4rem";
      born.setAttribute("aria-label", `${ITEM_LABELS[type]} starting amount`);
      born.disabled = ["disease", "superDisease", "random"].includes(type);
      born.addEventListener("change", () => {
        this.checkpoint();
        this.scheme.startingItems[type] = Number(born.value);
        this.updateStatus();
      });
      const enabled = node("input");
      enabled.type = "checkbox";
      enabled.checked = this.scheme.itemPool.includes(type);
      enabled.setAttribute("aria-label", `${ITEM_LABELS[type]} field drops`);
      enabled.addEventListener("change", () => {
        this.checkpoint();
        this.scheme.itemPool = enabled.checked
          ? [...this.scheme.itemPool, type]
          : this.scheme.itemPool.filter((item) => item !== type);
        this.updateStatus();
      });
      const override = node("input");
      override.type = "number";
      override.min = "-100";
      override.max = "100";
      override.placeholder = "Auto";
      override.value = String(this.scheme.itemOverrides?.[type] ?? "");
      override.style.width = "5rem";
      override.setAttribute(
        "aria-label",
        `${ITEM_LABELS[type]} field override, blank means automatic`,
      );
      override.addEventListener("change", () => {
        this.checkpoint();
        this.scheme.itemOverrides ??= {};
        if (override.value === "") delete this.scheme.itemOverrides[type];
        else this.scheme.itemOverrides[type] = Number(override.value);
        this.updateStatus();
      });
      const random = node("input");
      random.type = "checkbox";
      random.checked =
        type !== "random" &&
        (
          this.scheme.randomPool ?? ITEM_TYPES.filter((t) => t !== "random")
        ).includes(type);
      random.disabled = type === "random";
      random.setAttribute(
        "aria-label",
        `${ITEM_LABELS[type]} allowed from Random`,
      );
      random.addEventListener("change", () => {
        this.checkpoint();
        const pool =
          this.scheme.randomPool ?? ITEM_TYPES.filter((t) => t !== "random");
        this.scheme.randomPool = random.checked
          ? [...pool, type]
          : pool.filter((item) => item !== type);
        this.updateStatus();
      });
      for (const input of [born, enabled, override, random]) {
        const td = node("td");
        td.append(input);
        row.append(td);
      }
      body.append(row);
    }
    table.append(body);
    const scroll = node("div");
    scroll.style.overflowX = "auto";
    scroll.append(table);
    details.append(scroll);
    return details;
  }

  private refreshSaved(): void {
    if (!this.savedSelect) return;
    this.savedSelect.replaceChildren();
    for (const [label, maps] of [
      ["Inkblast duel presets", SCHEMES],
      ["Your saved maps", this.maps],
    ] as const) {
      if (!maps.length) continue;
      const group = node("optgroup");
      group.label = label;
      for (const map of maps) {
        const option = node("option", map.name);
        option.value = map.id;
        group.append(option);
      }
      this.savedSelect.append(group);
    }
    this.savedSelect.value = this.scheme.id;
  }
  private checkpoint(): void {
    this.undoStack.push(cloneScheme(this.scheme));
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
  }
  private undo(): void {
    const previous = this.undoStack.pop();
    if (previous) {
      this.redoStack.push(cloneScheme(this.scheme));
      this.scheme = previous;
      this.render();
    }
  }
  private redo(): void {
    const next = this.redoStack.pop();
    if (next) {
      this.undoStack.push(cloneScheme(this.scheme));
      this.scheme = next;
      this.render();
    }
  }
  private paint(index: number): void {
    const x = index % COLS,
      y = Math.floor(index / COLS);
    if (this.tool === "player1" || this.tool === "player2") {
      this.scheme.spawns[this.tool === "player1" ? 0 : 1] = { x, y };
      this.scheme.cells[index] = "floor";
    } else this.scheme.cells[index] = this.tool;
    this.paintGrid();
  }
  private paintGrid(): void {
    const colors: Record<Cell, string> = {
      floor: "#344655",
      wall: "#142130",
      brick: "#bd6739",
    };
    for (const cell of this.grid.querySelectorAll<HTMLButtonElement>(
      "button",
    )) {
      const i = Number(cell.dataset.index),
        x = i % COLS,
        y = Math.floor(i / COLS),
        player = this.scheme.spawns.findIndex((p) => p.x === x && p.y === y);
      cell.style.background =
        player < 0
          ? colors[this.scheme.cells[i]]
          : player === 0
            ? "#e3ad28"
            : "#2674be";
      cell.textContent =
        player >= 0
          ? String(player + 1)
          : this.scheme.cells[i] === "brick"
            ? "▦"
            : this.scheme.cells[i] === "wall"
              ? "▪"
              : "";
      cell.setAttribute(
        "aria-label",
        `Row ${y + 1}, column ${x + 1}: ${this.scheme.cells[i]}${player >= 0 ? `, Player ${player + 1} start` : ""}`,
      );
    }
  }
  private setGridFocus(index: number): void {
    for (const cell of this.grid.querySelectorAll<HTMLButtonElement>("button"))
      cell.tabIndex = Number(cell.dataset.index) === index ? 0 : -1;
  }
  private gridKey(event: KeyboardEvent, index: number): void {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -COLS,
      ArrowDown: COLS,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const x = index % COLS,
      target = index + moves[event.key];
    if (
      target < 0 ||
      target >= COLS * ROWS ||
      (event.key === "ArrowLeft" && x === 0) ||
      (event.key === "ArrowRight" && x === COLS - 1)
    )
      return;
    this.focusCell = target;
    this.setGridFocus(target);
    this.grid
      .querySelector<HTMLButtonElement>(`button[data-index="${target}"]`)
      ?.focus({ preventScroll: true });
  }
  private notify(message: string): void {
    this.message = message;
    if (this.status && !this.disposed) this.status.textContent = message;
  }
  private updateStatus(): void {
    if (!this.status || this.disposed) return;
    const checked = validateScheme(this.scheme);
    this.undoButton.disabled = !this.undoStack.length;
    this.redoButton.disabled = !this.redoStack.length;
    this.status.textContent = checked.valid
      ? `${this.message}\n✓ Valid duel map · two starts · connected after demolition`
      : `Map needs attention:\n${checked.errors.join("\n")}`;
  }
  private play(): void {
    const checked = validateScheme(this.scheme);
    if (checked.scheme) this.callbacks.onPlay(checked.scheme);
    else this.notify(checked.errors.join("\n"));
  }
  private async save(): Promise<void> {
    const checked = validateScheme(this.scheme);
    if (!checked.scheme) {
      this.notify(checked.errors.join("\n"));
      return;
    }
    this.scheme = checked.scheme;
    if (SCHEMES.some((map) => map.id === this.scheme.id))
      this.scheme.id = mapId();
    await saveMap(this.scheme);
    if (this.disposed) return;
    this.maps = await loadMaps();
    if (this.disposed) return;
    this.refreshSaved();
    this.notify(
      storageWarning || `Saved “${this.scheme.name}” on this device.`,
    );
  }
  private duplicate(): void {
    this.checkpoint();
    this.scheme.id = mapId();
    this.scheme.name = `${this.scheme.name.slice(0, 72)} copy`;
    delete this.scheme.curated;
    this.render();
    this.notify("New copy ready. Save to keep it on this device.");
  }
  private async remove(): Promise<void> {
    if (!this.maps.some((map) => map.id === this.scheme.id)) {
      this.notify(
        "Choose one of your saved maps to delete. Presets stay available.",
      );
      return;
    }
    await deleteMap(this.scheme.id);
    if (this.disposed) return;
    this.maps = await loadMaps();
    this.scheme.id = mapId();
    this.refreshSaved();
    this.notify(
      storageWarning ||
        "Saved map deleted. The open drawing is still here; save it to restore.",
    );
  }
  private download(format: "json" | "sch"): void {
    try {
      const blob = new Blob([exportScheme(this.scheme, format)], {
        type: format === "json" ? "application/json" : "text/plain",
      });
      const url = URL.createObjectURL(blob),
        link = node("a");
      link.href = url;
      link.download = `${this.scheme.name.replace(/[^a-z0-9_-]/gi, "-").slice(0, 60) || "inkblast-map"}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.notify(`Exported ${format.toUpperCase()} backup.`);
    } catch (error) {
      this.notify(error instanceof Error ? error.message : "Export failed.");
    }
  }
  private async readFile(file: File): Promise<void> {
    if (file.size > 100_000) {
      this.notify("Map file exceeds the 100 KB limit.");
      return;
    }
    try {
      const text = await file.text();
      if (this.disposed) return;
      try {
        this.acceptImport(importScheme(text));
      } catch (error) {
        if (error instanceof SchemeImportError && error.starts)
          this.chooseStarts(text, error.starts);
        else throw error;
      }
    } catch (error) {
      this.notify(
        error instanceof Error
          ? error.message
          : "Could not read this map file.",
      );
    }
  }
  private acceptImport(scheme: EditableScheme): void {
    this.checkpoint();
    this.scheme = scheme;
    this.render();
    this.notify("Imported locally. Review the drawing, test, then save.");
  }
  private chooseStarts(text: string, starts: { x: number; y: number }[]): void {
    const dialog = node("dialog");
    dialog.setAttribute("aria-label", "Choose two player starts");
    dialog.append(
      node("h2", "Make this a duel"),
      node(
        "p",
        "This original scheme has more than two starts. Choose two different locations; Inkblast will clear their immediate escape tiles.",
      ),
    );
    const selects = [node("select"), node("select")];
    selects.forEach((select, i) => {
      starts.forEach((p, j) => {
        const option = node(
          "option",
          `Start ${j + 1}: column ${p.x + 1}, row ${p.y + 1}`,
        );
        option.value = String(j);
        select.append(option);
      });
      select.value = String(i);
      dialog.append(field(`Player ${i + 1}`, select));
    });
    const errorText = node("p");
    errorText.setAttribute("role", "alert");
    dialog.append(
      errorText,
      button(
        "Use these starts",
        () => {
          try {
            const map = importScheme(text, [
              Number(selects[0].value),
              Number(selects[1].value),
            ]);
            dialog.close();
            dialog.remove();
            this.acceptImport(map);
          } catch (error) {
            errorText.textContent =
              error instanceof Error ? error.message : "Invalid starts.";
          }
        },
        "button primary",
      ),
      button("Cancel import", () => {
        dialog.close();
        dialog.remove();
      }),
    );
    dialog.addEventListener("close", () => dialog.remove());
    this.host.append(dialog);
    dialog.showModal();
  }
}
