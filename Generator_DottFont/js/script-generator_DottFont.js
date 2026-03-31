// ============================================================
// DottFont Generator
//
// Pipeline:
//   étape 1 — user types in contenteditable div (DINish Bold)
//   étape 2 — text shape filled with bilinear mesh gradient
//             (4×4 grid, alternating black/grey from mesh.svg)
//   étape 3 — gradient canvas pixels sampled on a regular grid;
//             each in-text pixel spawns a <use> clone of #base-dot
//             (a <symbol>) sized by pixel darkness, with probabilistic
//             presence filter driven by the presence slider
// ============================================================

const textInput              = document.getElementById('text-input');
const gradientCanvas         = document.getElementById('gradient-canvas');
const gCtx                   = gradientCanvas.getContext('2d');
const outputSvg              = document.getElementById('output');
const hiddenCanvas           = document.getElementById('hidden-canvas');
const exportBtn              = document.getElementById('export-btn');
const presenceSlider         = document.getElementById('presence-slider');
const presenceValue          = document.getElementById('presence-value');
const sizeSlider             = document.getElementById('size-slider');
const sizeValue              = document.getElementById('size-value');
const tailleGenerationSlider = document.getElementById('taille-generation-slider');
const tailleGenerationValue  = document.getElementById('taille-generation-value');
const ctx                    = hiddenCanvas.getContext('2d');

// Presence strength — controls dot disappearance (0 = all present, 1 = dark zones only)
let presenceStrength = parseFloat(presenceSlider.value);

// Size multiplier — scales dot radii only; 1.0 = default, grid spacing stays fixed
let sizeMultiplier = parseFloat(sizeSlider.value);

// Taille-generation multiplier — scales both dot radii AND grid spacing together;
// 1.0 = default, preserves visual density across all sizes
let tailleGenerationMultiplier = parseFloat(tailleGenerationSlider.value);

// Last canvas dimensions — stored so the presence slider can regenerate dots
// without re-running the full text mask + gradient pipeline
let lastCanvasW = 0;
let lastCanvasH = 0;

// --- Rendering constants ---
const FONT_SIZE   = 150;  // px — text render size
const DOT_SPACING = 6;    // px — grid step between dot centers
const MAX_RADIUS  = 3.0;  // px — half-size of dot at full black
const MIN_RADIUS  = 0.5;  // px — half-size of dot at lightest grey
const THRESHOLD   = 240;  // brightness cutoff for text mask (0=black, 255=white)
const PADDING     = 30;   // px — margin around text on canvas

// --- Mesh gradient definition (from mesh.svg) ---
// 5×5 control points for a 4×4 patch grid.
// Alternating black (0) and grey (204 = #cccccc).
const MESH_COLS = 4;
const MESH_ROWS = 4;
const MESH_GRID = [];

for (let r = 0; r <= MESH_ROWS; r++) {
  MESH_GRID[r] = [];
  for (let c = 0; c <= MESH_COLS; c++) {
    MESH_GRID[r][c] = (r + c) % 2 === 0 ? 204 : 0;
  }
}

// --- Shape definitions ---
// Each shape maps to a <symbol> definition injected into the SVG defs.
// viewBox normalises the coordinate space; content is the SVG markup inside.
const SHAPES = {
  circle: {
    viewBox: '0 0 2 2',
    content: '<circle cx="1" cy="1" r="1" fill="#000000"/>'
  },
  square: {
    viewBox: '0 0 2 2',
    content: '<rect x="0" y="0" width="2" height="2" fill="#ff00ff"/>'
  },
  star: {
    viewBox: '0 0 3.9999998 3.979625',
    content: '<g transform="translate(-11.617356,-28.396201)"><path transform="matrix(0.05547957,0,0,0.05547957,10.97283,26.820792)" d="M 63.932803,100.12756 43.315212,85.252922 19.373414,93.80454 27.148851,69.599529 11.617356,49.472121 l 25.423076,-0.08488 14.342806,-20.99104 7.936888,24.152552 24.395836,7.154231 -20.517809,15.011979 z" fill="#ffff00"/></g>'
  },
  darkblue_circle: {
    viewBox: '0 0 0.957 0.957',
    content: '<circle cx="0.4785" cy="0.4785" r="0.4785" fill="#000080"/>'
  }
};

// Currently selected shape key
let currentShape = 'circle';

