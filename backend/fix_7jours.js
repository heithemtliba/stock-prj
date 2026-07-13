const fs = require('fs');

// === PATCH server.js ===
let sv = fs.readFileSync('server.js', 'utf8');

const oldCall = `      const ventesDB = ventesStmt.all(ref);
      const historiqueVentes = ventesDB.map(v => ({ storeId: v.store_id, quantite: v.total_vendu / semaines }));
      const stores = stockResult.stores.AvailableQtyByStore || [];
      const analyse = reassort.analyserReassort(ref, stores, historiqueVentes, article.saison, periode.soldes);`;

const newCall = `      const ventesDB = ventesStmt.all(ref);
      const historiqueVentes = ventesDB.map(v => ({ storeId: v.store_id, quantite: v.total_vendu / semaines }));
      const stores = stockResult.stores.AvailableQtyByStore || [];
      // Jours d'exposition par boutique (depuis premiere vente)
      const expoRows = db.prepare(\`
        SELECT store_id, CAST(julianday('now') - julianday(MIN(date_vente)) AS INTEGER) as jours
        FROM ventes WHERE code_article = ? GROUP BY store_id
      \`).all(article.code_article);
      const joursExposition = {};
      expoRows.forEach(r => joursExposition[r.store_id] = r.jours);
      const analyse = reassort.analyserReassort(ref, stores, historiqueVentes, article.saison, periode.soldes, joursExposition);`;

const count = (sv.split(oldCall)).length - 1;
console.log('server.js occurrences:', count);
sv = sv.split(oldCall).join(newCall);
fs.writeFileSync('server.js', sv, 'utf8');

// === PATCH reassortService.js ===
let rs = fs.readFileSync('./services/reassortService.js', 'utf8');

// Ajouter joursExposition comme parametre
rs = rs.replace(
  'function analyserReassort(reference, stores, historiqueVentes, saison = null, soldes = false)',
  'function analyserReassort(reference, stores, historiqueVentes, saison = null, soldes = false, joursExposition = {})'
);

// Ajouter filtre 7 jours avant suggestions.push
const oldPush = `        if (qteATransferer > 0) {
          const consigne = articleActuel`;

const newPush = `        if (qteATransferer > 0) {
          // Regle 7 jours : si donneur ou receveur expose depuis moins de 7 jours -> skip
          const expoD = joursExposition[donneur.storeId] || 0;
          const expoR = joursExposition[receveur.storeId] || 0;
          if (expoD < 7 || expoR < 7) return;
          const consigne = articleActuel`;

const countRS = (rs.split(oldPush)).length - 1;
console.log('reassortService.js occurrences:', countRS);
rs = rs.split(oldPush).join(newPush);
fs.writeFileSync('./services/reassortService.js', rs, 'utf8');
console.log('OK');
