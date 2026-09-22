const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

// Trouver le bloc asyncPool et remplacer la construction des stores
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const stores = stockResult.stores.AvailableQtyByStore || [];') &&
      lines[i+1] && lines[i+1].includes('analyserReassort')) {
    console.log('Trouve ligne', i+1);
    // Remplacer stores par stock agrege sur tous les EAN de l article
    lines[i] = `      // Agréger stock de tous les EAN du code article
      const storesRaw = stockResult.stores.AvailableQtyByStore || [];
      // Recuperer stock agrege via getStockByCodeArticle (tous EAN)
      let stockAgrege = {};
      try {
        const stockList = await getStockByCodeArticle(article.code_article);
        stockList.forEach(s => stockAgrege[String(s.storeId)] = s.stock);
      } catch(e) {}
      // Construire stores avec stock agrege
      const stores = storesRaw.map(s => ({
        ...s,
        AvailableQty: String(stockAgrege[String(s.StoreId)] !== undefined 
          ? stockAgrege[String(s.StoreId)] 
          : parseFloat(s.AvailableQty) || 0)
      }));`;
    break;
  }
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