// Updates the base shape <symbol> in the output SVG defs.
function updateBaseShape(shapeKey) {
  const shape  = SHAPES[shapeKey];
  const ns     = 'http://www.w3.org/2000/svg';
  const defs   = outputSvg.querySelector('defs');
  const oldSym = defs.querySelector('#base-dot');

  const symbol = document.createElementNS(ns, 'symbol');
  symbol.setAttribute('id', 'base-dot');
  symbol.setAttribute('viewBox', shape.viewBox);
  symbol.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  symbol.innerHTML = shape.content;

  if (oldSym) {
    defs.replaceChild(symbol, oldSym);
  } else {
    defs.appendChild(symbol);
  }
}

// Renders the text to the hidden canvas as a solid black mask on white.
// Canvas dimensions adapt to the measured text width.
function renderTextMask(text) {
  const fontSpec = `700 ${FONT_SIZE}px DINish, sans-serif`;

  ctx.font = fontSpec;
  const metrics = ctx.measureText(text);
  const canvasW = Math.ceil(metrics.width) + PADDING * 2;
  const canvasH = FONT_SIZE + PADDING * 2;

  hiddenCanvas.width  = canvasW;
  hiddenCanvas.height = canvasH;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.fillStyle    = '#000000';
  ctx.font         = fontSpec;
  ctx.textBaseline = 'top';
  ctx.fillText(text, PADDING, PADDING);

  return { canvasW, canvasH };
}

// Draws the bilinear mesh gradient onto the visible gradient canvas,
// clipped to the text shape from the hidden canvas mask.
function drawMeshGradientPreview(canvasW, canvasH) {
  gradientCanvas.width  = canvasW;
  gradientCanvas.height = canvasH;

  const maskData = ctx.getImageData(0, 0, canvasW, canvasH);
  const imgData  = gCtx.createImageData(canvasW, canvasH);

  for (let py = 0; py < canvasH; py++) {
    for (let px = 0; px < canvasW; px++) {
      const i = (py * canvasW + px) * 4;
      const maskBrightness = (maskData.data[i] + maskData.data[i+1] + maskData.data[i+2]) / 3;

      if (maskBrightness >= THRESHOLD) {
        imgData.data[i]   = 249;
        imgData.data[i+1] = 249;
        imgData.data[i+2] = 249;
        imgData.data[i+3] = 255;
        continue;
      }

      // Inside text — bilinear interpolation of mesh gradient grid
      const gx = (px / canvasW) * MESH_COLS;
      const gy = (py / canvasH) * MESH_ROWS;
      const c0 = Math.min(Math.floor(gx), MESH_COLS - 1);
      const r0 = Math.min(Math.floor(gy), MESH_ROWS - 1);
      const tx = gx - c0;
      const ty = gy - r0;

      const value = Math.round(
        MESH_GRID[r0][c0]         * (1 - tx) * (1 - ty) +
        MESH_GRID[r0][c0 + 1]     * tx       * (1 - ty) +
        MESH_GRID[r0 + 1][c0]     * (1 - tx) * ty       +
        MESH_GRID[r0 + 1][c0 + 1] * tx       * ty
      );

      imgData.data[i]   = value;
      imgData.data[i+1] = value;
      imgData.data[i+2] = value;
      imgData.data[i+3] = 255;
    }
  }

  gCtx.putImageData(imgData, 0, 0);
}

// Samples the gradient canvas and returns SVG <use> clone elements.
// Applies a probabilistic presence filter driven by presenceStrength:
//   strength=0 → all dots present (probability always 1)
//   strength=0.5 → black zones full, grey zones ~0%
//   strength=1 → only the darkest pixels survive
// Formula: probability = max(0, 1 - (brightness / 204) * strength * 2)
function samplePixelsToClones(canvasW, canvasH) {
  const imageData = gCtx.getImageData(0, 0, canvasW, canvasH);
  const pixels    = imageData.data;
  const ns        = 'http://www.w3.org/2000/svg';
  const clones    = [];

  // Grid step scales with taille-generation so spacing and dot size stay proportional
  const step = DOT_SPACING * tailleGenerationMultiplier;

  for (let y = step / 2; y < canvasH; y += step) {
    for (let x = step / 2; x < canvasW; x += step) {
      const i = (Math.floor(y) * canvasW + Math.floor(x)) * 4;
      const brightness = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;

      // Skip background pixels (#f9f9f9 = 249)
      if (brightness >= 245) continue;

      // Probabilistic presence filter
      const probability = Math.max(0, 1 - (brightness / 204) * presenceStrength * 2);
      if (Math.random() > probability) continue;

      // Map brightness (0–204) to half-size radius
      // sizeMultiplier scales radius only; tailleGenerationMultiplier scales radius + spacing together
      const darkness = Math.max(0, 1 - brightness / 204);
      const radius   = (MIN_RADIUS + darkness * (MAX_RADIUS - MIN_RADIUS)) * sizeMultiplier * tailleGenerationMultiplier;
      const size     = radius * 2;

      // Place <use> referencing the base symbol
      // x/y position the top-left corner, width/height scale the symbol
      const use = document.createElementNS(ns, 'use');
      use.setAttribute('href', '#base-dot');
      use.setAttribute('x',      (x - radius).toFixed(2));
      use.setAttribute('y',      (y - radius).toFixed(2));
      use.setAttribute('width',  size.toFixed(2));
      use.setAttribute('height', size.toFixed(2));
      clones.push(use);
    }
  }

  return clones;
}

