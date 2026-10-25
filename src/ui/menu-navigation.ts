type ChoiceField = HTMLSelectElement | HTMLInputElement;

function menuItems(scope: HTMLElement): HTMLElement[] {
  return Array.from(
    scope.querySelectorAll<HTMLElement>(
      'button, select, input:not([type="file"]), summary',
    ),
  ).filter(
    (item) => item.getClientRects().length > 0 && !item.matches(":disabled"),
  );
}

export function installMenuNavigation(
  root: () => HTMLElement | null,
  back: () => void,
): void {
  const chooser = document.createElement("dialog");
  chooser.id = "choice-dialog";
  chooser.className = "panel-dialog arcade-dialog";
  chooser.setAttribute("aria-labelledby", "choice-title");
  document.body.append(chooser);

  function choose(field: ChoiceField): void {
    const title = document.createElement("h2");
    title.id = "choice-title";
    title.textContent =
      field.labels?.[0]?.childNodes[0]?.textContent ?? "Choose";
    const list = document.createElement("div");
    list.className = "arcade-list choice-list";
    const choices =
      field instanceof HTMLSelectElement
        ? Array.from(field.options).filter((option) => !option.disabled)
        : Array.from({ length: 11 }, (_, index) => ({
            value: String(index / 10),
            text: index === 0 ? "Off" : `${index * 10}%`,
          }));
    const currentValue =
      field instanceof HTMLSelectElement
        ? field.value
        : String(Math.round(Number(field.value) * 10) / 10);
    for (const option of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = option.text;
      button.setAttribute(
        "aria-pressed",
        String(option.value === currentValue),
      );
      button.onclick = () => {
        field.value = option.value;
        field.dispatchEvent(new Event("change", { bubbles: true }));
        chooser.close();
        field.focus();
      };
      list.append(button);
    }
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Back";
    cancel.onclick = () => chooser.close();
    list.append(cancel);
    chooser.replaceChildren(title, list);
    chooser.showModal();
    const selected = list.querySelector<HTMLButtonElement>(
      '[aria-pressed="true"]',
    );
    (selected ?? list.querySelector("button"))?.focus();
    selected?.scrollIntoView({ block: "nearest" });
  }

  document.addEventListener("focusin", (event) => {
    document
      .querySelectorAll(".is-selected")
      .forEach((item) => item.classList.remove("is-selected"));
    const target = event.target;
    if (target instanceof HTMLElement)
      (target.closest("label") ?? target).classList.add("is-selected");
  });

  window.addEventListener("keydown", (event) => {
    const scope = chooser.open ? chooser : root();
    if (
      !scope ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (!event.repeat) {
        if (chooser.open) chooser.close();
        else back();
      }
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const items = menuItems(scope);
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next =
        index < 0
          ? event.key === "ArrowDown"
            ? 0
            : items.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
      items[next].focus();
      items[next].scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      const field = document.activeElement;
      if (
        field instanceof HTMLSelectElement ||
        (field instanceof HTMLInputElement && field.type === "range")
      ) {
        event.preventDefault();
        choose(field);
      } else if (
        field instanceof HTMLInputElement &&
        field.type === "checkbox"
      ) {
        event.preventDefault();
        field.checked = !field.checked;
        field.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (!scope.contains(field)) {
        event.preventDefault();
        menuItems(scope)[0]?.click();
      }
    }
  });
}
