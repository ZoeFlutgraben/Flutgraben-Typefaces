// ============================================================
// Offset panel — independent contour controls
//
// Manages the halo zone (outset) dots separately from main dots.
// Reads blurData and maskData computed by renderTextMask() in
// script-generator_DottFont.js (shared global scope).
//
// Exposed globals used by script-generator_DottFont.js:
//   outsetRadius, generateContourSVGString()
// ============================================================

const contourMeshSlider      = document.getElementById('contour-mesh-slider');
const contourMeshValue       = document.getElementById('contour-mesh-value');
const outsetSlider           = document.getElementById('outset-slider');
const outsetValue            = document.getElementById('outset-value');
const contourHazardSlider    = document.getElementById('contour-hazard-slider');
const contourHazardValue     = document.getElementById('contour-hazard-value');
const contourTailleGenSlider = document.getElementById('contour-taille-generation-slider');
const contourTailleGenValue  = document.getElementById('contour-taille-generation-value');
const contourSizeSlider      = document.getElementById('contour-size-slider');
const contourSizeValue       = document.getElementById('contour-size-value');

// Contour mesh size — 0 = solid (blur-only), 1–4 = bilinear checkerboard modulating presence
let contourMeshSize = parseInt(contourMeshSlider.value, 10);

// Outset radius — Gaussian blur radius defining the halo zone width
let outsetRadius = parseInt(outsetSlider.value, 10);

// Contour presence strength — 0 = all dots present, 1 = only darkest survive
let contourPresenceStrength = parseFloat(contourHazardSlider.value);

// Contour taille-generation — scales dot spacing AND radius together for contour dots
let contourTailleGenerationMultiplier = parseFloat(contourTailleGenSlider.value);

// Contour size multiplier — scales dot radius only for contour dots
let contourSizeMultiplier = parseFloat(contourSizeSlider.value);

// Debounce timer for contour sliders
let contourSliderDebounceTimer;

// Master toggle — halo is active by default; checkbox disables it when checked
let haloEnabled = true;

// Samples blurData for pixels in the halo zone (outside text, inside Gaussian blur)
// and returns an SVG markup string of native shape elements.
// Near the text edge: blur is dark → larger dots.
// Far from edge: blur is light → smaller, sparser dots.
// Parameters:
//   canvasW/H — canvas dimensions matching the hidden canvas
//   blurData  — ImageData from the Gaussian-blurred text mask
function generateContourSVGString(canvasW, canvasH, blurData) {
  if (!haloEnabled || !blurData || outsetRadius === 0) return '';

  // Read the current text mask from the hidden canvas (set by renderTextMask)
  const maskData = ctx.getImageData(0, 0, canvasW, canvasH);
  let svgStr = '';

  // Grid step scales with contour taille-generation multiplier
  const step = DOT_SPACING * contourTailleGenerationMultiplier;

  for (let y = step / 2; y < canvasH; y += step) {
    for (let x = step / 2; x < canvasW; x += step) {
      const i = (Math.floor(y) * canvasW + Math.floor(x)) * 4;
      const maskBrightness = (maskData.data[i] + maskData.data[i+1] + maskData.data[i+2]) / 3;

      // Skip pixels inside the text — contour only covers the halo zone
      if (maskBrightness < THRESHOLD) continue;

      const blurBrightness = (blurData.data[i] + blurData.data[i+1] + blurData.data[i+2]) / 3;

      // Skip pixels outside the halo zone
      if (blurBrightness >= THRESHOLD) continue;

      // Map blur brightness (0=near edge → dark, ~240=far edge → light)
      // to gray range 120–200: darker = larger dots, lighter = smaller dots
      const gray = Math.round(120 + (blurBrightness / THRESHOLD) * 80);

      // Probabilistic presence filter.
      // contourMeshSize=0 → blur-based gray drives probability (uniform density)
      // contourMeshSize>0 → bilinear checkerboard value drives probability (same pattern as main panel)
      let probability;
      if (contourMeshSize === 0) {
        probability = Math.max(0, 1 - (gray / 204) * contourPresenceStrength * 2);
      } else {
        // Bilinear interpolation of checkerboard: (r+c) even → 204, odd → 0
        const gx = (x / canvasW) * contourMeshSize;
        const gy = (y / canvasH) * contourMeshSize;
        const c0 = Math.min(Math.floor(gx), contourMeshSize - 1);
        const r0 = Math.min(Math.floor(gy), contourMeshSize - 1);
        const tx = gx - c0;
        const ty = gy - r0;
        const cv = (r, c) => (r + c) % 2 === 0 ? 204 : 0;
        const meshValue = Math.round(
          cv(r0,     c0)     * (1 - tx) * (1 - ty) +
          cv(r0,     c0 + 1) * tx       * (1 - ty) +
          cv(r0 + 1, c0)     * (1 - tx) * ty       +
          cv(r0 + 1, c0 + 1) * tx       * ty
        );
        probability = Math.max(0, 1 - (meshValue / 204) * contourPresenceStrength * 2);
      }
      if (Math.random() > probability) continue;

      // Map gray (120–200) to dot radius with contour-specific size multipliers
      const darkness = Math.max(0, 1 - gray / 204);
      const radius   = (MIN_RADIUS + darkness * (MAX_RADIUS - MIN_RADIUS)) * contourSizeMultiplier * contourTailleGenerationMultiplier;

      svgStr += shapeDotSVG(x, y, radius);
    }
  }

  return svgStr;
}