// Main generation function — called on text change, shape change, or size slider change.
function generate() {
  const text = textInput.innerText.trim();

  if (!text) {
    clearOutputs();
    return;
  }

  // Update the base clone shape in SVG defs
  updateBaseShape(currentShape);

  // Étape 2a — render solid text mask to hidden canvas
  const { canvasW, canvasH } = renderTextMask(text);

  // Étape 2b — draw bilinear mesh gradient clipped to text shape
  drawMeshGradientPreview(canvasW, canvasH);

  // Store dimensions so the presence slider can regenerate dots without re-running the pipeline
  lastCanvasW = canvasW;
  lastCanvasH = canvasH;

  // Étape 3 — sample gradient canvas and place dot clones into output SVG
  generateDots(canvasW, canvasH);
}

// Regenerates dot clones only — called by the presence slider to avoid re-running
// the full text mask and gradient pipeline.
function generateDots(canvasW, canvasH) {
  const ns = 'http://www.w3.org/2000/svg';

  outputSvg.setAttribute('width',   canvasW);
  outputSvg.setAttribute('height',  canvasH);
  outputSvg.setAttribute('viewBox', `0 0 ${canvasW} ${canvasH}`);

  // Remove previous dots, keep <defs> (always first child)
  while (outputSvg.children.length > 1) {
    outputSvg.removeChild(outputSvg.lastChild);
  }

  // Background rect preserved in SVG export
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width',  canvasW);
  bg.setAttribute('height', canvasH);
  bg.setAttribute('fill',   '#f9f9f9');
  outputSvg.appendChild(bg);

  const clones = samplePixelsToClones(canvasW, canvasH);
  clones.forEach(use => outputSvg.appendChild(use));
}

// Resets all outputs to empty state
function clearOutputs() {
  gradientCanvas.width  = 0;
  gradientCanvas.height = 0;
  outputSvg.setAttribute('width',  0);
  outputSvg.setAttribute('height', 0);
  while (outputSvg.children.length > 1) {
    outputSvg.removeChild(outputSvg.lastChild);
  }
}

// --- Event bindings ---

// Shape selector buttons
document.querySelectorAll('.shape-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentShape = btn.dataset.shape;
    generate();
  });
});

// Debounced regeneration on text input
textInput.addEventListener('input', () => {
  clearTimeout(textInput._debounce);
  textInput._debounce = setTimeout(generate, 180);
});

// Presence slider — regenerates dots only, no full pipeline re-run
presenceSlider.addEventListener('input', () => {
  presenceStrength = parseFloat(presenceSlider.value);
  presenceValue.textContent = presenceStrength.toFixed(2);
  if (lastCanvasW > 0) generateDots(lastCanvasW, lastCanvasH);
});

// Size slider — scales radius only, triggers full regeneration
sizeSlider.addEventListener('input', () => {
  sizeMultiplier = parseFloat(sizeSlider.value);
  sizeValue.textContent = sizeMultiplier.toFixed(2);
  generate();
});

// Taille-generation slider — scales radius AND spacing together, triggers full regeneration
tailleGenerationSlider.addEventListener('input', () => {
  tailleGenerationMultiplier = parseFloat(tailleGenerationSlider.value);
  tailleGenerationValue.textContent = tailleGenerationMultiplier.toFixed(2);
  generate();
});

// Export output SVG as a .svg file download
exportBtn.addEventListener('click', () => {
  const serializer = new XMLSerializer();
  const svgStr = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + serializer.serializeToString(outputSvg);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'dottfont.svg';
  a.click();
  URL.revokeObjectURL(url);
});

// Initial render once DINish font is loaded
document.fonts.ready.then(() => generate());
