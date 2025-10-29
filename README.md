# ⏳ Countdown for Obsidian

Turn dates in your notes, Properties, and Bases tables/cards into live countdowns.
- Works in **Markdown**, **Properties**, and **Bases** (tables/cards).
- Updates every second.
- Click or press Enter/Space to edit — native editors stay hidden only when not focused.
---

## ✨ Features
- **Markdown countdown block**
    ` ```countdown key [label=Title] [show=dhms] ``` `
    Renders a grid of cards counting down to a frontmatter date.
    
- **Properties & Bases support**
    - Add ⏳ or ⌛ to a property or column name:  
        `due ⏳`, `launch ⌛`
    - Or use a header tag for custom units:  
        `Birthday [cd:wdhms]`
    - Or define mappings in Settings → _Explicit column map_:  
        `{ "Release Date": "dhms", "ETA": "dhs" }`
        
- **Works in all views:**  
    Reading view, Properties editor, Bases tables, and card views (even with hidden labels).
- **Formats:** weeks (`w`), days (`d`), hours (`h`), minutes (`m`), seconds (`s`).
- **Parsing:** Uses Obsidian’s moment.js if available; otherwise JS Date.

---

## 🧰 Installation

1. Copy this plugin’s files into a new community plugin folder and build (`main.ts → dist/main.js`).
2. Enable under **Settings → Community Plugins**.
3. _(Optional)_ Add the CSS snippet below to your snippets and enable it.
    

---

## 🧪 Usage

### A) Markdown block (frontmatter-based)

In frontmatter:

`--- title: My Event due: 2025-11-15 10:00 launch: 2025-12-10 ---`

In note body:

` ```countdown due label="Event starts" show=dhms ``` `

### B) Properties & Bases

- Add ⏳ or ⌛ to the property/column name:  
    `due ⏳`, `launch ⌛`
- Or use `[cd:wdhms]` tag:  
    `Birthday [cd:wdhms]`
- Or define mappings in Settings → Explicit column map.

**Cards:**  
Even if `.bases-cards-label` is hidden via CSS, the plugin reads the `data-property` attribute to detect fields.

---

## ⚙️ Settings

|Setting|Description|Default|
|---|---|---|
|**Header marker(s)**|Symbols that trigger countdown (e.g. `⏳|⌛`)|
|**Header pattern**|Regex to extract units, e.g. `[cd:([wdhms]+)]`|`\[cd:([wdhms]+)\]`|
|**Explicit column map**|JSON map of column → units|`{}`|

---

## 🖼️ Display & Editing
- Inserts an inline countdown next to the date.
- Editors (text/date inputs) are hidden **only when not focused**.
- Click or press Enter/Space to edit the field.
- Markdown blocks show a grid of cards.

---

## 🧯 Troubleshooting
- **Shows raw date:** Add ⏳/⌛, or `[cd:…]`, or map in settings.
- **Doesn’t update:** Ensure value updates `datetime`, `value`, or `data-property-longtext-value`.
- **Can’t edit:** Click or press Enter/Space.
- **Duplicate countdowns:** Don’t decorate both property container and inner line.
