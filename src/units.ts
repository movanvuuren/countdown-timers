export type Unit = "w" | "d" | "h" | "m" | "s";

export const UNIT_MS: Record<Unit, number> = {
    w: 7 * 24 * 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000,
};

export const pad2 = (n: number) => String(n).padStart(2, "0");

export function parseShow(spec?: string): Unit[] {
    const fallback: Unit[] = ["d", "h", "m", "s"];
    if (!spec) return fallback;
    const out: Unit[] = [];
    for (const ch of spec.toLowerCase()) {
        if ("wdhms".includes(ch) && !out.includes(ch as Unit)) out.push(ch as Unit);
    }
    return out.length ? out : fallback;
}

export function splitUnits(msIn: number, units: Unit[]) {
    let ms = Math.max(0, msIn);
    const out: Record<Unit, number> = { w: 0, d: 0, h: 0, m: 0, s: 0 };
    units.forEach((u, i) => {
        const last = i === units.length - 1;
        out[u] = Math.floor(ms / UNIT_MS[u]);
        if (!last) ms -= out[u] * UNIT_MS[u];
    });
    return out;
}
