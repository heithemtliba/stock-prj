const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('def recommandation_inactif')) {
    console.log('Fonction trouvee ligne', i+1);
    // Réécrire toute la fonction
    let end = i + 1;
    while (end < lines.length && (lines[end].startsWith('    ') || lines[end].trim() === '')) end++;
    console.log('Fin fonction ligne', end);
    
    const newFn = [
      "def recommandation_inactif(saison, stock, jours_sans_vente, ventes_sem, prix):",
      "    actuel = saison.strip().upper() in SAISONS_ACT",
      "    if '26' in saison.upper():",
      "        return ('NOUVEAU', 'Exposition insuffisante - laisser en rayon', '4472C4', 'D6E4F7')",
      "    if actuel:",
      "        if stock > 30 and jours_sans_vente > 7:",
      "            return ('!! URGENT', 'Regrouper dans boutiques fortes - verifier visibilite', RED_FG, RED_BG)",
      "        if stock > 10:",
      "            return ('>> SURVEILLER', 'Verifier visibilite / repositionner en boutique', ORANGE_FG, ORANGE_BG)",
      "        return ('OK', 'Stock faible - ecoulement naturel proche', GREEN_FG, GREEN_BG)",
      "    else:",
      "        if stock > 50:",
      "            return ('!! DEMARQUE URGENTE', 'Stock eleve ancienne saison - demarque immediate', RED_FG, RED_BG)",
      "        if stock > 20 and jours_sans_vente > 14:",
      "            return ('>> DEMARQUE', 'Envisager demarque - article en fin de cycle', ORANGE_FG, ORANGE_BG)",
      "        if stock > 0:",
      "            return ('~ LIQUIDATION', 'Laisser ecouler - ne pas reapprovisionner', '7B6000', 'FFF9C4')",
      "        return ('EPUISE', 'Stock nul - aucune action requise', '424242', 'F5F5F5')",
    ];
    
    lines.splice(i, end - i, ...newFn);
    console.log('Fonction reecrite', newFn.length, 'lignes');
    break;
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
