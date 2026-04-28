// ============================================================
// DottFont Generator
//
// Pipeline:
//   step 1 — logo.svg loaded onto hidden canvas as a binary mask
//   step 2 — logo shape filled with bilinear mesh gradient
//             (4×4 grid, alternating black/grey from mesh.svg)
//   step 3 — gradient canvas pixels sampled on a regular grid;
//             each in-logo pixel spawns a native SVG shape element
//             (circle, rect, ellipse, etc.) sized by pixel darkness,
//             with probabilistic presence filter driven by the presence slider
// ============================================================
const imageDropZone          = document.getElementById('image-drop-zone');
const imageFileInput         = document.getElementById('image-file-input');
const imageDropLabel         = document.getElementById('image-drop-label');
const gradientCanvas         = document.getElementById('gradient-canvas');
const gCtx                   = gradientCanvas.getContext('2d');
const contourCanvas          = document.getElementById('contour-canvas');
const outputSvg              = document.getElementById('output');
const hiddenCanvas           = document.getElementById('hidden-canvas');
const exportBtn              = document.getElementById('export-btn');
const exportPngBtn           = document.getElementById('export-png-btn');
const presenceSlider         = document.getElementById('presence-slider');
const presenceValue          = document.getElementById('presence-value');
const sizeSlider             = document.getElementById('size-slider');
const sizeValue              = document.getElementById('size-value');
const tailleGenerationSlider = document.getElementById('taille-generation-slider');
const tailleGenerationValue  = document.getElementById('taille-generation-value');
const meshSlider             = document.getElementById('mesh-slider');
const meshValue              = document.getElementById('mesh-value');
const shapeColorInput        = document.getElementById('shape-color-input');
const ctx                    = hiddenCanvas.getContext('2d');

// Kept as empty string so reglage_advance.js references remain safe (dinishFont=null guards all uses)
let currentText = '';

// Current image source fed into the tramage pipeline — defaults to logo.svg
let currentImageSrc = 'logo.svg';

// Fill color applied to all generated shapes
let currentColor = '#000000';

// Object URL created for the last user-supplied file — revoked after each load
let lastObjectURL = null;

// Presence strength — controls dot disappearance (0 = all present, 1 = dark zones only)
let presenceStrength = parseFloat(presenceSlider.value);

// Size multiplier — scales dot radii only; 1.0 = default, grid spacing stays fixed
let sizeMultiplier = parseFloat(sizeSlider.value);

// Opacity applied to each individual shape element; 1.0 = fully opaque
let shapeOpacity = 1;

// Taille-generation multiplier — scales both dot radii AND grid spacing together;
// 1.0 = default, preserves visual density across all sizes
let tailleGenerationMultiplier = parseFloat(tailleGenerationSlider.value);

// Last canvas dimensions and blur data — stored so sliders can regenerate dots
// without re-running the full text mask + gradient pipeline
let lastCanvasW       = 0;
let lastCanvasH       = 0;
let lastBlurData      = null;
// Cached SVG strings — each layer stores its last render so the other can be
// rebuilt independently without re-randomising
let lastTextSVGString    = '';
let lastContourSVGString = '';

// Debounce timer for text input — avoids re-rendering on every keystroke
let debounceTimer;

// Debounce timer for sliders — avoids re-rendering on every drag pixel
let sliderDebounceTimer;

// --- Rendering constants ---
const FONT_SIZE   = 150;  // px — text render size
const DOT_SPACING = 6;    // px — grid step between dot centers
const MAX_RADIUS  = 3.0;  // px — half-size of dot at full black
const MIN_RADIUS  = 0.5;  // px — half-size of dot at lightest grey
const THRESHOLD   = 240;  // brightness cutoff for text mask (0=black, 255=white)
const PADDING     = 30;   // px — margin around text on canvas

// --- Mesh gradient size ---
// Number of patches along each axis. 0 = solid black (no mesh).
// Checkerboard pattern is computed inline: (r+c) even → grey (204), odd → black (0).
let meshSize = 0;

