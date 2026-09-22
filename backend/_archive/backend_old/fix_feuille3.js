const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  // Trouver la ligne seuil dans feuille 3 (apres store_info des faibles)
  if (lines[i].includes('jours_r = br.get(') && 
      lines[i+1] && lines[i+1].includes("stk_d = max(0, stock_reel.get(id_d") &&
      lines[i-5] && lines[i-5].includes('faibles')) {
    console.log('Feuille 3 ligne', i+1);
  }
  
  // Chercher le filtre seuil dans feuille 3 sans calcul seuil
  if (lines[i].includes('quantite < seuil') && 
      lines[i-3] && !lines[i-3].includes('seuil_transfert')) {
    console.log('Filtre sans seuil ligne', i+1, ':', lines[i].trim());
    // Inserer calcul seuil avant
    lines.splice(i, 0, "        seuil = seuil_transfert(id_d, id_r)");
    console.log('seuil insere');
    break;
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
