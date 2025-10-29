import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  MarkdownPostProcessorContext,
  TFile,
} from "obsidian";

type Unit = "w" | "d" | "h" | "m" | "s";
const UNIT_MS: Record<Unit, number> = {
  w: 7 * 24 * 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  h: 60 * 60 * 1000,
  m: 60 * 1000,
  s: 1000,
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function parseShow(spec?: string): Unit[] {
  const fallback: Unit[] = ["d", "h", "m", "s"];
  if (!spec) return fallback;
  const units: Unit[] = [];
  for (const ch of spec.toLowerCase()) {
    if ("wdhms".includes(ch) && !units.includes(ch as Unit)) units.push(ch as Unit);
  }
  return units.length ? units : fallback;
}

function splitUnits(msIn: number, units: Unit[]) {
  let ms = Math.max(0, msIn);
  const out: Record<Unit, number> = { w: 0, d: 0, h: 0, m: 0, s: 0 };
  units.forEach((u, i) => {
    const isLast = i === units.length - 1;
    out[u] = Math.floor(ms / UNIT_MS[u]);
    if (!isLast) ms -= out[u] * UNIT_MS[u];
  });
  return out;
}

function parseDateLike(v: any): number | null {
  if (!v) return null;
  // @ts-ignore
  const M = (window as any).moment;
  if (M) {
    const m = M(v);
    if (m?.isValid()) return m.valueOf();
  }
  const t = new Date(v as any).getTime();
  return isNaN(t) ? null : t;
}

/* ---------- Bases card helpers ---------- */
function getCardFileBasename(cardEl: HTMLElement): string | null {
  const titleLine = cardEl.querySelector<HTMLElement>(".bases-cards-property.mod-title .bases-cards-line");
  const name = titleLine?.textContent?.trim();
  return name || null; // this is file.name (basename)
}
function findTFileByBasename(app: App, basename: string) {
  const files = app.vault.getFiles();
  return files.find(f => f.basename === basename) || null;
}

/* ---------------- Settings ---------------- */
interface CfgMap { [columnName: string]: string; }
interface Settings {
  columnMap: CfgMap;
  headerMarker: string;      // e.g. "⏳|⌛"
  headerPattern: string;     // e.g. "\\[cd:([wdhms]+)\\]"
}
const DEFAULT_SETTINGS: Settings = {
  columnMap: {},
  headerMarker: "⏳|⌛",
  headerPattern: "\\[cd:([wdhms]+)\\]",
};

/* ---------------- Plugin ---------------- */
export default class CountdownPlugin extends Plugin {
  settings: Settings = DEFAULT_SETTINGS;

  private tickId: number | null = null;
  private observers: MutationObserver[] = [];
  private decorated = new WeakMap<HTMLElement, { getTarget: () => number | null; units: Unit[]; label: string }>();
  private decoratedCells = new Set<HTMLElement>();
  private cellObservers = new Map<HTMLElement, MutationObserver>();
  private styleEl: HTMLStyleElement | null = null;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addSettingTab(new CountdownSettingsTab(this.app, this));
    this.ensureStyles();

    /* --------- Markdown code block (frontmatter countdown) --------- */
    // ```countdown <frontmatterKey?> [label=Title] [show=dhms]```
    this.registerMarkdownCodeBlockProcessor(
      "countdown",
      (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        const line = source.trim().split("\n")[0] ?? "";
        const [rawKey, ...rest] = line.split(/\s+/).filter(Boolean);
        const key = rawKey || "date";

        const opts: Record<string, string> = {};
        for (const tok of rest) {
          const m = tok.match(/^(\w+)=(.+)$/);
          if (m) opts[m[1]] = m[2];
        }
        const label = opts.label ?? key;
        const units = parseShow(opts.show);

        const wrap = el.createDiv({ cls: "cdw cdk-grid" });
        const title = wrap.createDiv({ cls: "cdw-title" });
        title.textContent = label;

        const captions: Record<Unit, string> = { w: "weeks", d: "days", h: "hours", m: "minutes", s: "seconds" };
        const valueEls: Partial<Record<Unit, HTMLElement>> = {};
        for (const u of units) {
          const card = wrap.createDiv({ cls: "cdw-card" });
          const value = card.createDiv({ cls: "cdw-value" });
          const cap = card.createDiv({ cls: "cdw-cap" });
          cap.textContent = captions[u];
          valueEls[u] = value;
        }

        const getTargetMs = (): number | null => {
          const fc = this.app.metadataCache.getCache(ctx.sourcePath);
          const raw = fc?.frontmatter?.[key];
          return parseDateLike(raw);
        };

        let targetMs = getTargetMs();
        if (targetMs == null) {
          wrap.addClass("cdw-invalid");
          for (const u of units) valueEls[u]!.textContent = "—";
          return;
        }

        const update = () => {
          const diff = (targetMs ?? 0) - Date.now();
          const parts = splitUnits(diff, units);
          for (const u of units) {
            const n = parts[u];
            valueEls[u]!.textContent = (u === "h" || u === "m" || u === "s") ? pad2(n) : String(n);
          }
          wrap.toggleClass("cdw-complete", diff <= 0);
          const aria = units.map((u) => `${parts[u]} ${captions[u]}`).join(" ");
          wrap.setAttr("aria-label", `${label}: ${aria}`);
        };

        update();
        const handle = window.setInterval(update, 1000);
        this.registerInterval(handle);

        const off = this.app.metadataCache.on("changed", (file) => {
          if (file.path === ctx.sourcePath) {
            const next = getTargetMs();
            if (next != null) targetMs = next;
          }
        });
        this.registerEvent(off as any);
      }
    );

    /* --------- Properties / Bases tables & cards --------- */
    this.tickId = window.setInterval(() => this.refreshAllDecorated(), 1000);
    this.registerInterval(this.tickId);

    this.observeContainers();
    this.registerEvent(this.app.workspace.on("layout-change", () => this.observeContainers()));
  }

  onunload() {
    this.observers.forEach((o) => o.disconnect());
    this.observers = [];
    if (this.styleEl) { this.styleEl.remove(); this.styleEl = null; }
  }

  /* ---------- Styles ---------- */
  private ensureStyles() {
    if (this.styleEl) return;
    const css = `
/* Hide editors in editable cells unless focused; reading-view chips unaffected */
.metadata-property-value.cdw-has-countdown:not(:focus-within) .metadata-input-longtext,
.metadata-property-value.cdw-has-countdown:not(:focus-within) .metadata-link,
.metadata-property-value.cdw-has-countdown:not(:focus-within) input.mod-date,
.metadata-property-value.cdw-has-countdown:not(:focus-within) input.mod-datetime {
  display: none;
}

/* Inline countdown look */
.cdw.cdw-inline {
  display: inline-flex;
  gap: .15rem;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
}
.cdw-piece { font-weight: 600; }
.cdw-unit { opacity: .75; font-size: .9em; margin-left: .1rem; }
.cdw-sep { opacity: .4; }
.cdw.cdw-complete { opacity: .7; }

/* Cards: compact spacing */
.bases-card .bases-card-field-value .cdw.cdw-inline,
.bases-cards-property .bases-cards-line .cdw.cdw-inline {
  gap: .2rem;
}
`;
    const el = document.createElement("style");
    el.id = "cdw-styles";
    el.textContent = css;
    document.head.appendChild(el);
    this.styleEl = el;
  }

  /* ---------- Observe roots ---------- */
  /* ---------- Observe roots ---------- */
  private observeContainers() {
    this.observers.forEach((o) => o.disconnect());
    this.observers = [];

    // Sufficient, non-overlapping roots
    const selector = [
      ".metadata-container",                                   // reading-view properties block
      ".workspace-leaf-content[data-type='file-properties']",  // right-side file properties pane
      ".bases-view"                                            // Bases tables & cards
    ].join(", ");

    const roots = document.querySelectorAll<HTMLElement>(selector);

    const attach = (root: HTMLElement) => {
      this.scanAndDecorate(root);
      const mo = new MutationObserver(() => this.scanAndDecorate(root));
      mo.observe(root, { subtree: true, childList: true, attributes: true });
      this.observers.push(mo);
    };

    if (roots.length > 0) roots.forEach(attach);
    else attach(document.body as HTMLElement);
  }


  /* ---------- Decorate cells ---------- */
  /* ---------- Decorate cells ---------- */


  // const candidates = root.querySelectorAll<HTMLElement>( [ // Bases table cells + Pretty Properties 
  // ".bases-table-cell.bases-metadata-value", ".metadata-property-value", // Reading-view property values (chips) 
  // ".metadata-container .metadata-property .metadata-property-value", // Bases cards (the per-property value line) 
  // ".bases-cards-property .bases-cards-line", // tables / properties 
  // "td, div[role='cell']", // cards: the rendered value line within each property row 
  // ".bases-cards-item .bases-cards-property .bases-cards-line", 
  // // Fallbacks 
  // "td, div[role='cell']", ].join(",") );

  // const candidates = root.querySelectorAll<HTMLElement>([
  //   // Properties/read view & file-properties pane
  //   ".metadata-property-value",

  //   // Bases TABLE: the value cell inside each column cell
  //   ".bases-td > .bases-table-cell.bases-metadata-value",

  //   // Bases CARDS: the rendered value line of each property row
  //   ".bases-cards-item .bases-cards-property .bases-cards-line",
  // ].join(","));
  /* ---------- Decorate cells ---------- */
  private scanAndDecorate(root: HTMLElement) {
  const candidates = root.querySelectorAll<HTMLElement>([
    // Properties (reading-view & file-properties)
    ".metadata-property[data-property-key] > .metadata-property-value",

    // Bases TABLE: value cell inside column cell
    ".bases-td[data-property] > .bases-table-cell.bases-metadata-value",

    // Bases CARDS: decorate the rendered value line so we survive reflows/virtualization
    ".bases-cards-item .bases-cards-property[data-property] .bases-cards-line",
  ].join(","));

  candidates.forEach((host) => {
    // Already decorated?
    if (this.decorated.has(host)) return;
    if (host.querySelector(".cdw.cdw-inline")) return;  // avoid :scope brittle syntax

    // Skip card title (file.name)
    const cardProp = host.closest<HTMLElement>(".bases-cards-property[data-property]");
    if (cardProp?.getAttribute("data-property") === "file.name") return;

    // Resolve header/key (label-hidden safe)
    const header = this.findHeaderTextForCell(host);
    if (!header) return;

    // Decide units (columnMap → [cd:...] → hourglass marker)
    let units: Unit[] | null = null;

    for (const col in this.settings.columnMap) {
      if (header.trim().toLowerCase() === col.trim().toLowerCase()) {
        units = parseShow(this.settings.columnMap[col]);
        break;
      }
    }
    if (!units && this.settings.headerPattern) {
      try {
        const re = new RegExp(this.settings.headerPattern, "i");
        const m = header.match(re);
        if (m && m[1]) units = parseShow(m[1]);
      } catch { /* ignore */ }
    }
    if (!units && this.settings.headerMarker) {
      const parts = this.settings.headerMarker.split("|").map(esc);
      const re = new RegExp(`(${parts.join("|")})`);
      if (re.test(header)) units = parseShow("dhms");
    }
    if (!units) return;

    // Build shell
    const shell = document.createElement("div");
    shell.className = "cdw cdw-inline";
    shell.tabIndex = 0;
    shell.addEventListener("click", (ev) => { ev.stopPropagation(); focusFirstEditorIn(host); });
    shell.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); focusFirstEditorIn(host); }
    });

    const unitList = units as Unit[];
    unitList.forEach((u, idx) => {
      const piece = document.createElement("span");
      piece.className = "cdw-piece";
      piece.setAttribute("data-unit", u);
      shell.appendChild(piece);

      const label = document.createElement("span");
      label.className = "cdw-unit";
      label.textContent = u;
      shell.appendChild(label);

      if (idx < unitList.length - 1) {
        const sep = document.createElement("span");
        sep.className = "cdw-sep";
        sep.textContent = " ";
        shell.appendChild(sep);
      }
    });

    // Insert (always at the host start)
    host.classList.add("cdw-has-countdown");
    host.insertBefore(shell, host.firstChild);
    (host as any).setAttr?.("data-cdw", "1");

    // Target resolver: DOM → Cards (FM via title) → Table (FM via same row file.name)
    const getTarget = () => {
      // 1) DOM/input (works for properties & table edit mode)
      const v = this.extractDateText(host);
      const fromDom = parseDateLike(v);
      if (fromDom != null) return fromDom;

      // 2) Cards: lookup FM by card title
      const card = host.closest<HTMLElement>(".bases-cards-item");
      if (card) {
        const titleLine = card.querySelector<HTMLElement>(".bases-cards-property.mod-title .bases-cards-line");
        const basename = titleLine?.textContent?.trim();
        if (basename) {
          const tfile = findTFileByBasename(this.app, basename);
          if (tfile) {
            const rawKey = this.findHeaderTextForCell(host) || "";
            const key = this.normalizePropKeyForFM(rawKey);
            const fm = this.app.metadataCache.getFileCache(tfile)?.frontmatter;
            const raw = fm ? fm[key] : undefined;
            const hit = parseDateLike(raw);
            if (hit != null) return hit;
          }
        }
      }

      // 3) Table: lookup FM by file.name in the same row
      const row = host.closest<HTMLElement>(".bases-tr");
      if (row) {
        const nameEl = row.querySelector<HTMLElement>(
          ".bases-td[data-property='file.name'] .bases-rendered-value, " +
          ".bases-td[data-property='file.name'] a"
        );
        const filename = nameEl?.textContent?.trim();
        if (filename) {
          const tfile = findTFileByBasename(this.app, filename);
          if (tfile) {
            const rawKey = this.findHeaderTextForCell(host) || "";
            const key = this.normalizePropKeyForFM(rawKey);
            const fm = this.app.metadataCache.getFileCache(tfile)?.frontmatter;
            const raw = fm ? fm[key] : undefined;
            const hit = parseDateLike(raw);
            if (hit != null) return hit;
          }
        }
      }

      return null;
    };

    // Register + live updates + first paint
    this.decorated.set(host, { getTarget, units: unitList, label: header });
    this.decoratedCells.add(host);

    host.querySelectorAll<HTMLInputElement>("input.mod-date, input.mod-datetime")
      .forEach(inp => {
        inp.addEventListener("input", () => this.drawOne(host));
        inp.addEventListener("change", () => this.drawOne(host));
      });

    const longtext = host.querySelector<HTMLElement>(".metadata-input-longtext");
    if (longtext) longtext.addEventListener("input", () => this.drawOne(host));

    const attrMo = new MutationObserver(() => this.drawOne(host));
    attrMo.observe(host, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-property-longtext-value", "datetime", "value", "data-raw", "data-value"],
    });
    this.cellObservers.set(host, attrMo);

    this.drawOne(host);
  });
}







  /* ---------- Helpers ---------- */
  private normalizePropKeyForFM(header: string): string {
    return (header || "")
      .replace(/^(note|file|prop)\./i, "")   // strip Bases prefixes
      .replace(/[⏳⌛]/g, "")                 // drop hourglass glyphs
      .replace(/\[cd:[wdhms]+\]/ig, "")      // drop inline unit tags
      .trim();
  }


  /* ---------- Header/key resolution (label-hidden safe) ---------- */

  private findHeaderTextForCell(el: HTMLElement): string | null {
  const clean = (s: string | null | undefined) =>
    (s ?? "").trim() || null;

  const prop = el.closest<HTMLElement>(".metadata-property[data-property-key]");
  if (prop) return clean(prop.getAttribute("data-property-key"));  // "due⏳"

  const td = el.closest<HTMLElement>(".bases-td[data-property]");
  if (td) return clean(td.getAttribute("data-property"));          // "note.due⏳"

  const cardProp = el.closest<HTMLElement>(".bases-cards-property[data-property]");
  if (cardProp) return clean(cardProp.getAttribute("data-property")); // "note.due⏳"

  return null;
}


  // private findHeaderTextForCell(el: HTMLElement): string | null {
  //   const clean = (s: string | null | undefined) =>
  //     (s ?? "")
  //       .replace(/^(note|file|prop)\./i, "")
  //       .replace(/[⏳⌛]/g, "")
  //       .trim() || null;

  //   // Properties (reading-view / file-properties)
  //   const prop = el.closest<HTMLElement>(".metadata-property[data-property-key]");
  //   if (prop) return clean(prop.getAttribute("data-property-key"));

  //   // Bases TABLE
  //   const td = el.closest<HTMLElement>(".bases-td[data-property]");
  //   if (td) return clean(td.getAttribute("data-property"));

  //   // Bases CARDS
  //   const cardProp = el.closest<HTMLElement>(".bases-cards-property[data-property]");
  //   if (cardProp) return clean(cardProp.getAttribute("data-property"));

  //   return null;
  // }




  private extractDateText(host: HTMLElement): string {
    const timeEl = host.querySelector("time[datetime]") as HTMLElement | null;
    if (timeEl?.getAttribute("datetime")) return timeEl.getAttribute("datetime")!;

    const dateInput = host.querySelector("input.mod-date") as HTMLInputElement | null;
    if (dateInput?.value) return dateInput.value;
    if (dateInput?.getAttribute("value")) return dateInput.getAttribute("value")!;

    const dtInput = host.querySelector("input.mod-datetime") as HTMLInputElement | null;
    if (dtInput?.value) return dtInput.value;
    if (dtInput?.getAttribute("value")) return dtInput.getAttribute("value")!;

    const longtext = host.querySelector(".metadata-input-longtext") as HTMLElement | null;
    if (longtext) {
      const v = longtext.getAttribute("data-property-longtext-value");
      if (v) return v.trim();
      if (longtext.textContent?.trim()) return longtext.textContent.trim();
    }

    // Cards: read from the value line attributes if present
    const line = host.closest(".bases-cards-property")?.querySelector(".bases-cards-line") as HTMLElement | null;
    if (line) {
      const dv = line.getAttribute("data-raw") || line.getAttribute("data-value");
      if (dv && dv.trim()) return dv.trim();
    }

    const rawAttr = host.getAttribute("data-raw");
    if (rawAttr) return rawAttr.trim();

    return (host.textContent || "").trim();
  }


  private refreshAllDecorated() {
    this.decoratedCells.forEach((el) => {
      if (!document.body.contains(el)) {
        this.decorated.delete(el);
        this.decoratedCells.delete(el);
        const mo = this.cellObservers.get(el);
        if (mo) mo.disconnect();
        this.cellObservers.delete(el);
        return;
      }
      this.drawOne(el);
    });
  }

  private drawOne(cell: HTMLElement) {
    const cfg = this.decorated.get(cell);
    if (!cfg) return;
    const cdw = cell.querySelector(".cdw") as HTMLElement | null;
    const target = cfg.getTarget();
    if (!cdw || target == null) return;

    const diff = target - Date.now();
    const parts = splitUnits(diff, cfg.units);

    cdw.querySelectorAll<HTMLElement>(".cdw-piece").forEach((sp) => {
      const u = sp.getAttribute("data-unit") as Unit;
      const n = parts[u];
      sp.textContent = (u === "h" || u === "m" || u === "s") ? pad2(n) : String(n);
    });

    cdw.classList.toggle("cdw-complete", diff <= 0);
    cdw.setAttribute("aria-label", `${cfg.label}: ${cfg.units.map((u) => `${parts[u]} ${u}`).join(" ")}`);
  }

  async saveSettings() { await this.saveData(this.settings); }
}

