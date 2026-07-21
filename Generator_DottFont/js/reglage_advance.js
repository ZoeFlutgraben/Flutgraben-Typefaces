// ============================================================
// reglage_advance.js — Advanced typographic overlay controls
//
// Adds two visual overlays to the output SVG:
//   - outline  : vector contour of the DINish Bold letterforms
//   - approches: left/right sidebearing zones per glyph
//
// Also provides a tracking (letter-spacing) slider that feeds back into
// the canvas text mask so that dot positions reflect the new spacing.
//
// Depends on globals from script-generator_DottFont.js:
//   FONT_SIZE, PADDING, ctx, outputSvg, currentText, lastCanvasW, lastCanvasH,
//   generate, generateAllDots, generateContourOnly, generateTextOnly, bindSpanEdit
// ============================================================

// Loaded DINish Bold and BoldItalic fonts (opentype.Font instances), null until async load completes
let dinishFont       = null;
let dinishFontItalic = null;

opentype.load('DINish/DINish-Bold.woff', function(err, font) {
  if (!err) dinishFont = font;
});

opentype.load('DINish/DINish-BoldItalic.woff', function(err, font) {
  if (!err) dinishFontItalic = font;
});

// Returns the active opentype font based on the italic checkbox state
function getActiveFont() {
  const isItalic = document.getElementById('adv-italique')?.checked;
  return (isItalic && dinishFontItalic) ? dinishFontItalic : dinishFont;
}

// Overlay toggle state
let showOutline   = false;
let showApproches = false;

// When true, export-otf.js skips Clipper boolean union and uses direct Bezier paths instead.
// Exported as a global so export-otf.js can read it without a module system.
let skipUnion = false;

// When true, the SVG export button uses Clipper boolean union to merge all dots
// (main layer + halo) into a single optimised <path> instead of serialising the DOM.
let unionSvg = false;

// Additional letter-spacing added to each inter-glyph gap, in canvas pixels (default 0)
let letterSpacingPx = 0;

// Measures typographic line positions in canvas pixel space.
// Uses ctx.measureText with textBaseline='top' — same setup as renderTextMask().
// With textBaseline='top', the reference is the em-square top (canvas y = PADDING).
//   actualBoundingBoxDescent  → positive (below reference) → PADDING + value = canvas y
//   actualBoundingBoxAscent   → negative (glyph sits below ref) → PADDING - value = canvas y
function computeMetricYPositions() {
  const isItalic = document.getElementById('adv-italique')?.checked;
  ctx.font       = `${isItalic ? 'italic ' : ''}700 ${FONT_SIZE}px DINish, sans-serif`;
  ctx.textBaseline = 'top';
  return {
    baselineY:  PADDING + ctx.measureText('A').actualBoundingBoxDescent,
    capHeightY: PADDING - ctx.measureText('H').actualBoundingBoxAscent,
    xHeightY:   PADDING - ctx.measureText('x').actualBoundingBoxAscent,
    descenderY: PADDING + ctx.measureText('g').actualBoundingBoxDescent,
  };
}

// Computes each glyph's rendered x position in canvas pixels.
// Applies the font's own kerning and the current letterSpacingPx (tracking),
// mirroring what ctx.fillText + ctx.letterSpacing produces.
//
// Position logic:
//   x[0] = PADDING
//   x[i] = x[i-1] + advPx[i-1] + letterSpacingPx + kern(i-1 → i)
//
// Returns an array of { glyph, x, advPx, kernPx, kernUnits }.
function computeGlyphPositions(glyphs) {
  const scale = FONT_SIZE / getActiveFont().unitsPerEm;
  let curX = PADDING;

  return glyphs.map((glyph, i) => {
    let kernPx = 0, kernUnits = 0;
    if (i > 0) {
      kernUnits = getActiveFont().getKerningValue(glyphs[i - 1], glyph);
      kernPx    = kernUnits * scale;
      curX     += kernPx;
    }
    const advPx = (glyph.advanceWidth || 0) * scale;

    // Proportional left-side shift: the fraction of tracking that goes to the left
    // sidebearing, computed from the original LSB/RSB ratio. The glyph body moves
    // right by extraLsb so it stays centered between the two expanded zones.
    let extraLsb = letterSpacingPx / 2;  // fallback: equal split
    try {
      const bb = glyph.getBoundingBox();
      if (bb && bb.x2 > bb.x1) {
        // Clamp to 0: italic glyphs can have negative LSB (ink overflows left of
        // the advance box). A negative LSB must not pull the glyph further left.
        const lsbPx = Math.max(0, bb.x1 * scale);
        const rsbPx = Math.max(0, ((glyph.advanceWidth || 0) - bb.x2) * scale);
        const total = lsbPx + rsbPx;
        if (total > 0) extraLsb = letterSpacingPx * (lsbPx / total);
      }
    } catch (e) {}

    const entry = { glyph, x: curX, advPx, kernPx, kernUnits, extraLsb };
    curX += advPx + letterSpacingPx;
    return entry;
  });
}

