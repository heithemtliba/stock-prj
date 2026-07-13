const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Remplacer Promise.all par asyncPool pour le pre-calcul stock
s = s.replace(
  `  const stockAgregeParCode = {};
  await Promise.all(codesUniquesArticles.map(async (code) => {
    try {
      const stockList = await getStockByCodeArticle(code);
      stockAgregeParCode[code] = {};
      stockList.forEach(s => stockAgregeParCode[code][String(s.storeId)] = s.stock);
    } catch(e) { stockAgregeParCode[code] = {}; }
  }));`,
  `  const stockAgregeParCode = {};
  await asyncPool(concurrency, codesUniquesArticles, async (code) => {
    try {
      const stockList = await getStockByCodeArticle(code);
      stockAgregeParCode[code] = {};
      stockList.forEach(st => stockAgregeParCode[code][String(st.storeId)] = st.stock);
    } catch(e) { stockAgregeParCode[code] = {}; }
  });`
);

console.log('asyncPool preload:', s.includes('asyncPool(concurrency, codesUniquesArticles'));
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK');
