const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

// 1. Trouver la ligne "const settled = await asyncPool"
let asyncPoolLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const settled = await asyncPool(concurrency, articles')) {
    asyncPoolLine = i;
    break;
  }
}
console.log('asyncPool ligne:', asyncPoolLine + 1);

// 2. Inserer le pre-calcul stock agrege AVANT asyncPool
const preload = [
  "  // Pre-calculer stock agrege par code article (evite double appel Cegid dans le loop)",
  "  const codesUniquesArticles = [...new Set(articles.map(a => a.code_article))];",
  "  const stockAgregeParCode = {};",
  "  await Promise.all(codesUniquesArticles.map(async (code) => {",
  "    try {",
  "      const stockList = await getStockByCodeArticle(code);",
  "      stockAgregeParCode[code] = {};",
  "      stockList.forEach(s => stockAgregeParCode[code][String(s.storeId)] = s.stock);",
  "    } catch(e) { stockAgregeParCode[code] = {}; }",
  "  }));",
  "  console.log('Stock pre-calcule pour', codesUniquesArticles.length, 'articles');"
];

lines.splice(asyncPoolLine, 0, ...preload);
asyncPoolLine += preload.length;

// 3. Dans le loop, remplacer le bloc double appel par utilisation du pre-calcul
for (let i = asyncPoolLine; i < lines.length; i++) {
  if (lines[i].includes("// Agr") && lines[i].includes("ger stock de tous les EAN")) {
    let end = i;
    while (end < lines.length && !lines[end].includes('}));') && end < i + 15) end++;
    console.log('Bloc double appel:', i+1, '->', end+1);
    const newBloc = [
      "      const storesRaw = stockResult.stores.AvailableQtyByStore || [];",
      "      // Utiliser stock pre-calcule (tous EAN agrege)",
      "      const stockAgr = stockAgregeParCode[article.code_article] || {};",
      "      const stores = storesRaw.map(s => ({",
      "        ...s,",
      "        AvailableQty: String(stockAgr[String(s.StoreId)] !== undefined",
      "          ? stockAgr[String(s.StoreId)]",
      "          : parseFloat(s.AvailableQty) || 0)",
      "      }));"
    ];
    lines.splice(i, end - i + 1, ...newBloc);
    console.log('Bloc remplace');
    break;
  }
}

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
