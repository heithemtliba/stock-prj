const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('expoRows.forEach(r => joursExposition[r.store_id] = r.jours)')) {
    console.log('Trouve ligne', i+1);
    // Inserer analyse et variables manquantes apres joursExposition
    lines.splice(i+1, 0,
      "      const stores = stockResult.stores.AvailableQtyByStore || [];",
      "      const analyse = reassort.analyserReassort(ref, stores, historiqueVentes, article.saison, periode.soldes, joursExposition);",
      "      const aCritique = analyse.analyse.some(s => s.statut === 'CRITIQUE');",
      "      const aFaible   = analyse.analyse.some(s => s.statut === 'FAIBLE');",
      "      const stockCentrale = stores.find(s => s.StoreId === '001');",
      "      const qteCentrale = stockCentrale ? parseFloat(stockCentrale.AvailableQty) : 0;",
      "      const ventesParSemaine = article.total / semaines;",
      "      const score = calculerScore(analyse.analyse, ventesParSemaine, article.saison);"
    );
    break;
  }
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