// --- Shape definitions ---
// Each shape maps to a <symbol> definition injected into the SVG defs.
// viewBox normalises the coordinate space; content is the SVG markup inside.
// Source files are in clone/ (active) and clone/archives/ (retired).
const SHAPES = {
  // Filled black circle — clone/circle.svg
  circle: {
    viewBox: '0 0 2 2',
    content: '<circle cx="1" cy="1" r="1" fill="#000000"/>'
  },
  // Filled pink square — clone/pink_square.svg
  square: {
    viewBox: '0 0 2 2',
    content: '<rect x="0" y="0" width="2" height="2" fill="#000000"/>'
  },
  // Thin flat rectangle (no rounded corners) — clone/trait_2.svg
  // viewBox 0 0 3.614 1.027 — width-constrained by meet
  trait_2: {
    viewBox: '0 0 3.614 1.027',
    content: '<rect x="0" y="0" width="3.614" height="1.027" fill="#000000"/>'
  },
  // Pentagon (vertex-bottom, flat-top) — clone/polygone.svg
  // viewBox 0 0 2.829 2.691 — width-constrained by meet
  polygone: {
    viewBox: '0 0 2.829 2.691',
    content: '<polygon points="1.415,2.691 0,1.663 0.540,0 2.289,0 2.829,1.663" fill="#000000"/>'
  },
  // Octagon — clone/polygone8.svg
  // viewBox 0 0 2.314 2.314 — square bounding box
  polygone8: {
    viewBox: '0 0 2.314 2.314',
    content: '<polygon points="0.348,0.353 0.012,1.163 0.348,1.973 1.158,2.309 1.968,1.973 2.304,1.163 1.968,0.353 1.158,0.017" fill="#000000"/>'
  },

  cross:{
    viewBox: '0 0 0.748 0.748',
    content: '<polygon points="0,0 0.373447,0.154202 0.746893,0 0.592326,0.373081 0.747624,0.747624 0.373447,0.59196 -7.31e-4,0.747624 0.154568,0.373081" fill="#000000"/>'
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
  // Inject currentColor so the symbol preview matches the generated dots
  symbol.innerHTML = shape.content.replace(/fill="[^"]*"/g, `fill="${currentColor}"`);

  if (oldSym) {
    defs.replaceChild(symbol, oldSym);
  } else {
    defs.appendChild(symbol);
  }
}

// Applies a Gaussian blur to the existing hidden canvas content and returns
// the blurred ImageData. Called both from renderTextMask() on full pipeline runs
// and from generateContourOnly() when only the halo radius changes.
// Parameters: canvasW/H — dimensions of the hidden canvas (must already be rendered).
function computeBlurData(canvasW, canvasH) {
  if (outsetRadius === 0) return null;
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width  = canvasW;
  blurCanvas.height = canvasH;
  const blurCtx = blurCanvas.getContext('2d');
  blurCtx.filter = `blur(${outsetRadius}px)`;
  blurCtx.drawImage(hiddenCanvas, 0, 0);
  return blurCtx.getImageData(0, 0, canvasW, canvasH);
}

// Loads any image (URL or object URL) onto the hidden canvas as a white-background mask.
// The image is rendered at its natural pixel size + PADDING margin on all sides.
// Dark pixels (any color with brightness < THRESHOLD) register as inside-mask.
// Returns a Promise resolving to { canvasW, canvasH, blurData }.
function renderImageMask(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const imgW    = img.naturalWidth  || img.width;
      const imgH    = img.naturalHeight || img.height;
      const canvasW = imgW + PADDING * 2;
      const canvasH = imgH + PADDING * 2;

      hiddenCanvas.width  = canvasW;
      hiddenCanvas.height = canvasH;

      // White background so pixels outside the image register as background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.drawImage(img, PADDING, PADDING, imgW, imgH);

      // Revoke the object URL now that the image is drawn — avoids memory leaks
      if (lastObjectURL) {
        URL.revokeObjectURL(lastObjectURL);
        lastObjectURL = null;
      }

      resolve({ canvasW, canvasH, blurData: computeBlurData(canvasW, canvasH) });
    };

    img.onerror = () => reject(new Error(`renderImageMask: failed to load "${src}"`));
    img.src = src;
  });
}

// Sets a new image source from a File object, updates the drop zone label, and re-renders.
// Revokes any previously created object URL before creating the new one.
function loadImageFile(file) {
  if (lastObjectURL) {
    URL.revokeObjectURL(lastObjectURL);
  }
  lastObjectURL   = URL.createObjectURL(file);
  currentImageSrc = lastObjectURL;
  imageDropLabel.textContent = file.name;
  generate();
}

