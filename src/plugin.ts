// src/plugin.ts
import { Plugin, MarkdownPostProcessorContext } from "obsidian";
import { ensureStyles, removeStyles } from "./styles";
import { Decorator } from "./observe";
import { Settings, DEFAULT_SETTINGS, CountdownSettingsTab } from "./settings";
import { renderCardGrid } from "./render";
import { parseDateLike } from "./parseDate";
import { parseShow } from "./units";

export default class CountdownPlugin extends Plugin {
    settings: Settings = { ...DEFAULT_SETTINGS };
    private decorator: Decorator | null = null;
    private mdIntervals = new Set<number>(); // track markdown block timers

    async onload() {
        // Load + styles + settings UI
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        ensureStyles();
        this.addSettingTab(new CountdownSettingsTab(this.app, this));

        // Markdown code block — always register; gate with this.settings.enableMarkdown at runtime
        this.registerMarkdownCodeBlockProcessor(
            "countdown",
            (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
                if (!this.settings.enableMarkdown) return; // toggle-able without restart

                const line = source.trim().split("\n")[0] ?? "";
                const [first, ...rest] = line.split(/\s+/).filter(Boolean);

                // Either a literal date or a frontmatter key
                const firstAsDate = parseDateLike(first);
                const key = firstAsDate != null ? null : (first || "date");

                const opts: Record<string, string> = {};
                for (const tok of rest) {
                    const m = tok.match(/^(\w+)=(.+)$/);
                    if (m) opts[m[1]] = m[2];
                }
                const label = (opts.label ?? "").trim();
                //const label = opts.label ?? (key || first || "Countdown");
                const units = parseShow(opts.show);

                const getTarget = (): number | null => {
                    if (firstAsDate != null) return firstAsDate; // direct literal date
                    const fc = this.app.metadataCache.getCache(ctx.sourcePath);
                    const raw = fc?.frontmatter?.[key!];
                    return parseDateLike(raw);
                };

                const { wrap, tick } = renderCardGrid(
                    el,
                    label,
                    units,
                    getTarget,
                    {
                        padClockUnits: this.settings.padClockUnits,
                        soonMs: this.settings.soonMinutes ? this.settings.soonMinutes * 60 * 1000 : undefined
                    }
                );

                // Start a per-block timer using current tickMs
                const h = window.setInterval(tick, this.settings.tickMs);
                this.mdIntervals.add(h);
                this.registerInterval(h); // Obsidian will clear on unload

                // Re-tick on frontmatter changes of this note
                const off = this.app.metadataCache.on("changed", (file) => {
                    if (file.path === ctx.sourcePath) tick();
                });
                this.registerEvent(off as any);
            }
        );

        // Properties & Bases
        this.decorator = new Decorator(this.app, this.settings);
        this.applySettings(); // start/stop based on toggles
        // Re-observe on layout changes
        this.registerEvent(this.app.workspace.on("layout-change", () => {
            this.restartObservers();
        }));
    }

    onunload() {
        this.decorator?.stop();
        removeStyles();
        this.mdIntervals.clear(); // registerInterval already clears, this just clears our set
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /** Merge + persist + apply immediately (used by Settings tab) */
    async updateSettings(patch: Partial<Settings>) {
        this.settings = { ...this.settings, ...patch };
        await this.saveSettings();
        await this.applySettings();
    }

    /** Apply current settings: (re)start/stop decorator and refresh its config */
    async applySettings() {
        if (!this.decorator) return;

        // Push new settings & refresh decorated nodes
        this.decorator.updateSettings(this.settings);

        // Start or stop observing/ticking depending on toggles
        const shouldRun = this.settings.enableProperties || this.settings.enableBases;
        if (shouldRun) {
            this.decorator.stop();   // idempotent safety
            this.decorator.start();  // uses current tickMs
        } else {
            this.decorator.stop();
        }

        // Note: existing Markdown blocks keep their old tick until the block re-renders.
        // New blocks will use the new tickMs.
    }

    /** Called from settings when patterns/markers change and we want immediate effect */
    recompileDetectors() {
        if (this.decorator) {
            this.decorator.updateSettings(this.settings); // recompiles internally & refreshes
        }
    }

    /** Restart DOM observers (e.g., on layout-change) */
    restartObservers() {
        if (this.decorator) {
            this.decorator.stop();
            this.decorator.start();
        }
    }
}
