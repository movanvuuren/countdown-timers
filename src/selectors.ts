export const ROOTS = [
    ".metadata-container",                                   // reading-view properties block
    ".workspace-leaf-content[data-type='file-properties']",  // file properties pane
    ".bases-view",                                           // Bases tables & cards
].join(", ");

export const CANDIDATES = [
    // Properties (reading-view & file-properties)
    ".metadata-property[data-property-key] > .metadata-property-value",

    // Bases TABLE: value cell inside column cell
    ".bases-td[data-property] > .bases-table-cell.bases-metadata-value",

    // Bases CARDS: decorate the rendered value line so we survive reflows/virtualization
    ".bases-cards-item .bases-cards-property[data-property] .bases-cards-line",
].join(",");
