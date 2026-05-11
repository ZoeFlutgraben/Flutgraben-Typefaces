// Graffiti database — edit this file to add or update entries
// Each entry represents one graffiti found in the Flutgraben building
//
// Available values:
//   categorie  → "texte" | "animal" | "humain" | "decoration" | "autre"
//   technique  → ["crayon"] | ["bombe"] | ["feutre"] | ["autre"]  (can combine)
//   couleur    → free text array, e.g. ["noir", "rouge"]
//   floor      → "floor_01" | "floor_02" | "floor_03"
//   plan_x / plan_y → percentage position on the building plan (0–100)
//   similaires → array of IDs, e.g. ["GRF-002", "GRF-003"]
//   photo      → relative path to the image file
//   svg        → relative path to SVG file, or null if not yet available

// Creates a graffiti entry with default values — only specify what differs from defaults
function graffiti(id, fields = {}) {
  return {
    id,
    surnom: "",
    auteur: null,
    date: null,
    categorie: "autre",
    couleur: [],
    technique: [],
    description: "",
    commentaire: null,
    photo: null,
    svg: null,
    floor: null,
    plan_x: null,
    plan_y: null,
    similaires: [],
    ...fields
  };
}

const GRAFFITIS_DATA = [
  graffiti("GRF-001", { surnom: "petit nuage", categorie: "animal", photo: "data/image/GRF_001/GRF_001_wall.png" }),
  graffiti("GRF-002", { surnom: "carre", categorie: "animal", photo: "data/image/GRF_002/GRF_002_wall.png" }),
 
];
