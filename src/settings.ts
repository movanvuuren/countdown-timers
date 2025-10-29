import { PluginSettingTab, Setting, App } from "obsidian";

export interface Settings {
    // detection
    columnMap: Record<string, string>;
    headerMarker: string;       // e.g. "⏳|⌛"
    headerPattern: string;      // e.g. "\\[cd:([wdhms]+)\\]"
    defaultUnits: string;       // used when marker hit, e.g. "dhms"

    // behaviour
    enableMarkdown: boolean;
    enableProperties: boolean;
    enableBases: boolean;
    tickMs: number;

    // render
    showUnitLabels: boolean;
    padClockUnits: boolean;     // pad HH:MM:SS to 2 digits
    soonMinutes: number;        // add .cdw-soon when <= this (0 = off)

    // debug
    debug: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
    columnMap: {},
    headerMarker: "⏳|⌛",
    headerPattern: "\\[cd:([wdhms]+)\\]",
    defaultUnits: "dhms",

    enableMarkdown: true,
    enableProperties: true,
    enableBases: true,
    tickMs: 1000,

    showUnitLabels: true,
    padClockUnits: true,
    soonMinutes: 0,

    debug: false,
};

export class CountdownSettingsTab extends PluginSettingTab {
    plugin: any;
    constructor(app: App, plugin: any) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        const s = this.plugin.settings as Settings;

        containerEl.empty();
        containerEl.createEl("h3", { text: "Countdown (Markdown + Properties + Bases)" });

        new Setting(containerEl)
            .setName("Enable Markdown block")
            .addToggle(t => t.setValue(s.enableMarkdown).onChange(async v => {
                s.enableMarkdown = v; await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
            .setName("Enable Properties")
            .addToggle(t => t.setValue(s.enableProperties).onChange(async v => {
                s.enableProperties = v; await this.plugin.saveSettings(); this.plugin.restartObservers();
            }));

        new Setting(containerEl)
            .setName("Enable Bases")
            .addToggle(t => t.setValue(s.enableBases).onChange(async v => {
                s.enableBases = v; await this.plugin.saveSettings(); this.plugin.restartObservers();
            }));

        new Setting(containerEl)
            .setName("Default units when using hourglass marker")
            .setDesc("e.g. dhms or wdhms")
            .addText(t => t.setValue(s.defaultUnits).onChange(async v => {
                s.defaultUnits = v || "dhms"; await this.plugin.saveSettings(); this.plugin.recompileDetectors();
            }));

        new Setting(containerEl)
            .setName("Hourglass markers")
            .setDesc("If present anywhere in the header, render as countdown. Separate with |. Default: ⏳|⌛")
            .addText(t => t.setValue(s.headerMarker).onChange(async v => {
                s.headerMarker = v; await this.plugin.saveSettings(); this.plugin.recompileDetectors();
            }));

        new Setting(containerEl)
            .setName("Header pattern")
            .setDesc("Regex with capture group for units, e.g. \\[cd:([wdhms]+)\\]")
            .addText(t => t.setValue(s.headerPattern).onChange(async v => {
                s.headerPattern = v; await this.plugin.saveSettings(); this.plugin.recompileDetectors();
            }));

        new Setting(containerEl)
            .setName("Tick interval (ms)")
            .setDesc("How often counters update (1000 = once/second)")
            .addText(t => t.setValue(String(s.tickMs)).onChange(async v => {
                const n = Math.max(200, Number(v) || 1000);
                s.tickMs = n; await this.plugin.saveSettings(); this.plugin.restartObservers();
            }));

        new Setting(containerEl)
            .setName("Show unit labels (d h m s)")
            .addToggle(t => t.setValue(s.showUnitLabels).onChange(async v => {
                s.showUnitLabels = v; await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
            .setName("Pad HH:MM:SS")
            .addToggle(t => t.setValue(s.padClockUnits).onChange(async v => {
                s.padClockUnits = v; await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
            .setName("Soon threshold (minutes)")
            .setDesc("Apply .cdw-soon when time remaining ≤ this. 0 = disabled.")
            .addText(t => t.setValue(String(s.soonMinutes)).onChange(async v => {
                s.soonMinutes = Math.max(0, Number(v) || 0); await this.plugin.saveSettings();
            }));

        containerEl.createEl("h4", { text: "Explicit column map (JSON)" });
        const hint = containerEl.createEl("div", { text: 'Map header → units (case-insensitive). Example: { "Release Date": "dhms" }' });
        hint.addClass("setting-item-description");

        const ta = containerEl.createEl("textarea");
        ta.style.width = "100%";
        ta.style.minHeight = "140px";
        ta.value = JSON.stringify(s.columnMap, null, 2);
        ta.addEventListener("change", async () => {
            try {
                const parsed = JSON.parse(ta.value) as Record<string, string>;
                s.columnMap = parsed;
                await this.plugin.saveSettings();
                ta.classList.remove("mod-warning");
            } catch {
                ta.classList.add("mod-warning");
            }
        });

        containerEl.createEl("h4", { text: "Debug" });
        new Setting(containerEl)
            .setName("Console debug")
            .addToggle(t => t.setValue(s.debug).onChange(async v => {
                s.debug = v; await this.plugin.saveSettings();
            }));
    }
}
