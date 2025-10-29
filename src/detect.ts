import type { App } from "obsidian";
import { parseShow, type Unit } from "./units";

export function esc(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compileHeaderPattern(pattern: string | undefined): RegExp | null {
    if (!pattern) return null;
    try {
        return new RegExp(pattern, "i");
    } catch {
        return null;
    }
}

export function compileMarkerRegex(markers: string | undefined): RegExp | null {
    if (!markers) return null;
    const parts = markers.split("|").map(esc).filter(Boolean);
    if (!parts.length) return null;
    return new RegExp(`(${parts.join("|")})`, "i");
}

/** Find a stable property key from a host node (label-hidden-safe) */
export function findHeaderTextForCell(el: HTMLElement): string | null {
    const clean = (s: string | null | undefined) => (s ?? "").trim() || null;

    const prop = el.closest<HTMLElement>(".metadata-property[data-property-key]");
    if (prop) return clean(prop.getAttribute("data-property-key"));  // e.g. "due⏳"

    const td = el.closest<HTMLElement>(".bases-td[data-property]");
    if (td) return clean(td.getAttribute("data-property"));          // e.g. "note.due⏳"

    const cardProp = el.closest<HTMLElement>(".bases-cards-property[data-property]");
    if (cardProp) return clean(cardProp.getAttribute("data-property")); // e.g. "note.due⏳"

    return null;
}

/** Decide units using explicit map → [cd:...] pattern → hourglass markers */
export function decideUnits(
    header: string,
    columnMap: Record<string, string>,
    patternRe: RegExp | null,
    markerRe: RegExp | null,
    defaultUnits: string
): Unit[] | null {
    // 1) explicit map (case-insensitive)
    for (const col in columnMap) {
        if (header.trim().toLowerCase() === col.trim().toLowerCase()) {
            return parseShow(columnMap[col]);
        }
    }
    // 2) header tag pattern e.g. "Birthday [cd:wdhms]"
    if (patternRe) {
        const m = header.match(patternRe);
        if (m && m[1]) return parseShow(m[1]);
    }
    // 3) hourglass marker anywhere in the header
    if (markerRe?.test(header)) return parseShow(defaultUnits);

    return null;
}
