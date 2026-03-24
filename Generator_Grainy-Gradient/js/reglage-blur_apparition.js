// Toggle the controls panel visibility
let togg1 = document.getElementById("apparition");
let d1 = document.querySelector(".controls");

togg1.addEventListener("click", () => {
  if (getComputedStyle(d1).display != "none") {
    d1.style.display = "none";
  } else {
    d1.style.display = "flex";
  }
});

const scene = document.getElementById('scene');
const txt   = document.getElementById('txt');

// updateScene() — called on every slider movement.
// Reads all values at once and applies them simultaneously
// to avoid inconsistent intermediate states.
function updateScene() {
  const blur     = parseFloat(document.getElementById('blur').value);
  const contrast = parseFloat(document.getElementById('contrast').value);
  const blur2    = parseFloat(document.getElementById('blur2').value);
  const size     = parseFloat(document.getElementById('size').value);

  /* Applies blur on the child (creates the diffuse halo) */
  txt.style.filter   = `blur(${blur}px)`;
  txt.style.fontSize = `${size}rem`;

  /* Applies contrast + blur on the parent (sharpens and softens the render) */
  scene.style.filter = `contrast(${contrast}) blur(${blur2}px)`;

  /* Updates the value labels displayed to the right of each slider */
  document.getElementById('blur-v').textContent     = `${blur}px`;
  document.getElementById('contrast-v').textContent = contrast;
  document.getElementById('blur2-v').textContent    = `${blur2}px`;
  document.getElementById('size-v').textContent     = `${size}rem`;
}

/* Attaches the 'input' listener on each slider — fires on every drag movement */
['blur', 'contrast', 'blur2', 'size'].forEach(id =>
  document.getElementById(id).addEventListener('input', updateScene)
);

/* ── SVG grain controls ──────────────────────────────────────────────── */
// updateGrain() — updates the feTurbulence filter parameters and SVG viewBox
// in real time based on the SVG control sliders.
function updateGrain() {
  const turbulence = document.getElementById('fe-turbulence');
  const svgEl      = document.querySelector('#grain svg');
  if (!turbulence || !svgEl) return;

  const baseFreq = parseFloat(document.getElementById('base-freq').value);
  const numOct   = parseInt(document.getElementById('num-oct').value);
  const svgSize  = parseInt(document.getElementById('svg-size').value);

  turbulence.setAttribute('baseFrequency', baseFreq);
  turbulence.setAttribute('numOctaves', numOct);

  // A smaller viewBox = coarser grain, a larger viewBox = finer grain
  const ratio = window.innerHeight / window.innerWidth;
  svgEl.setAttribute('viewBox', `0 0 ${svgSize} ${Math.round(svgSize * ratio)}`);
  svgEl.setAttribute('preserveAspectRatio', 'none');

  document.getElementById('base-freq-v').textContent = baseFreq;
  document.getElementById('num-oct-v').textContent   = numOct;
  document.getElementById('svg-size-v').textContent  = svgSize;
}

['base-freq', 'num-oct', 'svg-size'].forEach(id =>
  document.getElementById(id).addEventListener('input', updateGrain)
);