// Renders the text to the hidden canvas as a solid black mask on white.
// Canvas dimensions adapt to the measured text width.
// Returns { canvasW, canvasH, blurData } — blurData via computeBlurData().
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

  return { canvasW, canvasH, blurData: computeBlurData(canvasW, canvasH) };
}

// Draws the step 3 contour preview canvas.
// Shows the Gaussian-blurred mask directly as a grayscale image:
// dark = text interior (large dots), gray gradient = outset halo (small dots), white = background.
// Parameters: canvasW/H — dimensions; blurData — blurred mask ImageData (null if outsetRadius = 0).
function drawContourPreview(canvasW, canvasH, blurData) {
  contourCanvas.width  = canvasW;
  contourCanvas.height = canvasH;
  const cCtx = contourCanvas.getContext('2d');

  if (!blurData) {
    // No outset — show plain background
    cCtx.fillStyle = '#f9f9f9';
    cCtx.fillRect(0, 0, canvasW, canvasH);
    return;
  }

  // Render blurred mask as grayscale: the gradient from black to white around the
  // text edges directly represents the sampling zone for outset dots
  const preview = cCtx.createImageData(canvasW, canvasH);
  for (let i = 0; i < blurData.data.length; i += 4) {
    const gray = blurData.data[i]; // source is already grayscale (black text on white)
    preview.data[i]   = gray;
    preview.data[i+1] = gray;
    preview.data[i+2] = gray;
    preview.data[i+3] = 255;
  }
  cCtx.putImageData(preview, 0, 0);
}

// Draws the bilinear mesh gradient onto the visible gradient canvas,
// clipped to the text shape from the hidden canvas mask.
// The outset/halo zone is handled separately by generateContourSVGString() in offset.js.
//
// refWidth — optional fixed reference width for the gradient x-axis.
// When omitted, canvasW is used (normal web render behaviour).
// Pass a constant value during OTF export so all characters share the same
// gradient scale on x, preventing the per-character gradient remapping that
// causes irregular dot sizes and the resulting trembling in the OTF.
function drawMeshGradientPreview(canvasW, canvasH, refWidth) {
  gradientCanvas.width  = canvasW;
  gradientCanvas.height = canvasH;

  // Use the provided reference width for x-axis gradient mapping, or fall back to canvasW
  const gradRefW = refWidth || canvasW;

  const maskData = ctx.getImageData(0, 0, canvasW, canvasH);
  const imgData  = gCtx.createImageData(canvasW, canvasH);

  for (let py = 0; py < canvasH; py++) {
    for (let px = 0; px < canvasW; px++) {
      const i = (py * canvasW + px) * 4;
      const maskBrightness = (maskData.data[i] + maskData.data[i+1] + maskData.data[i+2]) / 3;

      if (maskBrightness >= THRESHOLD) {
        // Background pixel
        imgData.data[i]   = 249;
        imgData.data[i+1] = 249;
        imgData.data[i+2] = 249;
        imgData.data[i+3] = 255;
        continue;
      }

      // Inside text — meshSize 0 → solid black; otherwise bilinear interpolation
      // of a checkerboard where (r+c) even → grey (204), odd → black (0).
      // gradRefW on x ensures consistent gradient scale across all characters.
      let value;
      if (meshSize === 0) {
        value = 0;
      } else {
        const gx = (px / gradRefW) * meshSize;
        const gy = (py / canvasH) * meshSize;
        const c0 = Math.min(Math.floor(gx), meshSize - 1);
        const r0 = Math.min(Math.floor(gy), meshSize - 1);
        const tx = gx - c0;
        const ty = gy - r0;

        // Inline checkerboard: (r+c) even → 204 (grey), odd → 0 (black)
        const cv = (r, c) => (r + c) % 2 === 0 ? 204 : 0;
        value = Math.round(
          cv(r0,     c0)     * (1 - tx) * (1 - ty) +
          cv(r0,     c0 + 1) * tx       * (1 - ty) +
          cv(r0 + 1, c0)     * (1 - tx) * ty       +
          cv(r0 + 1, c0 + 1) * tx       * ty
        );
      }

      imgData.data[i]   = value;
      imgData.data[i+1] = value;
      imgData.data[i+2] = value;
      imgData.data[i+3] = 255;
    }
  }

  gCtx.putImageData(imgData, 0, 0);
}

