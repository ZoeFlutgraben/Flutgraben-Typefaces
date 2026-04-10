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

const outsetSlider           = document.getElementById('outset-slider');
const outsetValue            = document.getElementById('outset-value');
const contourHazardSlider    = document.getElementById('contour-hazard-slider');
const contourHazardValue     = document.getElementById('contour-hazard-value');
const contourTailleGenSlider = document.getElementById('contour-taille-generation-slider');
const contourTailleGenValue  = document.getElementById('contour-taille-generation-value');
const contourSizeSlider      = document.getElementById('contour-size-slider');
const contourSizeValue       = document.getElementById('contour-size-value');

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

// Samples blurData for pixels in the halo zone (outside text, inside Gaussian blur)
// and returns an SVG markup string of native shape elements.
// Near the text edge: blur is dark → larger dots.
// Far from edge: blur is light → smaller, sparser dots.
// Parameters:
//   canvasW/H — canvas dimensions matching the hidden canvas
//   blurData  — ImageData from the Gaussian-blurred text mask
function generateContourSVGString(canvasW, canvasH, blurData) {
  if (!blurData || outsetRadius === 0) return '';

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

      // Probabilistic presence filter using contour-specific strength
      const probability = Math.max(0, 1 - (gray / 204) * contourPresenceStrength * 2);
      if (Math.random() > probability) continue;

      // Map gray (120–200) to dot radius with contour-specific size multipliers
      const darkness = Math.max(0, 1 - gray / 204);
      const radius   = (MIN_RADIUS + darkness * (MAX_RADIUS - MIN_RADIUS)) * contourSizeMultiplier * contourTailleGenerationMultiplier;

      svgStr += shapeDotSVG(x, y, radius);
    }
  }

  return svgStr;
}

// Outset slider — blur radius changes → full pipeline re-run (new blurData needed)
outsetSlider.addEventListener('input', () => {
  outsetRadius = parseInt(outsetSlider.value, 10);
  outsetValue.textContent = outsetRadius;
  clearTimeout(contourSliderDebounceTimer);
  contourSliderDebounceTimer = setTimeout(generate, 80);
});

// Contour hazard slider — re-sample all dots only, no pipeline re-run
contourHazardSlider.addEventListener('input', () => {
  contourPresenceStrength = parseFloat(contourHazardSlider.value);
  contourHazardValue.textContent = contourPresenceStrength.toFixed(2);
  if (lastCanvasW > 0) generateAllDots(lastCanvasW, lastCanvasH);
});

// Contour taille-generation slider — spacing changes → debounced re-sample
contourTailleGenSlider.addEventListener('input', () => {
  contourTailleGenerationMultiplier = parseFloat(contourTailleGenSlider.value);
  contourTailleGenValue.textContent = contourTailleGenerationMultiplier.toFixed(2);
  clearTimeout(contourSliderDebounceTimer);
  contourSliderDebounceTimer = setTimeout(() => {
    if (lastCanvasW > 0) generateAllDots(lastCanvasW, lastCanvasH);
  }, 80);
});

// Contour size slider — radius changes → debounced re-sample
contourSizeSlider.addEventListener('input', () => {
  contourSizeMultiplier = parseFloat(contourSizeSlider.value);
  contourSizeValue.textContent = contourSizeMultiplier.toFixed(2);
  clearTimeout(contourSliderDebounceTimer);
  contourSliderDebounceTimer = setTimeout(() => {
    if (lastCanvasW > 0) generateAllDots(lastCanvasW, lastCanvasH);
  }, 80);
});
