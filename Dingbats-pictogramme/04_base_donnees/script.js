// Graffiti catalogue — main script
// Reads from GRAFFITIS_DATA (defined in data/graffitis.js)

// ===================== INIT =====================

// Initialize the app once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  renderGrid(GRAFFITIS_DATA);
  renderPlanMarkers(GRAFFITIS_DATA);
  setupTabs();
  setupFilters();
  setupFloorSelector();
  document.getElementById('fiche-close').addEventListener('click', closeFiche);
});

// ===================== CATALOGUE =====================

// Render the grid of graffiti cards
// @param {Array} data — array of graffiti objects to display
function renderGrid(data) {
  const grid = document.getElementById('grid');
  const count = document.getElementById('count');

  grid.innerHTML = '';
  count.textContent = data.length + ' élément' + (data.length !== 1 ? 's' : '');

  if (data.length === 0) {
    grid.innerHTML = '<p style="padding:2rem;color:#444;font-size:0.8rem;">Aucun résultat.</p>';
    return;
  }

  data.forEach(g => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${g.photo}" alt="${g.surnom || g.id}" loading="lazy"
           onerror="this.style.background='#1a1a1a'">
      <div class="card-info">
        <div class="card-id">${g.id}</div>
        <div class="card-surnom">${g.surnom || ''}</div>
        <div class="card-categorie">${g.categorie || ''}</div>
      </div>
    `;
    card.addEventListener('click', () => openFiche(g.id));
    grid.appendChild(card);
  });
}

// ===================== FILTERS =====================

// Wire up the category and technique filter dropdowns
function setupFilters() {
  const filterCat  = document.getElementById('filter-categorie');
  const filterTech = document.getElementById('filter-technique');

  // Re-render grid with current filter values applied
  function applyFilters() {
    const cat  = filterCat.value;
    const tech = filterTech.value;

    const filtered = GRAFFITIS_DATA.filter(g => {
      const matchCat  = !cat  || g.categorie === cat;
      const matchTech = !tech || (Array.isArray(g.technique) && g.technique.includes(tech));
      return matchCat && matchTech;
    });

    renderGrid(filtered);
  }

  filterCat.addEventListener('change', applyFilters);
  filterTech.addEventListener('change', applyFilters);
}

// ===================== FLOOR SELECTOR =====================

// Map floor keys to their image paths and alt text
const FLOOR_PLANS = {
  floor_01:    { src: 'plan_batiment/floor_01.png',     alt: 'Plan niveau 1' },
  floor_02:    { src: 'plan_batiment/floor_02.png',     alt: 'Plan niveau 2' },
  floor_03:    { src: 'plan_batiment/floor_03.png',     alt: 'Plan niveau 3' },
};

// Handle floor selector button clicks — swaps the plan image and re-renders markers
function setupFloorSelector() {
  document.querySelectorAll('.floor-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.floor;
      const plan = FLOOR_PLANS[key];
      if (!plan) return;

      // Update active button state
      document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Swap the plan image
      const img = document.getElementById('plan-img');
      img.src = plan.src;
      img.alt = plan.alt;

      // Re-render markers filtered to this floor (if graffitis have a floor field)
      const filtered = GRAFFITIS_DATA.filter(g => !g.floor || g.floor === key);
      renderPlanMarkers(filtered);
    });
  });
}

// ===================== PLAN =====================

// Render clickable markers on the building plan SVG
// Markers are only shown for graffitis with plan_x and plan_y coordinates set
function renderPlanMarkers(data) {
  const container = document.getElementById('plan-markers');
  container.innerHTML = '';

  const withCoords = data.filter(g => g.plan_x !== null && g.plan_y !== null);

  withCoords.forEach(g => {
    const marker = document.createElement('div');
    marker.className = 'marker';

    // Position as percentage of plan image dimensions
    marker.style.left = g.plan_x + '%';
    marker.style.top  = g.plan_y + '%';

    const label = g.surnom ? `${g.id} — ${g.surnom}` : g.id;
    marker.innerHTML = `<span class="marker-tooltip">${label}</span>`;

    marker.addEventListener('click', () => openFiche(g.id));
    container.appendChild(marker);
  });
}

// ===================== TABS =====================

// Handle switching between the catalogue and plan views
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById('view-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ===================== FICHE DETAIL =====================

// Open the detail panel for a given graffiti ID
// @param {string} id — the graffiti ID (e.g. "GRF-001")
function openFiche(id) {
  const g = GRAFFITIS_DATA.find(x => x.id === id);
  if (!g) return;

  const content = document.getElementById('fiche-content');
  content.innerHTML = `
    <img class="fiche-photo" src="${g.photo}" alt="${g.surnom || g.id}"
         onerror="this.style.background='#1a1a1a'">
    <div class="fiche-id">${g.id}</div>
    <div class="fiche-surnom">${g.surnom || ''}</div>
    <div class="fiche-fields">
      ${field('Catégorie',   g.categorie)}
      ${field('Technique',   g.technique?.join(', '))}
      ${field('Couleur',     g.couleur?.join(', '))}
      ${field('Auteur',      g.auteur)}
      ${field('Date',        g.date)}
      ${field('Description', g.description)}
      ${field('Commentaire', g.commentaire)}
    </div>
    ${renderSimilaires(g)}
    ${svgButton(g)}
  `;

  document.getElementById('fiche').classList.remove('closed');
}

// Close the detail panel
function closeFiche() {
  document.getElementById('fiche').classList.add('closed');
}

// Build HTML for a single label/value field row
// @param {string} label — display label
// @param {string|null} value — field value, or null/empty if unknown
function field(label, value) {
  const empty = !value || value.toString().trim() === '';
  return `
    <div class="field">
      <span class="field-label">${label}</span>
      <span class="field-value ${empty ? 'empty' : ''}">${empty ? 'non renseigné' : value}</span>
    </div>
  `;
}

// ===================== SIMILAIRES =====================

// Build the "similar graffitis" section for a fiche
// Uses explicit similaires list if set; otherwise auto-suggests by same category
// @param {Object} g — the current graffiti object
function renderSimilaires(g) {
  let items = [];
  let title = '';

  if (g.similaires && g.similaires.length > 0) {
    // Manually curated links
    items = g.similaires.map(id => GRAFFITIS_DATA.find(x => x.id === id)).filter(Boolean);
    title = 'Graffitis similaires';
  } else if (g.categorie) {
    // Auto-suggest: same category, up to 6, excluding self
    items = GRAFFITIS_DATA
      .filter(x => x.id !== g.id && x.categorie === g.categorie)
      .slice(0, 6);
    title = 'Même catégorie';
  }

  if (items.length === 0) return '';

  return `
    <div class="similaires">
      <h3>${title}</h3>
      <div class="similaires-grid">
        ${items.map(s => `
          <div class="similaire-card" onclick="openFiche('${s.id}')">
            <img src="${s.photo}" alt="${s.id}" loading="lazy"
                 onerror="this.style.background='#1a1a1a'">
            <span>${s.id}${s.surnom ? ' — ' + s.surnom : ''}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ===================== SVG DOWNLOAD =====================

// Build the SVG download button HTML
// Button is disabled (greyed out) if no SVG file is associated
// @param {Object} g — the graffiti object
function svgButton(g) {
  if (g.svg) {
    return `<button class="btn-svg available" onclick="downloadSvg('${g.svg}', '${g.id}')">
      Télécharger SVG
    </button>`;
  }
  return `<button class="btn-svg" disabled>Télécharger SVG — à venir</button>`;
}

// Trigger a file download for an SVG asset
// @param {string} path — relative path to the SVG file
// @param {string} name — filename to use for the download
function downloadSvg(path, name) {
  const a = document.createElement('a');
  a.href = path;
  a.download = name + '.svg';
  a.click();
}