// Returns an SVG element string for a single dot centered at (cx, cy) with half-size r.
// Generates the appropriate native element type based on currentShape so the exported
// SVG contains directly editable shapes (no <use> / <symbol> indirection).
// Proportions are derived from each shape's viewBox and preserveAspectRatio="xMidYMid meet".
function shapeDotSVG(cx, cy, r) {
  const size = r * 2;
  const x    = cx - r;
  const y    = cy - r;

  // Shared opacity attribute — applied per-shape so overlapping shapes accumulate visually
  const op = shapeOpacity < 1 ? ` opacity="${shapeOpacity}"` : '';

  if (currentShape === 'square') {
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" fill="${currentColor}"${op}/>`;
  }

  if (currentShape === 'trait_2') {
    // viewBox 0 0 3.614 1.027 — landscape, width-constrained by meet:
    // scale = size/3.614 → rendered height = 1.027 × scale, no rounded corners
    const h  = size * 1.027 / 3.614;
    const oy = (size - h) / 2;  // vertical centering offset
    return `<rect x="${x.toFixed(2)}" y="${(y + oy).toFixed(2)}" width="${size.toFixed(2)}" height="${h.toFixed(2)}" fill="${currentColor}"${op}/>`;
  }

  if (currentShape === 'polygone') {
    // viewBox 0 0 2.829 2.691 — width-constrained by meet.
    // Pentagon (vertex-bottom, flat-top). Ratios from normalized viewBox coordinates.
    const h  = r * 0.951;  // half-height (vertical reach from center)
    const hw = r * 0.618;  // horizontal offset of top-left/top-right vertices
    const vm = r * 0.224;  // vertical offset of left/right vertices
    const pts = [
      `${cx.toFixed(2)},${(cy + h).toFixed(2)}`,           // bottom vertex
      `${(cx - r).toFixed(2)},${(cy + vm).toFixed(2)}`,    // left
      `${(cx - hw).toFixed(2)},${(cy - h).toFixed(2)}`,    // top-left
      `${(cx + hw).toFixed(2)},${(cy - h).toFixed(2)}`,    // top-right
      `${(cx + r).toFixed(2)},${(cy + vm).toFixed(2)}`     // right
    ].join(' ');
    return `<polygon points="${pts}" fill="${currentColor}"${op}/>`;
  }

  if (currentShape === 'polygone8') {
    // viewBox 0 0 2.314 2.314 — square bounding box. scale = size/2.314.
    // Vertex ratios derived from polygone8.svg after transform normalization (Y-down order).
    const verts = [
      [-0.699, -0.695], [-0.989,  0.005], [-0.699,  0.705], [ 0.001,  0.995],
      [ 0.701,  0.705], [ 0.991,  0.005], [ 0.701, -0.695], [ 0.001, -0.985]
    ];
    const pts = verts.map(([dx, dy]) => `${(cx + dx * r).toFixed(2)},${(cy + dy * r).toFixed(2)}`).join(' ');
    return `<polygon points="${pts}" fill="${currentColor}"${op}/>`;
  }

  if (currentShape === 'cross') {
      // viewBox 0 0 0.748 0.748 — square bounding box. scale = size/0.748
      // 8-point cross star. Vertex ratios derived from normalized viewBox coords:
      // ratio = (px - vbW/2) / (vbW/2) = (px - 0.374) / 0.374
      const verts = [
        [-1.000, -1.000], [-0.001, -0.588], [ 0.997, -1.000], [ 0.584, -0.002],
        [ 0.999,  0.999], [-0.001,  0.583], [-1.002,  0.999], [-0.587, -0.002]
      ];
      const pts = verts.map(([dx, dy]) => `${(cx + dx * r).toFixed(2)},${(cy + dy * r).toFixed(2)}`).join(' ');
      return `<polygon points="${pts}" fill="${currentColor}"${op}/>`;
    }

  // Default: circle
  return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${currentColor}"${op}/>`;
}

