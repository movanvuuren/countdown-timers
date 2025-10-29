import { pad2, splitUnits, type Unit } from "./units";

/** Build inline countdown shell and wire up edit activation */
export function createInlineShell(
    units: Unit[],
    onActivateEdit: () => void,
    showUnitLabels = true
) {
    const shell = document.createElement("div");
    shell.className = "cdw cdw-inline";
    shell.tabIndex = 0;

    shell.addEventListener("click", (ev) => { ev.stopPropagation(); onActivateEdit(); });
    shell.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onActivateEdit(); }
    });

    units.forEach((u, idx) => {
        const piece = document.createElement("span");
        piece.className = "cdw-piece";
        piece.setAttribute("data-unit", u);
        shell.appendChild(piece);

        if (showUnitLabels) {
            const label = document.createElement("span");
            label.className = "cdw-unit";
            label.textContent = u;
            shell.appendChild(label);
        }

        if (idx < units.length - 1) {
            const sep = document.createElement("span");
            sep.className = "cdw-sep";
            sep.textContent = " ";
            shell.appendChild(sep);
        }
    });

    return shell;
}

/** Update an inline shell with new values */
export function drawInline(
  shell: HTMLElement,
  targetMs: number,
  units: Unit[],
  padClockUnits = true,
  soonMs?: number
) {
  const diff = targetMs - Date.now();
  const parts = splitUnits(diff, units);

  shell.querySelectorAll<HTMLElement>(".cdw-piece").forEach((sp) => {
    const u = sp.getAttribute("data-unit") as Unit;
    const n = parts[u];
    const needsPad = padClockUnits && (u === "h" || u === "m" || u === "s");
    sp.textContent = needsPad ? pad2(n) : String(n);
  });

  const isDue = diff <= 0;
  const isSoon = !!soonMs && diff > 0 && diff <= soonMs;

  shell.classList.toggle("cdw-complete", isDue);
  shell.classList.toggle("cdw-due", isDue);

  // Always set/clear soon explicitly (prevents stale 'soon' after due)
  shell.classList.toggle("cdw-soon", isSoon);
  if (isDue) shell.classList.remove("cdw-soon");

  // Optional: expose state for quick debugging in devtools
  shell.setAttribute("data-cdw-state", isDue ? "due" : (isSoon ? "soon" : "normal"));

  const aria = units.map((u) => `${parts[u]} ${u}`).join(" ");
  shell.setAttribute("aria-label", aria);
}


/** Build Markdown countdown card grid */

export function renderCardGrid(
  el: HTMLElement,
  label: string,
  units: Unit[],
  getTarget: () => number | null,
  opts?: { padClockUnits?: boolean; soonMs?: number }
) {
  const padClock = opts?.padClockUnits ?? true;
  const soonMs = opts?.soonMs;

  const wrap = el.createDiv({ cls: "cdw cdk-grid" });
  const title = wrap.createDiv({ cls: "cdw-title" });
  title.textContent = label;

  const captions: Record<Unit, string> = { w: "weeks", d: "days", h: "hours", m: "minutes", s: "seconds" };
  const valueEls: Partial<Record<Unit, HTMLElement>> = {};
  const cardEls: Partial<Record<Unit, HTMLElement>> = {};

  for (const u of units) {
    const card = wrap.createDiv({ cls: "cdw-card" });
    const value = card.createDiv({ cls: "cdw-value" });
    const cap = card.createDiv({ cls: "cdw-cap" });
    cap.textContent = captions[u];

    valueEls[u] = value;
    cardEls[u] = card;
  }

  const tick = () => {
    const target = getTarget();
    if (target == null) {
      wrap.addClass("cdw-invalid");
      for (const u of units) valueEls[u]!.textContent = "—";
      wrap.setAttr("aria-label", `${label}: invalid date`);
      // clear state classes
      wrap.removeClass("cdw-soon");
      wrap.removeClass("cdw-due");
      wrap.removeClass("cdw-complete");
      wrap.setAttr("data-cdw-state", "invalid");
      return;
    }

    const diff = target - Date.now();
    const parts = splitUnits(diff, units);

    for (const u of units) {
      const n = parts[u];
      const needsPad = padClock && (u === "h" || u === "m" || u === "s");
      valueEls[u]!.textContent = needsPad ? pad2(n) : String(n);
    }

    const isDue = diff <= 0;
    const isSoon = !!soonMs && diff > 0 && diff <= soonMs;

    wrap.toggleClass("cdw-complete", isDue);
    wrap.toggleClass("cdw-due", isDue);
    wrap.toggleClass("cdw-soon", isSoon);
    if (isDue) wrap.removeClass("cdw-soon");

    wrap.setAttr("data-cdw-state", isDue ? "due" : (isSoon ? "soon" : "normal"));

    // aria label
    const aria = units.map((u) => `${parts[u]} ${captions[u]}`).join(" ");
    wrap.setAttr("aria-label", `${label}: ${aria}`);
  };

  tick();
  return { wrap, tick };
}

