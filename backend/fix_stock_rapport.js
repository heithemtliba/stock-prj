const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Remplacer "const nomsArticles = getNomsArticles..." par version qui calcule aussi le stock
const oldNoms = `      const nomsArticles = getNomsArticles(db, [...new Set([
        ...donnees.critique.map(a => String(a.codeArticle)),
        ...donnees.faible.map(a => String(a.codeArticle)),
        ...articlesInactifs.map(a => String(a.code_article)),
        ...topArticles.map(a => String(a.code_article))
      ].filter(Boolean))]);`;

const newNoms = `      const codesRapport = [...new Set([
        ...donnees.critique.map(a => String(a.codeArticle)),
        ...donnees.faible.map(a => String(a.codeArticle)),
        ...articlesInactifs.map(a => String(a.code_article)),
        ...topArticles.map(a => String(a.code_article))
      ].filter(Boolean))];
      const nomsArticles = getNomsArticles(db, codesRapport);
      // Stock temps reel pour tous les articles du rapport
      const stockParArticle = {};
      for (const code of codesRapport) {
        try {
          const stockList = await getStockByCodeArticle(code);
          stockParArticle[code] = {};
          for (const s of stockList) stockParArticle[code][String(s.storeId)] = s.stock;
        } catch(e) { stockParArticle[code] = {}; }
      }`;

const count = (s.match(/const nomsArticles = getNomsArticles/g)||[]).length;
console.log('occurrences:', count);
s = s.replace(/const nomsArticles = getNomsArticles\(db, \[\.\.\.new Set\(\[[\s\S]*?\]\)]\);/g, newNoms);
console.log('apres:', (s.match(/const stockParArticle/g)||[]).length);

// Ajouter stockParArticle dans le JSON rapport
s = s.replace(/nomsArticles,\s*\n(\s*)scoresMagasins/g, 'nomsArticles,\n$1stockParArticle,\n$1scoresMagasins');

fs.writeFileSync('server.js', s, 'utf8');
console.log('OK lignes:', s.split('\n').length);
