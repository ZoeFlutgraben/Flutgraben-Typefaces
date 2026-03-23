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

    /*
     * updateScene() — appelée à chaque mouvement de slider.
     * Lit toutes les valeurs d'un coup et les applique simultanément
     * pour éviter les états intermédiaires incohérents.
     */
    function updateScene() {
      const blur     = parseFloat(document.getElementById('blur').value);
      const contrast = parseFloat(document.getElementById('contrast').value);
      const blur2    = parseFloat(document.getElementById('blur2').value);
      const size     = parseFloat(document.getElementById('size').value);

      /* Applique blur sur l'enfant (crée le halo diffus) */
      txt.style.filter   = `blur(${blur}px)`;
      txt.style.fontSize = `${size}rem`;

      /* Applique contrast + blur sur le parent (durcit et adoucit le rendu) */
      scene.style.filter = `contrast(${contrast}) blur(${blur2}px)`;

      /* Met à jour les labels affichés à droite des sliders */
      document.getElementById('blur-v').textContent     = `${blur}px`;
      document.getElementById('contrast-v').textContent = contrast;
      document.getElementById('blur2-v').textContent    = `${blur2}px`;
      document.getElementById('size-v').textContent     = `${size}rem`;
    }

    /* Attache l'écouteur 'input' sur chaque slider — déclenché au moindre glissement */
    ['blur', 'contrast', 'blur2', 'size'].forEach(id =>
      document.getElementById(id).addEventListener('input', updateScene)
    );

    /* ── Contrôles SVG grain ─────────────────────────────────────────────── */
    function updateGrain() {
      const turbulence = document.getElementById('fe-turbulence');
      const svgEl      = document.querySelector('#grain svg');
      if (!turbulence || !svgEl) return;

      const baseFreq = parseFloat(document.getElementById('base-freq').value);
      const numOct   = parseInt(document.getElementById('num-oct').value);
      const svgSize  = parseInt(document.getElementById('svg-size').value);

      turbulence.setAttribute('baseFrequency', baseFreq);
      turbulence.setAttribute('numOctaves', numOct);

      // SVG size : viewBox plus petit = grains plus grossiers, plus grand = plus fins
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