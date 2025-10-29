export const CSS = `
/* Resolve theme tokens at the component level */
.cdw {
  --cdw-accent: var(--text-accent, var(--color-accent, var(--interactive-accent, currentColor)));
  --cdw-bg: var(--background-secondary, var(--background-primary));
  --cdw-border: var(--background-modifier-border, rgba(127,127,127,.35));
  --cdw-muted: var(--text-muted, var(--text-normal));
}

/* Markdown card grid */
.cdw.cdk-grid {
  display: grid;
  /* NEW: slightly narrower cards */
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: .6rem;            /* was .75rem */
  padding: .2rem;        /* was .25rem */
  align-items: stretch;
}
.cdw-title {
  grid-column: 1 / -1;
  font-weight: 600;
  color: var(--cdw-muted);
  margin-bottom: .2rem;  /* was .25rem */
}
.cdw-card {
  border: 1px solid var(--cdw-border);
  background: var(--cdw-bg);
  border-radius: .55rem; /* was .6rem */
  padding: .6rem .45rem; /* was .75rem .5rem */
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.cdw-value {
  font-size: clamp(1.45rem, 4vw, 2.2rem); /* slightly smaller */
  line-height: 1;
  font-weight: 700;
  color: var(--cdw-accent);
  margin-bottom: .3rem;  /* was .35rem */
}
.cdw-cap { font-size: .78rem; color: var(--cdw-muted); }

/* Inline */
.cdw.cdw-inline {
  display: inline-flex; gap: .2rem; align-items: baseline;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.cdw-piece { font-weight: 600; color: var(--cdw-accent); }
.cdw-unit { opacity: .75; font-size: .9em; margin-left: .1rem; }
.cdw-sep { opacity: .4; }
.cdw.cdw-complete { opacity: .7; }

/* Hide editors when not focused */
.metadata-property-value.cdw-has-countdown:not(:focus-within) .metadata-input-longtext,
.metadata-property-value.cdw-has-countdown:not(:focus-within) .metadata-link,
.metadata-property-value.cdw-has-countdown:not(:focus-within) input.mod-date,
.metadata-property-value.cdw-has-countdown:not(:focus-within) input.mod-datetime { display: none; }

/* Bases cards spacing */
.bases-card .bases-card-field-value .cdw.cdw-inline,
.bases-cards-property .bases-cards-line .cdw.cdw-inline { gap: .2rem; }

/* Hide the native date editor in Bases **cards** when a countdown is present */
.bases-cards-property .bases-cards-line.cdw-has-countdown input.mod-date,
.bases-cards-property .bases-cards-line.cdw-has-countdown input.mod-datetime,
.bases-cards-property .bases-cards-line.cdw-has-countdown .metadata-link,
.bases-cards-property .bases-cards-line.cdw-has-countdown .metadata-input {
  display: none !important;
}

/* States (grid + inline) — keep your existing soon/due rules if you like */
.cdw.cdk-grid.cdw-soon .cdw-value { color: #d33; }
.cdw.cdk-grid.cdw-due  .cdw-value { color: var(--background-modifier-error, #d33); }

/* Optional states */
.cdw.cdw-soon .cdw-piece.cdw-piece { color: #d33; }
.cdw.cdw-due  .cdw-piece.cdw-piece { color: var(--background-modifier-error, #d33); }

@media (prefers-reduced-motion: reduce) {
  .cdw, .cdw * { transition: none !important; animation: none !important; }
}
`;



let styleEl: HTMLStyleElement | null = null;

export function ensureStyles() {
    if (styleEl) return;
    const el = document.createElement("style");
    el.id = "cdw-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
    styleEl = el;
}

export function removeStyles() {
    if (styleEl) {
        styleEl.remove();
        styleEl = null;
    }
}
