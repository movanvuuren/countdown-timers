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
  .addToggle(t => t
    .setValue(s.enableMarkdown)
    .onChange(v => this.plugin.updateSettings({ enableMarkdown: v }))
  );

new Setting(containerEl)
  .setName("Enable Properties")
  .addToggle(t => t
    .setValue(s.enableProperties)
    .onChange(v => this.plugin.updateSettings({ enableProperties: v }))
  );

new Setting(containerEl)
  .setName("Enable Bases")
  .addToggle(t => t
    .setValue(s.enableBases)
    .onChange(v => this.plugin.updateSettings({ enableBases: v }))
  );

new Setting(containerEl)
  .setName("Default units when using hourglass marker")
  .setDesc("e.g. dhms or wdhms")
  .addText(t => t
    .setValue(s.defaultUnits)
    .onChange(v => this.plugin.updateSettings({ defaultUnits: v || "dhms" }))
  );

new Setting(containerEl)
  .setName("Hourglass markers")
  .setDesc("Separate with |. Default: ⏳|⌛")
  .addText(t => t
    .setValue(s.headerMarker)
    .onChange(v => this.plugin.updateSettings({ headerMarker: v }))
  );

new Setting(containerEl)
  .setName("Header pattern")
  .setDesc("Regex with capture group for units, e.g. \\[cd:([wdhms]+)\\]")
  .addText(t => t
    .setValue(s.headerPattern)
    .onChange(v => this.plugin.updateSettings({ headerPattern: v }))
  );

new Setting(containerEl)
  .setName("Tick interval (ms)")
  .setDesc("1000 = once per second (min 200)")
  .addText(t => t
    .setValue(String(s.tickMs))
    .onChange(v => {
      const n = Math.max(200, Number(v) || 1000);
      this.plugin.updateSettings({ tickMs: n });
    })
  );

new Setting(containerEl)
  .setName("Show unit labels (d h m s)")
  .addToggle(t => t
    .setValue(s.showUnitLabels)
    .onChange(v => this.plugin.updateSettings({ showUnitLabels: v }))
  );

new Setting(containerEl)
  .setName("Pad HH:MM:SS")
  .addToggle(t => t
    .setValue(s.padClockUnits)
    .onChange(v => this.plugin.updateSettings({ padClockUnits: v }))
  );

new Setting(containerEl)
  .setName("Soon threshold (minutes)")
  .setDesc("Apply .cdw-soon when remaining ≤ this (0 = off)")
  .addText(t => t
    .setValue(String(s.soonMinutes))
    .onChange(v => this.plugin.updateSettings({ soonMinutes: Math.max(0, Number(v) || 0) }))
  );

containerEl.createEl("h4", { text: "Explicit column map (JSON)" });
const ta = containerEl.createEl("textarea");
ta.style.width = "100%";
ta.style.minHeight = "140px";
ta.value = JSON.stringify(s.columnMap, null, 2);
ta.addEventListener("change", () => {
  try {
    const parsed = JSON.parse(ta.value) as Record<string, string>;
    this.plugin.updateSettings({ columnMap: parsed });
    ta.classList.remove("mod-warning");
  } catch {
    ta.classList.add("mod-warning");
  }
});

new Setting(containerEl)
  .setName("Console debug")
  .addToggle(t => t
    .setValue(s.debug)
    .onChange(v => this.plugin.updateSettings({ debug: v }))
  );

    }
}
