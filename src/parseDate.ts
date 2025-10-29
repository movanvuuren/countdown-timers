import type { App } from "obsidian";

/** moment() if available, else Date() */
export function parseDateLike(v: any): number | null {
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

/** Try multiple DOM sources to find a date-ish value */
export function extractDateText(host: HTMLElement): string {
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

    // Cards: value line attributes if present
    const line = host.closest(".bases-cards-property")?.querySelector(".bases-cards-line") as HTMLElement | null;
    if (line) {
        const dv = line.getAttribute("data-raw") || line.getAttribute("data-value");
        if (dv && dv.trim()) return dv.trim();
    }

    const rawAttr = host.getAttribute("data-raw");
    if (rawAttr) return rawAttr.trim();

    return (host.textContent || "").trim();
}

/** Clean Bases/property header to match frontmatter key */
export function normalizePropKeyForFM(header: string): string {
    return (header || "")
        .replace(/^(note|file|prop)\./i, "")   // strip Bases prefixes
        .replace(/[⏳⌛]/g, "")                 // drop hourglass glyphs
        .replace(/\[cd:[wdhms]+\]/ig, "")      // drop inline unit tags
        .trim();
}

/** Utility to focus the first editor in a container */
export function focusFirstEditorIn(cell: HTMLElement) {
    const editor =
        cell.querySelector<HTMLInputElement>("input.mod-date, input.mod-datetime") ||
        cell.querySelector<HTMLElement>(".metadata-input-longtext");
    if (editor instanceof HTMLInputElement) {
        editor.style.display = "";
        editor.focus();
        editor.select?.();
    } else if (editor) {
        (editor as HTMLElement).style.display = "";
        (editor as HTMLElement).focus();
    }
}

/** Bases card helpers */
export function getCardFileBasename(cardEl: HTMLElement): string | null {
    const titleLine = cardEl.querySelector<HTMLElement>(".bases-cards-property.mod-title .bases-cards-line");
    const name = titleLine?.textContent?.trim();
    return name || null; // this is file.name (basename)
}

export function findTFileByBasename(app: App, basename: string) {
    const files = app.vault.getFiles();
    return files.find(f => f.basename === basename) || null;
}