// Contour mesh slider — pattern density changes → contour layer only
contourMeshSlider.addEventListener('input', () => {
  contourMeshSize = parseInt(contourMeshSlider.value, 10);
  contourMeshValue.textContent = String(contourMeshSize);
  if (lastCanvasW > 0) generateContourOnly();
});

// Outset slider — blur radius changes → contour layer only, text dots preserved
outsetSlider.addEventListener('input', () => {
  outsetRadius = parseInt(outsetSlider.value, 10);
  outsetValue.textContent = outsetRadius;
  clearTimeout(contourSliderDebounceTimer);
  contourSliderDebounceTimer = setTimeout(generateContourOnly, 80);
});

// Contour hazard slider — contour layer only, text dots preserved
contourHazardSlider.addEventListener('input', () => {
  contourPresenceStrength = parseFloat(contourHazardSlider.value);
  contourHazardValue.textContent = contourPresenceStrength.toFixed(2);
  if (lastCanvasW > 0) generateContourOnly();
});

// Contour taille-generation slider — contour layer only, text dots preserved
contourTailleGenSlider.addEventListener('input', () => {
  contourTailleGenerationMultiplier = parseFloat(contourTailleGenSlider.value);
  contourTailleGenValue.textContent = contourTailleGenerationMultiplier.toFixed(2);
  clearTimeout(contourSliderDebounceTimer);
  contourSliderDebounceTimer = setTimeout(() => {
    if (lastCanvasW > 0) generateContourOnly();
  }, 80);
});

// Contour size slider — contour layer only, text dots preserved
contourSizeSlider.addEventListener('input', () => {
  contourSizeMultiplier = parseFloat(contourSizeSlider.value);
  contourSizeValue.textContent = contourSizeMultiplier.toFixed(2);
  clearTimeout(contourSliderDebounceTimer);
  contourSliderDebounceTimer = setTimeout(() => {
    if (lastCanvasW > 0) generateContourOnly();
  }, 80);
});

// Bind editable spans for the contour-panel sliders (narrow viewport only).
// bindSpanEdit is defined in script-generator_DottFont.js, loaded before this file.
bindSpanEdit(contourMeshValue, contourMeshSlider, true, (v) => {
  contourMeshSize = v;
  if (lastCanvasW > 0) generateContourOnly();
});
bindSpanEdit(outsetValue, outsetSlider, true, (v) => {
  outsetRadius = v;
  generateContourOnly();
});
bindSpanEdit(contourHazardValue, contourHazardSlider, false, (v) => {
  contourPresenceStrength = v;
  if (lastCanvasW > 0) generateContourOnly();
});
bindSpanEdit(contourTailleGenValue, contourTailleGenSlider, false, (v) => {
  contourTailleGenerationMultiplier = v;
  if (lastCanvasW > 0) generateContourOnly();
});
bindSpanEdit(contourSizeValue, contourSizeSlider, false, (v) => {
  contourSizeMultiplier = v;
  if (lastCanvasW > 0) generateContourOnly();
});

