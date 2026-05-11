# FLUTGRABEN Typeface Generator

A browser-based tool for generating typefaces using the halftone screen principle. Characters are built from atomic dot patterns whose density and size vary according to an underlying bilinear gradient — producing shapes that dissolve at their edges like spray paint or halftone ink.

Built with HTML, CSS, and vanilla JavaScript. No build step, no dependencies to install.

---

## Getting started

Because the tool fetches local JSON files, it must be served over HTTP — opening `index.html` directly as a `file://` URL will not work.

**Option 1 — Python (built-in):**
```bash
python -m http.server
```
Then open `http://localhost:8000` in your browser.

**Option 2 — Any static server** (VS Code Live Server, Caddy, nginx, GitHub Pages, Vercel, etc.)

---

## Input modes

**Image mode** — drag and drop or select any image file (PNG, JPG, WebP, or self-contained SVG). The image is converted to a binary mask: dark areas become the region where dots are generated.
- Images larger than 2000 px are scaled down automatically
- SVG files must have explicit `width` and `height` attributes

**Text mode** — type up to 20 characters. The text is rendered in DINish Bold and used as the dot region.

---

## Controls

### Basic settings

| Control | Description |
|---------|-------------|
| **Shape** | Dot shape: circle, square, pentagon, octagon, flat bar, cross |
| **Color** | Fill color for all dots |
| **Opacity** | Toggle per-dot opacity modulated by gradient brightness |
| **Mesh** | Bilinear gradient grid density — 0 = solid black (no gradient), 1–4 = checkerboard interpolation |
| **Size pregeneration** | Scales both dot radius and grid spacing together (affects density) |
| **Size postgeneration** | Scales dot radius only, without changing grid spacing |
| **Hazard** | Probabilistic filter — lower values drop more dots randomly |

### Halo settings

A second independent layer of dots generated in the blurred edge zone around the shape.

| Control | Description |
|---------|-------------|
| **Mesh** | Gradient density for the halo layer |
| **Halo** | Gaussian blur radius — controls the width of the halo zone |
| **Hazard** | Dot density filter for the halo layer |
| **Size pregeneration / postgeneration** | Same as basic settings, applied to halo dots only |

### Advanced settings

| Control | Description |
|---------|-------------|
| **Outline** | Overlay showing the DINish reference letter outlines |
| **Tracking** | Overlay showing sidebearing zones; slider adjusts letter spacing |
| **Keep shapes separate on export** | Skips boolean union — each dot is exported as an individual path instead of a merged outline |

### Charset export

Select which Unicode blocks to include in the OTF/WOFF export:

- Basic Latin (A–Z, a–z, digits, punctuation)
- West Europe (fr, es, pt, de, ch, it, cy, nl)
- North Europe (se, dk, fi, no, is, fo)
- East Europe (pl, cz, sk, ee, lv, lt, hu, ro, si, hr)
- Cyrillic (bg, ru, uk, sr, by, mk)
- Mongolian
- Turkish + Maltese
- Extended punctuation
- Esperanto
- Transliteration
- Pinyin

---

## Export formats

| Format | Description |
|--------|-------------|
| **SVG** | Full vector output — natively editable in Inkscape, Figma, Illustrator |
| **PNG** | Raster export at 4× resolution |
| **OTF** | OpenType font file — all selected characters at current settings |
| **WOFF** | Web font format — compressed OTF for use in CSS |

OTF/WOFF exports use boolean union (via Clipper.js) to merge overlapping dots into a single outline per glyph. Disable this in Advanced settings if you need individual paths.

Font naming: each export is identified by its parameters, e.g. `FLUTGRABEN Ci M0 T1.00 S1.00 H0.50`.

---

## Randomizer

**Flop it!** — randomizes all parameters and picks a random shape and color.

---

## Browser requirements

- Modern browser with Canvas API, `CompressionStream`, and `fetch` support
- Chrome / Firefox / Edge (recent versions)
- WOFF export requires `CompressionStream` (Chrome 80+, Firefox 113+, Safari 16.4+)

---

## Dependencies

All loaded from CDN — no installation needed.

| Library | Version | Purpose |
|---------|---------|---------|
| [opentype.js](https://github.com/opentypejs/opentype.js) | 1.3.4 | OTF/WOFF font building |
| [Clipper.js](https://github.com/nicktindall/cyclon.p2p-rtc-client) | 6.4.2 | Boolean union of dot polygons |

---

## Reference typeface

Glyph metrics are derived from [DINish Bold](https://github.com/playbeing/dinish), an open-source revival of DIN 1451. DINish is licensed under the SIL Open Font License 1.1.

---

## Credits

Zoé Berthelot · 2026
