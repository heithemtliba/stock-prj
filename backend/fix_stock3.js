const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Remplacer le bloc casse par la version correcte
const old1 = `      const nomsArticles = getNomsArticles(db, (codesRapport = [...new Set([
      // Stock temps reel pre-calcule pour tous les articles du rapport
      const stockParArticle = {};
      for (const code of codesRapport) {
        try {
          const stockList = await getStockByCodeArticle(code);
          stockParArticle[code] = {};
          for (const st of stockList) stockParArticle[code][String(st.storeId)] = st.stock;
        } catch(e) { stockParArticle[code] = {}; }
      }
        ...donnees.critique.map(a => String(a.codeArticle)),
        ...donnees.faible.map(a => String(a.codeArticle)),
        ...articlesInactifs.map(a => String(a.code_article)),
        ...topArticles.map(a => String(a.code_article))
      ].filter(Boolean))]);`;

const new1 = `      const codesRapport = [...new Set([
        ...donnees.critique.map(a => String(a.codeArticle)),
        ...donnees.faible.map(a => String(a.codeArticle)),
        ...articlesInactifs.map(a => String(a.code_article)),
        ...topArticles.map(a => String(a.code_article))
      ].filter(Boolean))];
      const nomsArticles = getNomsArticles(db, codesRapport);
      const stockParArticle = {};
      for (const code of codesRapport) {
        try {
          const stockList = await getStockByCodeArticle(code);
          stockParArticle[code] = {};
          for (const st of stockList) stockParArticle[code][String(st.storeId)] = st.stock;
        } catch(e) { stockParArticle[code] = {}; }
      }`;

const count = (s.split(old1)).length - 1;
console.log('occurrences trouvees:', count);
s = s.split(old1).join(new1);
console.log('codesRapport apres:', (s.match(/const codesRapport/g)||[]).length);
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK lignes:', s.split('\n').length);