// --- Randomize all parameters ---

// Returns a random value snapped to the slider's step grid, within [min, max].
// Reads min/max/step directly from the slider element so it stays in sync with HTML.
function randomSnap(sliderEl) {
  const min   = parseFloat(sliderEl.min);
  const max   = parseFloat(sliderEl.max);
  const step  = parseFloat(sliderEl.step);
  const steps = Math.round((max - min) / step);
  const n     = Math.floor(Math.random() * (steps + 1));
  return parseFloat((min + n * step).toFixed(6));
}

// Sets every parameter to a random value and triggers a full pipeline re-run.
// Declared globally so it can be called from outside if needed.
function randomizeAll() {
  // Main panel
  meshSize = Math.round(randomSnap(meshSlider));
  meshSlider.value = meshSize;
  meshValue.textContent = String(meshSize);

  tailleGenerationMultiplier = randomSnap(tailleGenerationSlider);
  tailleGenerationSlider.value = tailleGenerationMultiplier;
  tailleGenerationValue.textContent = tailleGenerationMultiplier.toFixed(2);

  sizeMultiplier = randomSnap(sizeSlider);
  sizeSlider.value = sizeMultiplier;
  sizeValue.textContent = sizeMultiplier.toFixed(2);

  presenceStrength = randomSnap(presenceSlider);
  presenceSlider.value = presenceStrength;
  presenceValue.textContent = presenceStrength.toFixed(2);

  // Offset panel
  contourMeshSize = Math.round(randomSnap(contourMeshSlider));
  contourMeshSlider.value = contourMeshSize;
  contourMeshValue.textContent = String(contourMeshSize);

  outsetRadius = Math.round(randomSnap(outsetSlider));
  outsetSlider.value = outsetRadius;
  outsetValue.textContent = String(outsetRadius);

  contourPresenceStrength = randomSnap(contourHazardSlider);
  contourHazardSlider.value = contourPresenceStrength;
  contourHazardValue.textContent = contourPresenceStrength.toFixed(2);

  contourTailleGenerationMultiplier = randomSnap(contourTailleGenSlider);
  contourTailleGenSlider.value = contourTailleGenerationMultiplier;
  contourTailleGenValue.textContent = contourTailleGenerationMultiplier.toFixed(2);

  contourSizeMultiplier = randomSnap(contourSizeSlider);
  contourSizeSlider.value = contourSizeMultiplier;
  contourSizeValue.textContent = contourSizeMultiplier.toFixed(2);

  // Pick a random shape from the available shape buttons
  const shapeBtns = Array.from(document.querySelectorAll('.shape-btn'));
  const pickedBtn = shapeBtns[Math.floor(Math.random() * shapeBtns.length)];
  shapeBtns.forEach(b => b.classList.remove('active'));
  pickedBtn.classList.add('active');
  currentShape = pickedBtn.dataset.shape;

  // Pick a random fill color and sync the color input
  const randomHex = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  currentColor = randomHex;
  shapeColorInput.value = randomHex;

  // Full re-run — outset change requires new blur data
  generate();
}

// Halo disable toggle — when checked, suppresses the halo layer entirely.
document.getElementById('halo-enabled').addEventListener('change', (e) => {
  haloEnabled = !e.target.checked;
  if (lastCanvasW > 0) generateContourOnly();
});

document.getElementById('btn-aleatoire').addEventListener('click', randomizeAll);

// Keyboard shortcut: press F to trigger randomizeAll.
// Guard: skip if the user is typing in a text input or contenteditable element.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'f' && e.key !== 'F') return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (document.activeElement?.isContentEditable) return;
  randomizeAll();
});
