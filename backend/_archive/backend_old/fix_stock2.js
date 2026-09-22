const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

const calcStock = `      // Stock temps reel pre-calcule pour tous les articles du rapport
      const stockParArticle = {};
      for (const code of codesRapport) {
        try {
          const stockList = await getStockByCodeArticle(code);
          stockParArticle[code] = {};
          for (const st of stockList) stockParArticle[code][String(st.storeId)] = st.stock;
        } catch(e) { stockParArticle[code] = {}; }
      }`;

let inserted = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const nomsArticles = getNomsArticles')) {
    console.log('Ligne', i+1, ':', lines[i].trim());
    // Verifier si codesRapport existe avant
    const prevLines = lines.slice(Math.max(0,i-15), i).join('\n');
    const hasCodesRapport = prevLines.includes('codesRapport');
    console.log('codesRapport present avant:', hasCodesRapport);
    
    if (!hasCodesRapport) {
      // Ajouter codesRapport + calcul stock apres nomsArticles
      const closeIdx = lines.findIndex((l, j) => j > i && l.trim() === '});');
      // Inserer apres la ligne nomsArticles et sa fermeture
      lines.splice(i + 1, 0, calcStock);
      // Remplacer getNomsArticles pour utiliser codesRapport
      lines[i] = lines[i].replace(
        'getNomsArticles(db, [...new Set([',
        'getNomsArticles(db, (codesRapport = [...new Set(['
      );
    } else {
      lines.splice(i + 1, 0, calcStock);
    }
    inserted++;
    i += calcStock.split('\n').length;
    if (inserted >= 2) break;
  }
}

console.log('Insertions:', inserted);
fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK');
