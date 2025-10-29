import type { App, MarkdownPostProcessorContext } from "obsidian";
import { CANDIDATES, ROOTS } from "./selectors";
import { decideUnits, compileHeaderPattern, compileMarkerRegex, findHeaderTextForCell } from "./detect";
import { parseDateLike, extractDateText, normalizePropKeyForFM, getCardFileBasename, findTFileByBasename, focusFirstEditorIn } from "./parseDate";
import { createInlineShell, drawInline } from "./render";
import { parseShow, type Unit } from "./units";
import type { Settings } from "./settings";

type DecorCfg = { getTarget: () => number | null; units: Unit[]; label: string };

export class Decorator {
    private app: App;
    private settings: Settings;
    private observers: MutationObserver[] = [];
    private tickHandle: number | null = null;
    private decorated = new WeakMap<HTMLElement, DecorCfg>();
    private decoratedCells = new Set<HTMLElement>();
    private cellObservers = new Map<HTMLElement, MutationObserver>();

    private patternRe: RegExp | null = null;
    private markerRe: RegExp | null = null;

    constructor(app: App, settings: Settings) {
        this.app = app;
        this.settings = settings;
        this.compileDetectors();
    }

    updateSettings(settings: Settings) {
        this.settings = settings;
        this.compileDetectors();
        this.refreshAllDecorated();
    }

    private compileDetectors() {
        this.patternRe = compileHeaderPattern(this.settings.headerPattern);
        this.markerRe = compileMarkerRegex(this.settings.headerMarker);
    }

    start() {
        this.observeContainers();
        if (this.tickHandle != null) window.clearInterval(this.tickHandle);
        this.tickHandle = window.setInterval(() => this.refreshAllDecorated(), this.settings.tickMs);
    }

    stop() {
        this.observers.forEach(o => o.disconnect());
        this.observers = [];
        if (this.tickHandle != null) {
            window.clearInterval(this.tickHandle);
            this.tickHandle = null;
        }
    }

    /** Observe top-level roots and rescan on mutations */
    private observeContainers() {
        this.observers.forEach(o => o.disconnect());
        this.observers = [];

        const roots = document.querySelectorAll<HTMLElement>(ROOTS);
        const attach = (root: HTMLElement) => {
            this.scanAndDecorate(root);
            const mo = new MutationObserver(() => this.scanAndDecorate(root));
            mo.observe(root, { subtree: true, childList: true, attributes: true });
            this.observers.push(mo);
        };

        if (roots.length > 0) roots.forEach(attach);
        else attach(document.body as HTMLElement);
    }

    private scanAndDecorate(root: HTMLElement) {
        const candidates = root.querySelectorAll<HTMLElement>(CANDIDATES);

        candidates.forEach((host) => {
            if (this.decorated.has(host)) return;
            if (host.querySelector(".cdw.cdw-inline")) return;

            // Skip card title (file.name)
            const cardProp = host.closest<HTMLElement>(".bases-cards-property[data-property]");
            if (cardProp?.getAttribute("data-property") === "file.name") return;

            const header = findHeaderTextForCell(host);
            if (!header) return;

            const units = decideUnits(
                header,
                this.settings.columnMap,
                this.patternRe,
                this.markerRe,
                this.settings.defaultUnits
            );
            if (!units) return;

            const shell = createInlineShell(units, () => focusFirstEditorIn(host), this.settings.showUnitLabels);

            host.classList.add("cdw-has-countdown");
            host.insertBefore(shell, host.firstChild);
            (host as any).setAttr?.("data-cdw", "1");

            // Target resolver: DOM → Cards (FM via title) → Table (FM via same row file.name)
            const getTarget = () => {
                // 1) direct DOM/input
                const v = extractDateText(host);
                const fromDom = parseDateLike(v);
                if (fromDom != null) return fromDom;

                // 2) cards: lookup FM by card title
                const card = host.closest<HTMLElement>(".bases-cards-item");
                if (card) {
                    const basename = getCardFileBasename(card);
                    if (basename) {
                        const tfile = findTFileByBasename(this.app, basename);
                        if (tfile) {
                            const rawKey = findHeaderTextForCell(host) || "";
                            const key = normalizePropKeyForFM(rawKey);
                            const fm = this.app.metadataCache.getFileCache(tfile)?.frontmatter;
                            const raw = fm ? fm[key] : undefined;
                            const hit = parseDateLike(raw);
                            if (hit != null) return hit;
                        }
                    }
                }

                // 3) tables: lookup FM by file.name in the same row
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
                            const rawKey = findHeaderTextForCell(host) || "";
                            const key = normalizePropKeyForFM(rawKey);
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
            this.decorated.set(host, { getTarget, units, label: header });
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

    private drawOne(cell: HTMLElement) {
        const cfg = this.decorated.get(cell);
        if (!cfg) return;
        const cdw = cell.querySelector(".cdw") as HTMLElement | null;
        const target = cfg.getTarget();
        if (!cdw || target == null) return;

        drawInline(
            cdw,
            target,
            cfg.units,
            this.settings.padClockUnits,
            this.settings.soonMinutes ? this.settings.soonMinutes * 60 * 1000 : undefined
        );
        cdw.setAttribute("aria-label", `${cfg.label}: ${cdw.getAttribute("aria-label")}`);
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
}