// Samples the gradient canvas and returns an SVG markup string of native shape elements.
// Building a string and inserting it once via insertAdjacentHTML is significantly faster
// than creating N DOM elements individually (avoids per-element reflow cost).
//
// Presence filter:
//   strength=0 → all dots present
//   strength=0.5 → black zones full, grey zones ~0%
//   strength=1 → only the darkest pixels survive
//   meshSize=0 → flat probability (1 - presenceStrength), brightness-independent
function samplePixelsToSVGString(canvasW, canvasH) {
  const imageData = gCtx.getImageData(0, 0, canvasW, canvasH);
  const pixels    = imageData.data;
  let   svgStr    = '';

  // Grid step scales with taille-generation so spacing and dot size stay proportional
  const step = DOT_SPACING * tailleGenerationMultiplier;

  for (let y = step / 2; y < canvasH; y += step) {
    for (let x = step / 2; x < canvasW; x += step) {
      const i = (Math.floor(y) * canvasW + Math.floor(x)) * 4;
      const brightness = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;

      // Skip background pixels (#f9f9f9 = 249)
      if (brightness >= 245) continue;

      // Probabilistic presence filter.
      // meshSize 0 → solid black, brightness always 0 → use flat probability instead
      const probability = meshSize === 0
        ? 1 - presenceStrength
        : Math.max(0, 1 - (brightness / 204) * presenceStrength * 2);
      if (Math.random() > probability) continue;

      // Map brightness (0–204) to half-size radius
      // sizeMultiplier scales radius only; tailleGenerationMultiplier scales radius + spacing together
      const darkness = Math.max(0, 1 - brightness / 204);
      const radius   = (MIN_RADIUS + darkness * (MAX_RADIUS - MIN_RADIUS)) * sizeMultiplier * tailleGenerationMultiplier;

      svgStr += shapeDotSVG(x, y, radius);
    }
  }

  return svgStr;
}

// Main generation function — called on page load, shape change, or size slider change.
// Async because renderLogoMask() loads an image via Promise.
async function generate() {
  // Update the base clone shape in SVG defs
  updateBaseShape(currentShape);

  // Step 1 — load current image as binary mask on hidden canvas
  const { canvasW, canvasH, blurData } = await renderImageMask(currentImageSrc);

  // Store blurData so contour sliders can regenerate without re-running the full pipeline
  lastBlurData = blurData;

  // Step 2 — draw mesh gradient (logo interior only; contour handled by offset.js)
  drawMeshGradientPreview(canvasW, canvasH);

  // Step 3 — show blurred mask as contour preview in the outline panel
  drawContourPreview(canvasW, canvasH, blurData);

  // Store dimensions so sliders can regenerate without re-running the full pipeline
  lastCanvasW = canvasW;
  lastCanvasH = canvasH;

  // Generate contour dots (behind) + main dots (in front)
  generateAllDots(canvasW, canvasH);
}

// Regenerates all dot clones — contour dots (behind) then main dots (in front).
// Called by any slider that does not require a full pipeline re-run.
// All content inserted in one insertAdjacentHTML call to minimize DOM operations.
function generateAllDots(canvasW, canvasH) {
  outputSvg.setAttribute('width',   canvasW);
  outputSvg.setAttribute('height',  canvasH);
  outputSvg.setAttribute('viewBox', `0 0 ${canvasW} ${canvasH}`);

  // Remove previous content, keep <defs> (always first child)
  while (outputSvg.children.length > 1) {
    outputSvg.removeChild(outputSvg.lastChild);
  }

  // Cache each layer so the other can be rebuilt independently without re-randomising
  lastContourSVGString = generateContourSVGString(canvasW, canvasH, lastBlurData);
  lastTextSVGString    = samplePixelsToSVGString(canvasW, canvasH);

  // Contour dots (behind) + main dots (in front) — no background rect, export is transparent
  outputSvg.insertAdjacentHTML('beforeend',
    lastContourSVGString +
    lastTextSVGString
  );
}

// Rebuilds only the halo/contour layer, leaving the text dots untouched.
// Called when outsetRadius changes — recomputes blurData from the existing
// hidden canvas (text already rendered) and reinserts cached text dots.
function generateContourOnly() {
  if (lastCanvasW === 0) return;
  lastBlurData = computeBlurData(lastCanvasW, lastCanvasH);
  drawContourPreview(lastCanvasW, lastCanvasH, lastBlurData);

  while (outputSvg.children.length > 1) {
    outputSvg.removeChild(outputSvg.lastChild);
  }
  lastContourSVGString = generateContourSVGString(lastCanvasW, lastCanvasH, lastBlurData);
  outputSvg.insertAdjacentHTML('beforeend',
    lastContourSVGString +
    lastTextSVGString
  );
}

// Rebuilds only the text layer, leaving the contour dots untouched.
// Called by main-panel sliders — resamples from the existing gradient canvas.
function generateTextOnly() {
  if (lastCanvasW === 0) return;
  lastTextSVGString = samplePixelsToSVGString(lastCanvasW, lastCanvasH);

  while (outputSvg.children.length > 1) {
    outputSvg.removeChild(outputSvg.lastChild);
  }
  outputSvg.insertAdjacentHTML('beforeend',
    lastContourSVGString +
    lastTextSVGString
  );
}

