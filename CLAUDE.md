# Project Context

This is the **Flutgraben** web frontend project — an open-source display typeface and visual identity system built with HTML, CSS, and vanilla JavaScript.

## About Flutgraben

Flutgraben is designing its own display typeface to be used across its website and visual identity.

The typeface is built from atomic circular elements — dots and spots — whose edges dissolve outward like spray paint or halftone ink, giving characters a quality of reaching beyond their own boundaries.

The construction logic is geometric and modular, influenced by Bauhaus/Futura principles, but the visual result is organic and material.

The concept carries a deeper meaning: characters lean toward each other across whitespace, suggesting network, connection, and trans-individuality — rather than isolated, self-contained forms.

The visual identity includes a **grainy gradient generator** built as a creative tool to develop and explore identity assets — combining atomic dot patterns, scattered halos, and pixel grain to produce textures consistent with the typeface's aesthetic.

## Coding Standards

### Comments
- **All comments must be written in English**, without exception
- Every function must have a comment explaining what it does
- Comment complex logic inline — explain *why*, not just *what*
- Use clear, concise language written for the next developer

```js
// Good example
// Scatters micro-dots around a central point to simulate spray paint bleed
function scatterDots(cx, cy, radius, count) { ... }
```

### HTML
- Use semantic tags (`<header>`, `<main>`, `<section>`, `<article>`, `<footer>`)
- Add comments to delimit major sections

```html
<!-- ===================== HEADER ===================== -->
<header>...</header>

<!-- ===================== CANVAS GENERATOR ===================== -->
<main>...</main>
```

### CSS
- Comment each major section
- Group related properties (layout, typography, colors)

```css
/* === Canvas container === */
.canvas-wrap { ... }

/* === Control panel === */
.controls { ... }
```

### JavaScript
- Comment every function (purpose, parameters, return value if relevant)
- Comment non-obvious logic, especially math related to rendering, grain, or geometry
- Use `const` by default, `let` only when reassignment is needed, never `var`

## General Rules

- Keep files focused — one responsibility per file when possible
- Prefer readability over cleverness
- Ask before making structural or architectural changes
- The visual output should always feel consistent with the Flutgraben aesthetic: atomic, grainy, organic-yet-geometric