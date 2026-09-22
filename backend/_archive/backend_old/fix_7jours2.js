const fs = require('fs');

// === PATCH reassortService.js par ligne ===
let lines = fs.readFileSync('./services/reassortService.js', 'utf8').split('\n');

// 1. Ajouter joursExposition comme parametre
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function analyserReassort') && lines[i].includes('soldes = false')) {
    lines[i] = lines[i].replace('soldes = false)', 'soldes = false, joursExposition = {}');
    console.log('Parametre ajoute ligne', i+1);
    break;
  }
}

// 2. Ajouter filtre avant suggestions.push
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (qteATransferer > 0)')) {
    console.log('qteATransferer trouve ligne', i+1, ':', lines[i]);
    // Inserer filtre 7 jours apres l ouverture du if
    lines.splice(i+1, 0, 
      "          // Regle 7 jours exposition minimum",
      "          const expoD = joursExposition[String(donneur.storeId)] || 0;",
      "          const expoR = joursExposition[String(receveur.storeId)] || 0;",
      "          if (expoD > 0 && expoD < 7) return;",
      "          if (expoR > 0 && expoR < 7) return;"
    );
    break;
  }
}

fs.writeFileSync('./services/reassortService.js', lines.join('\n'), 'utf8');

// === PATCH server.js par ligne ===
lines = fs.readFileSync('server.js', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('historiqueVentes = ventesDB.map') && lines[i].includes('storeId')) {
    console.log('historiqueVentes trouve ligne', i+1);
    // Inserer calcul joursExposition apres cette ligne
    lines.splice(i+1, 0,
      "      const expoRows = db.prepare(`SELECT store_id, CAST(julianday('now') - julianday(MIN(date_vente)) AS INTEGER) as jours FROM ventes WHERE code_article = ? GROUP BY store_id`).all(article.code_article);",
      "      const joursExposition = {};",
      "      expoRows.forEach(r => joursExposition[r.store_id] = r.jours);"
    );
    break;
  }
}

// Passer joursExposition a analyserReassort
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('reassort.analyserReassort') && lines[i].includes('periode.soldes)')) {
    lines[i] = lines[i].replace('periode.soldes)', 'periode.soldes, joursExposition)');
    console.log('analyserReassort patche ligne', i+1);
    break;
  }
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK');