// Redraws the mesh gradient then regenerates the text layer only.
// Called when meshSize changes — gradient values must be recomputed first.
function regenerateTextWithMesh() {
  if (lastCanvasW === 0) return;
  drawMeshGradientPreview(lastCanvasW, lastCanvasH);
  generateTextOnly();
}

// Resets all outputs to empty state
function clearOutputs() {
  gradientCanvas.width  = 0;
  gradientCanvas.height = 0;
  contourCanvas.width   = 0;
  contourCanvas.height  = 0;
  outputSvg.setAttribute('width',  0);
  outputSvg.setAttribute('height', 0);
  while (outputSvg.children.length > 1) {
    outputSvg.removeChild(outputSvg.lastChild);
  }
}

// --- Event bindings ---

// Debounced generate for heavy sliders — ~80ms delay avoids re-rendering on every drag pixel
function debouncedGenerate() {
  clearTimeout(sliderDebounceTimer);
  sliderDebounceTimer = setTimeout(generate, 80);
}

// Shape selector buttons
document.querySelectorAll('.shape-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentShape = btn.dataset.shape;
    generate();
  });
});

// Presence slider — text layer only, contour preserved
presenceSlider.addEventListener('input', () => {
  presenceStrength = parseFloat(presenceSlider.value);
  presenceValue.textContent = presenceStrength.toFixed(2);
  if (lastCanvasW > 0) generateTextOnly();
});

// Size slider — text layer only, contour preserved
sizeSlider.addEventListener('input', () => {
  sizeMultiplier = parseFloat(sizeSlider.value);
  sizeValue.textContent = sizeMultiplier.toFixed(2);
  clearTimeout(sliderDebounceTimer);
  sliderDebounceTimer = setTimeout(generateTextOnly, 80);
});

// Taille-generation slider — text layer only, contour preserved
tailleGenerationSlider.addEventListener('input', () => {
  tailleGenerationMultiplier = parseFloat(tailleGenerationSlider.value);
  tailleGenerationValue.textContent = tailleGenerationMultiplier.toFixed(2);
  clearTimeout(sliderDebounceTimer);
  sliderDebounceTimer = setTimeout(generateTextOnly, 80);
});

// Mesh slider — redraws gradient then text layer only, contour preserved
meshSlider.addEventListener('input', () => {
  meshSize = parseInt(meshSlider.value, 10);
  meshValue.textContent = meshSize;
  clearTimeout(sliderDebounceTimer);
  sliderDebounceTimer = setTimeout(regenerateTextWithMesh, 80);
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
  a.download =  `${currentShape}_${meshSize}_${tailleGenerationMultiplier.toFixed(2)}_${sizeMultiplier.toFixed(2)}_${presenceStrength.toFixed(2)}.svg`;
  a.click();
  URL.revokeObjectURL(url);
});

// Export output SVG as a PNG file download at 4× resolution.
// Serializes the SVG, draws it onto an upscaled canvas via an Image, then triggers a PNG download.
// The 4× scale is fixed to guarantee consistent output quality regardless of screen DPI.
exportPngBtn.addEventListener('click', () => {
  const w = parseInt(outputSvg.getAttribute('width'),  10);
  const h = parseInt(outputSvg.getAttribute('height'), 10);
  if (!w || !h) return;

  const scale  = 4;
  const svgStr = new XMLSerializer().serializeToString(outputSvg);
  const url    = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
  const img    = new Image();

  img.onload = () => {
    const canvas  = document.createElement('canvas');
    canvas.width  = w * scale;
    canvas.height = h * scale;
    const pngCtx  = canvas.getContext('2d');
    pngCtx.scale(scale, scale);
    pngCtx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const a    = document.createElement('a');
    a.href     = canvas.toDataURL('image/png');
    a.download = `${currentShape}_${meshSize}_${tailleGenerationMultiplier.toFixed(2)}_${sizeMultiplier.toFixed(2)}_${presenceStrength.toFixed(2)}.png`;
    a.click();
  };

  img.src = url;
});