// Creates an SVG element in the SVG namespace with the given attribute map.
function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}


// Clears any existing #overlay group and rebuilds it from current toggle state.
// Called after every dot-generation pass and whenever a control changes.
function drawOverlay() {
  // Overlays are text-mode only — skip entirely when rendering an image
  if (inputMode !== 'text') {
    const existing = outputSvg.querySelector('#overlay');
    if (existing) existing.remove();
    return;
  }

  const w = lastCanvasW;
  const h = lastCanvasH;
  if (!w || !h) return;

  // Remove previous overlay
  const existing = outputSvg.querySelector('#overlay');
  if (existing) existing.remove();

  if (!showOutline && !showApproches) return;

  const overlay = svgEl('g', { id: 'overlay' });

  // Compute shared metric positions — used by multiple overlays
  const m = computeMetricYPositions();

  // --- Font-based overlays: outline, approches (require font to be loaded) ---
  if ((showOutline || showApproches) && getActiveFont() && currentText) {
    const glyphs    = getActiveFont().stringToGlyphs(currentText);
    const glyphData = computeGlyphPositions(glyphs);

    // Build per-glyph path commands. Each glyph is offset by (x + extraLsb)
    // to match the canvas rendering, where each character is shifted right
    // by its proportional left-sidebearing tracking share.
    let pathCmds = null;
    if (showOutline) {
      pathCmds = [];
      for (const { glyph, x, extraLsb } of glyphData) {
        pathCmds.push(...glyph.getPath(x + extraLsb, m.baselineY, FONT_SIZE).commands);
      }
    }

    // Outline — thin stroke of the vector contour, respecting kerning + tracking
    if (showOutline && pathCmds) {
      const pathData = pathCmds.map(c => {
        if (c.type === 'M') return `M${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
        if (c.type === 'L') return `L${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
        if (c.type === 'C') return `C${c.x1.toFixed(2)} ${c.y1.toFixed(2)} ${c.x2.toFixed(2)} ${c.y2.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
        if (c.type === 'Q') return `Q${c.x1.toFixed(2)} ${c.y1.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
        if (c.type === 'Z') return 'Z';
        return '';
      }).join(' ');

      const go = svgEl('g', { id: 'overlay-outline' });
      go.appendChild(svgEl('path', {
        d: pathData, fill: 'none',
        stroke: '#0055ff', 'stroke-width': 0.5, opacity: 0.5
      }));
      overlay.appendChild(go);
    }

    // Sidebearing (approches latérales) visualization.
    // Each glyph's advance box is split into three zones:
    //   [LSB zone — blue] [glyph body] [RSB zone — orange]
    //
    // When the tracking slider is non-zero, its pixel value is distributed
    // proportionally between LSB and RSB according to their original ratio,
    // so the balance between left and right approach is preserved.
    // Values shown in font design units (same units as Glyphs, FontLab, etc.).
    if (showApproches) {
      const scale  = FONT_SIZE / getActiveFont().unitsPerEm;
      const ga     = svgEl('g', { id: 'overlay-approches' });
      const zoneY  = m.capHeightY;
      const zoneH  = m.baselineY - m.capHeightY;
      // Labels sit below the baseline, outside the glyph zone
      const lblY   = (m.baselineY + 11).toFixed(1);

      for (let i = 0; i < glyphData.length; i++) {
        const d = glyphData[i];

        // getBoundingBox returns {x1, y1, x2, y2} in font units.
        // x1 = leftmost outline point = LSB; RSB = advanceWidth - x2.
        // Skip glyphs with no visible outline (space, etc.).
        let bb;
        try { bb = d.glyph.getBoundingBox(); } catch (e) { continue; }
        if (!bb || bb.x2 <= bb.x1) continue;

        const lsbUnits = bb.x1;
        const rsbUnits = (d.glyph.advanceWidth || 0) - bb.x2;
        // Clamp to 0: italic glyphs can have negative LSB (ink overflows left of
        // the advance box). A negative value must not invert the distribution ratio.
        const lsbPx    = Math.max(0, lsbUnits * scale);
        const rsbPx    = Math.max(0, rsbUnits * scale);

        // Proportional distribution of letter-spacing across left and right approaches.
        // Ratio is based on the original sidebearing sizes; if both are zero, split equally.
        const totalPx   = lsbPx + rsbPx;
        const lsbRatio  = totalPx > 0 ? lsbPx / totalPx : 0.5;
        const rsbRatio  = 1 - lsbRatio;
        const extraLsb  = letterSpacingPx * lsbRatio;
        const extraRsb  = letterSpacingPx * rsbRatio;

        // Displayed zone widths — original sidebearing + proportional tracking share
        const dispLsbPx = lsbPx + extraLsb;
        const dispRsbPx = rsbPx + extraRsb;
        // Displayed advance box = original advance + full tracking amount
        const dispAdvPx = d.advPx + letterSpacingPx;

        // Advance boundary line at glyph start
        ga.appendChild(svgEl('line', {
          x1: d.x.toFixed(1), y1: zoneY.toFixed(1),
          x2: d.x.toFixed(1), y2: m.baselineY.toFixed(1),
          stroke: '#999', 'stroke-width': 0.6, 'stroke-dasharray': '3 2', opacity: 0.55
        }));

        // Left sidebearing zone — purple rect (only when positive), label always shown
        const lsbVal = Math.round(dispLsbPx / scale);
        if (dispLsbPx > 0.5) {
          ga.appendChild(svgEl('rect', {
            x: d.x.toFixed(1), y: zoneY.toFixed(1),
            width: dispLsbPx.toFixed(1), height: zoneH.toFixed(1),
            fill: '#a887cfff', opacity: 0.3
          }));
        }
        {
          // Label centered on zone when positive, anchored at glyph edge when negative
          const lblX  = dispLsbPx > 0.5 ? (d.x + dispLsbPx / 2).toFixed(1) : d.x.toFixed(1);
          const lblClr = lsbVal < 0 ? '#ff3333' : '#a887cfff';
          const lbl = svgEl('text', {
            x: lblX, y: lblY, fill: lblClr, 'font-size': 4,
            'font-family': 'DINish, sans-serif', 'font-weight': 700,
            'text-anchor': 'middle', opacity: 1
          });
          lbl.textContent = lsbVal;
          ga.appendChild(lbl);
        }

        // Right sidebearing zone — green rect (only when positive), label always shown
        const rsbStartX = d.x + dispAdvPx - dispRsbPx;
        const rsbVal = Math.round(dispRsbPx / scale);
        if (dispRsbPx > 0.5) {
          ga.appendChild(svgEl('rect', {
            x: rsbStartX.toFixed(1), y: zoneY.toFixed(1),
            width: dispRsbPx.toFixed(1), height: zoneH.toFixed(1),
            fill: '#d87b68ff', opacity: 0.3
          }));
        }
        {
          // Label centered on zone when positive, anchored at advance edge when negative
          const lblX   = dispRsbPx > 0.5 ? (rsbStartX + dispRsbPx / 2).toFixed(1) : rsbStartX.toFixed(1);
          const lblClr = rsbVal < 0 ? '#ff3333' : '#d87b68ff';
          const lbl = svgEl('text', {
            x: lblX, y: lblY, fill: lblClr, 'font-size': 4,
            'font-family': 'DINish, sans-serif', 'font-weight': 700,
            'text-anchor': 'middle', opacity: 1
          });
          lbl.textContent = rsbVal;
          ga.appendChild(lbl);
        }

      }

      // Closing boundary line at the end of the last glyph's displayed advance
      const last = glyphData[glyphData.length - 1];
      const lastDispAdv = last.advPx + letterSpacingPx;
      ga.appendChild(svgEl('line', {
        x1: (last.x + lastDispAdv).toFixed(1), y1: zoneY.toFixed(1),
        x2: (last.x + lastDispAdv).toFixed(1), y2: m.baselineY.toFixed(1),
        stroke: '#878787', 'stroke-width': 0.5, 'stroke-dasharray': '3 2', opacity: 0.55
      }));

      overlay.appendChild(ga);
    }
  }

  // Append last so the overlay renders on top of all dots
  outputSvg.appendChild(overlay);
}

// Monkey-patch ctx.measureText and ctx.fillText to inject letterSpacingPx
// before every call on the hidden canvas context.
//
// Why: renderTextMask() resizes hiddenCanvas (hiddenCanvas.width = canvasW),
// which resets the entire 2D context state — including any previously set
// ctx.letterSpacing. Setting it once before generate() would be cleared by
// the resize. Patching at the method level ensures it is always active at
// draw time, regardless of how many resets happen in between.
//
// This only patches the specific ctx instance (hidden canvas), not the global
// CanvasRenderingContext2D prototype. Degrades silently if letterSpacing is
// not supported (pre-Chrome 99 / pre-Firefox 95).
if ('letterSpacing' in ctx) {
  const _origMeasureText = ctx.measureText.bind(ctx);
  const _origFillText    = ctx.fillText.bind(ctx);

  // Keep letterSpacing active for measureText so the canvas is sized correctly
  // (total advance = sum of advances + N × letterSpacingPx + kern adjustments).
  ctx.measureText = function(...args) {
    ctx.letterSpacing = `${letterSpacingPx}px`;
    return _origMeasureText(...args);
  };

  // Render each character individually at its proportionally shifted position
  // so that the glyph body sits between the expanded LSB and RSB zones.
  // Without this, ctx.letterSpacing would add all tracking space to the right,
  // leaving the glyph stuck at the left edge of its advance box.
  ctx.fillText = function(text, startX, startY, ...rest) {
    // No tracking or font not yet loaded: render normally
    if (letterSpacingPx === 0 || !getActiveFont()) {
      ctx.letterSpacing = '0px';
      return _origFillText(text, startX, startY, ...rest);
    }

    // Disable letterSpacing — we position each character manually
    ctx.letterSpacing = '0px';
    const activeFont = getActiveFont();
    const scale  = FONT_SIZE / activeFont.unitsPerEm;
    const chars  = [...text];  // spread to handle multi-codepoint chars correctly
    const glyphs = activeFont.stringToGlyphs(text);
    let curX = startX;

    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];

      // Apply kerning from previous glyph
      if (i > 0) {
        curX += activeFont.getKerningValue(glyphs[i - 1], glyph) * scale;
      }

      // Proportional left shift — same logic as computeGlyphPositions
      let extraLsb = letterSpacingPx / 2;
      try {
        const bb = glyph.getBoundingBox();
        if (bb && bb.x2 > bb.x1) {
          // Clamp to 0: italic glyphs can have negative LSB (ink overflows left of
          // the advance box). A negative value must not pull the glyph further left.
          const lsbPx = Math.max(0, bb.x1 * scale);
          const rsbPx = Math.max(0, ((glyph.advanceWidth || 0) - bb.x2) * scale);
          const total = lsbPx + rsbPx;
          if (total > 0) extraLsb = letterSpacingPx * (lsbPx / total);
        }
      } catch (e) {}

      _origFillText(chars[i], curX + extraLsb, startY, ...rest);
      curX += (glyph.advanceWidth || 0) * scale + letterSpacingPx;
    }
  };
}

