const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

// Trouver et corriger toutes les occurrences de stock_reel.get
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("stk_d = stock_reel.get(id_d")) {
    console.log("Ligne", i+1, ":", lines[i].trim());
    lines[i] = "        stk_d = bd.get('stock', 0) if bd else 0";
  }
  if (lines[i].includes("stk_r = stock_reel.get(id_r")) {
    console.log("Ligne", i+1, ":", lines[i].trim());
    lines[i] = "        stk_r = br.get('stock', 0) if br else 0";
  }
  // Ajouter quantite + filtre seuil avant bg = RED_BG
  if (lines[i].includes("bg    = RED_BG if row % 2 == 0 else \"FFCDD2\"")) {
    console.log("Ligne", i+1, ": ajout quantite + filtre seuil");
    lines[i] = "        quantite = s.get('quantite', 0)\n        if isinstance(quantite, (int, float)) and quantite < seuil:\n            continue\n        bg = RED_BG if row % 2 == 0 else \"FFCDD2\"";
  }
  // Meme chose pour feuille 3 (ORANGE)
  if (lines[i].includes("bg    = ORANGE_BG if row % 2 == 0 else \"FFE0B2\"")) {
    console.log("Ligne", i+1, ": ajout quantite + filtre seuil feuille3");
    lines[i] = "        quantite = s.get('quantite', 0)\n        if isinstance(quantite, (int, float)) and quantite < seuil:\n            continue\n        bg = ORANGE_BG if row % 2 == 0 else \"FFE0B2\"";
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK - lignes:', lines.length);
