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
    private mdIntervals = new Set<number>();

    async onload() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        ensureStyles();

        // Settings UI
        this.addSettingTab(new CountdownSettingsTab(this.app, this));

        // Markdown code block
        if (this.settings.enableMarkdown) {
            this.registerMarkdownCodeBlockProcessor(
                "countdown",
                (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
                    const line = source.trim().split("\n")[0] ?? "";
                    const [first, ...rest] = line.split(/\s+/).filter(Boolean);

                    // Detect if the first token looks like a date
                    const firstAsDate = parseDateLike(first);
                    const key = firstAsDate != null ? null : (first || "date");

                    const opts: Record<string, string> = {};
                    for (const tok of rest) {
                        const m = tok.match(/^(\w+)=(.+)$/);
                        if (m) opts[m[1]] = m[2];
                    }
                    const label = opts.label ?? (key || first || "Countdown");
                    const units = parseShow(opts.show);

                    // Return either the parsed date or a frontmatter lookup
                    const getTarget = (): number | null => {
                        if (firstAsDate != null) return firstAsDate; // direct date form
                        const fc = this.app.metadataCache.getCache(ctx.sourcePath);
                        const raw = fc?.frontmatter?.[key!];
                        return parseDateLike(raw);
                    };


                    const { wrap, tick } = renderCardGrid(el, label, units, getTarget);
                    // local ticking for this block (not tied to Decorator)
                    const h = window.setInterval(tick, this.settings.tickMs);
                    this.mdIntervals.add(h);
                    this.registerInterval(h);

                    const off = this.app.metadataCache.on("changed", (file) => {
                        if (file.path === ctx.sourcePath) tick();
                    });
                    this.registerEvent(off as any);
                }
            );
        }

        // Properties & Bases
        this.decorator = new Decorator(this.app, this.settings);
        this.decorator.start();

        // Rescan on layout changes
        this.registerEvent(this.app.workspace.on("layout-change", () => {
            this.restartObservers();
        }));
    }

    onunload() {
        this.decorator?.stop();
        removeStyles();
        // intervals registered via registerInterval are auto-cleared by Obsidian
        this.mdIntervals.clear();
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /** Called from settings tab when patterns/markers change */
    recompileDetectors() {
        if (this.decorator) {
            this.decorator.updateSettings(this.settings);
        }
    }

    /** Restart DOM observers/tick with updated interval/settings */
    restartObservers() {
        if (this.decorator) {
            this.decorator.stop();
            this.decorator.updateSettings(this.settings);
            this.decorator.start();
        }
    }
}