// Wraps the three generation functions so the overlay is redrawn automatically
// after every dot render — without modifying script-generator_DottFont.js or offset.js.
// These are function declarations (global scope), so reassignment is safe.
const _origGenerateAllDots     = generateAllDots;
const _origGenerateContourOnly = generateContourOnly;
const _origGenerateTextOnly    = generateTextOnly;

generateAllDots     = function(w, h) { _origGenerateAllDots(w, h); drawOverlay(); };
generateContourOnly = function()     { _origGenerateContourOnly();  drawOverlay(); };
generateTextOnly    = function()     { _origGenerateTextOnly();     drawOverlay(); };

// --- Overlay toggle checkboxes ---
document.getElementById('adv-show-outline' ).addEventListener('change', e => { showOutline   = e.target.checked; drawOverlay(); });
document.getElementById('adv-show-approches').addEventListener('change', e => { showApproches = e.target.checked; drawOverlay(); });
document.getElementById('adv-no-union'      ).addEventListener('change', e => { skipUnion     = e.target.checked; });
document.getElementById('adv-union-svg'     ).addEventListener('change', e => { unionSvg      = e.target.checked; });

// --- Tracking (letter-spacing) slider ---
// Writes letterSpacingPx to the canvas context and triggers a full re-render
// so dot positions reflect the new inter-glyph spacing.
const trackingSlider = document.getElementById('adv-tracking-slider');
const trackingValue  = document.getElementById('adv-tracking-value');

trackingSlider.addEventListener('input', () => {
  letterSpacingPx = +trackingSlider.value;
  trackingValue.textContent = letterSpacingPx;
  // Full pipeline re-render: text mask must be redrawn with new spacing.
  // letterSpacingPx is picked up automatically by the patched ctx.measureText
  // and ctx.fillText, so no manual ctx.letterSpacing call is needed here.
  if (lastCanvasW > 0) generate();
});

// Narrow-viewport span editing — matches the pattern used by the other sliders
bindSpanEdit(trackingValue, trackingSlider, true, v => {
  letterSpacingPx = v;
  if (lastCanvasW > 0) generate();
});