function focusFirstEditorIn(cell: HTMLElement) {
  const editor =
    cell.querySelector<HTMLInputElement>("input.mod-date, input.mod-datetime") ||
    cell.querySelector<HTMLElement>(".metadata-input-longtext");
  if (editor instanceof HTMLInputElement) {
    editor.style.display = ""; editor.focus(); editor.select?.();
  } else if (editor) {
    (editor as HTMLElement).style.display = ""; (editor as HTMLElement).focus();
  }
}

/* ---------------- Settings tab ---------------- */
class CountdownSettingsTab extends PluginSettingTab {
  plugin: CountdownPlugin;
  constructor(app: App, plugin: CountdownPlugin) { super(app, plugin); this.plugin = plugin; }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h3", { text: "Countdown (Markdown + Bases + Reading View)" });

    new Setting(containerEl)
      .setName("Header marker(s)")
      .setDesc("If a property name contains one of these markers (e.g., 'Due ⏳'), render it as a countdown using default units (dhms). Separate multiple with '|', e.g. ⏳|⌛")
      .addText((t) => t.setPlaceholder("⏳|⌛")
        .setValue(this.plugin.settings.headerMarker)
        .onChange(async (v) => { this.plugin.settings.headerMarker = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("Header pattern")
      .setDesc("Regex with 1 capture group for units. Example: \\[cd:([wdhms]+)\\] so 'Birthday [cd:wdhms]' uses weeks→seconds.")
      .addText((t) => t.setPlaceholder("\\[cd:([wdhms]+)\\]")
        .setValue(this.plugin.settings.headerPattern)
        .onChange(async (v) => { this.plugin.settings.headerPattern = v; await this.plugin.saveSettings(); }));

    containerEl.createEl("h4", { text: "Explicit column map" });
    const hint = containerEl.createEl("div", { text: 'Map property/column names to unit specs (case-insensitive). Example: { "Due Date": "dhms" }' });
    hint.addClass("setting-item-description");

    const ta = containerEl.createEl("textarea");
    ta.style.width = "100%";
    ta.style.minHeight = "140px";
    ta.value = JSON.stringify(this.plugin.settings.columnMap, null, 2);
    ta.addEventListener("change", async () => {
      try {
        const parsed = JSON.parse(ta.value) as CfgMap;
        this.plugin.settings.columnMap = parsed;
        await this.plugin.saveSettings();
        ta.classList.remove("mod-warning");
      } catch {
        ta.classList.add("mod-warning");
      }
    });
  }
}
