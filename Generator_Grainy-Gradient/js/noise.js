const grainDiv = document.getElementById('grain');

function buildGrainSVG() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  grainDiv.innerHTML = `
<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
  <filter id='noiseFilter'>
    <feTurbulence
      id='fe-turbulence'
      type='fractalNoise'
      baseFrequency='0.65'
      numOctaves='3'
      stitchTiles='stitch'/>
  </filter>
  <rect id='grain-rect' width='${w}' height='${h}' filter='url(#noiseFilter)'/>
</svg>`;
}

buildGrainSVG();
window.addEventListener('resize', buildGrainSVG);