// --- Responsive span editing ---
// Below 1200px, sliders are hidden and value spans are contenteditable.
// bindSpanEdit wires focus/keydown/blur on a span so the user can type a value.
// On blur: parse the text, clamp to [min, max], sync the hidden slider, call onCommit.
// At wide viewport (> 1200px) the blur handler does nothing — pointer-events: none
// on the span already prevents interaction, but the guard is here as a safety net.
//
// Parameters:
//   spanEl   — the <span contenteditable> element
//   sliderEl — the matching <input type="range"> (used for min/max/value sync)
//   isInt    — true → round to integer (e.g. mesh); false → toFixed(2)
//   onCommit — callback(value) fired after the clamped value is applied
function bindSpanEdit(spanEl, sliderEl, isInt, onCommit) {
  // Select all text on focus so the user can type a replacement immediately
  spanEl.addEventListener('focus', () => {
    const range = document.createRange();
    range.selectNodeContents(spanEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  // Keyboard controls:
  //   Enter      — commit the edit (same as blurring)
  //   ArrowUp    — increment value by one slider step
  //   ArrowDown  — decrement value by one slider step
  spanEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      spanEl.blur();
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); // prevent page scroll
      const step    = parseFloat(sliderEl.step) || 1;
      const min     = parseFloat(sliderEl.min);
      const max     = parseFloat(sliderEl.max);
      const raw     = parseFloat(spanEl.textContent);
      const current = isNaN(raw) ? parseFloat(sliderEl.value) : raw;
      const next    = current + (e.key === 'ArrowUp' ? step : -step);
      // Round to 2 dp before clamping to avoid floating-point drift (e.g. 0.05+0.25=0.300…04)
      const rounded = parseFloat(next.toFixed(2));
      const v       = isInt ? Math.round(Math.min(max, Math.max(min, rounded)))
                            : parseFloat(Math.min(max, Math.max(min, rounded)).toFixed(2));
      spanEl.textContent = isInt ? String(v) : v.toFixed(2);
      sliderEl.value = v;
      onCommit(v);
    }
  });

  // On blur: parse, clamp, update span text + slider, fire callback
  spanEl.addEventListener('blur', () => {
    if (window.innerWidth > 1200) return;
    const raw = parseFloat(spanEl.textContent);
    const min = parseFloat(sliderEl.min);
    const max = parseFloat(sliderEl.max);
    const clamped = isNaN(raw) ? parseFloat(sliderEl.value) : Math.min(max, Math.max(min, raw));
    const v = isInt ? Math.round(clamped) : clamped;
    spanEl.textContent = isInt ? String(v) : v.toFixed(2);
    sliderEl.value = v;
    onCommit(v);
  });
}

// Bind editable spans for the four main-panel sliders (narrow viewport only)
bindSpanEdit(meshValue, meshSlider, true, (v) => {
  meshSize = v;
  regenerateTextWithMesh();
});
bindSpanEdit(tailleGenerationValue, tailleGenerationSlider, false, (v) => {
  tailleGenerationMultiplier = v;
  generateTextOnly();
});
bindSpanEdit(sizeValue, sizeSlider, false, (v) => {
  sizeMultiplier = v;
  generateTextOnly();
});
bindSpanEdit(presenceValue, presenceSlider, false, (v) => {
  presenceStrength = v;
  if (lastCanvasW > 0) generateTextOnly();
});

// Color input — updates currentColor and redraws the text layer only (no mask re-render needed)
shapeColorInput.addEventListener('input', () => {
  currentColor = shapeColorInput.value;
  updateBaseShape(currentShape);
  if (lastCanvasW > 0) generateTextOnly();
});

// File input — triggers when the user browses and selects a file
imageFileInput.addEventListener('change', () => {
  const file = imageFileInput.files[0];
  if (file) loadImageFile(file);
  // Reset so selecting the same file again still fires 'change'
  imageFileInput.value = '';
});

// Drag & drop — visual feedback
imageDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  imageDropZone.classList.add('drag-over');
});
imageDropZone.addEventListener('dragleave', () => {
  imageDropZone.classList.remove('drag-over');
});
imageDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  imageDropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImageFile(file);
});

// Initial render on page load
generate();

// Populate charset tooltips from data-chars attribute — no fetch needed
// Each .adv-check with data-chars gets its characters injected into the tooltip span
document.querySelectorAll('.adv-check[data-chars]').forEach(label => {
  const tooltip = label.querySelector('.charset-tooltip');
  if (tooltip) tooltip.textContent = label.dataset.chars;
});
