const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

const calcBons = `
      // Bons de transfert detailles par variante (taille/couleur)
      const bonsTransfert = [];
      const suggestionsTraitees = new Set();
      for (const art of donnees.critique) {
        if (ARTICLES_EXCLUS.has(String(art.codeArticle))) continue;
        for (const sug of (art.suggestions || [])) {
          const key = art.codeArticle + '_' + sug.deId + '_' + sug.versId;
          if (suggestionsTraitees.has(key)) continue;
          suggestionsTraitees.add(key);
          try {
            const refs = db.prepare("SELECT DISTINCT reference_article, taille, couleur FROM ventes WHERE code_article = ? AND reference_article IS NOT NULL AND reference_article != ''").all(art.codeArticle);
            const lignes = [];
            for (const r of refs) {
              const result = await cegid.getStockByStore(r.reference_article);
              if (!result.success) continue;
              const stores = result.stores.AvailableQtyByStore || [];
              const stD = stores.find(s => s.StoreId === sug.deId);
              const stR = stores.find(s => s.StoreId === sug.versId);
              const qD = stD ? Math.max(0, parseFloat(stD.AvailableQty) || 0) : 0;
              const qR = stR ? Math.max(0, parseFloat(stR.AvailableQty) || 0) : 0;
              if (qD >= 1) {
                const qTransfert = Math.max(1, Math.floor(qD / 2));
                lignes.push({
                  ean: r.reference_article,
                  taille: r.taille || '',
                  couleur: r.couleur || '',
                  stockDonneur: qD,
                  stockReceveur: qR,
                  quantite: qTransfert
                });
              }
            }
            if (lignes.length > 0) {
              bonsTransfert.push({
                codeArticle: art.codeArticle,
                nomArticle: getNomsArticles(db, [String(art.codeArticle)])[String(art.codeArticle)] || '',
                saison: art.saison,
                donneur: sug.de,
                donneurId: sug.deId,
                receveur: sug.vers,
                receveurId: sug.versId,
                lignes,
                totalUnites: lignes.reduce((s, l) => s + l.quantite, 0)
              });
            }
          } catch(e) { /* skip */ }
        }
      }
`;

// Inserer avant "const rapport = {" (deux occurrences)
let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'const rapport = {' || lines[i].trim() === 'const rapport = {') {
    if (lines[i].trim() === 'const rapport = {') {
      lines.splice(i, 0, ...calcBons.split('\n'));
      count++;
      i += calcBons.split('\n').length + 1;
      if (count >= 2) break;
    }
  }
}

console.log('Insertions:', count);
fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
