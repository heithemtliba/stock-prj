const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

const calcNoms = `
      // Noms articles depuis table articles
      const codesUniques = [...new Set([
        ...donnees.critique.map(a => String(a.codeArticle)),
        ...donnees.faible.map(a => String(a.codeArticle)),
        ...articlesInactifs.map(a => String(a.code_article)),
        ...topArticles.map(a => String(a.code_article))
      ].filter(Boolean))];
      const nomsArticles = {};
      for (const code of codesUniques) {
        const art = db.prepare("SELECT libelle, famille FROM articles WHERE code_article = ?").get(code);
        nomsArticles[code] = art ? art.libelle + (art.famille ? ' - ' + art.famille : '') : '';
      }
`;

// Inserer le calcul avant "topArticles," (les deux occurrences)
let count = 0;
s = s.replace(/(\s+topArticles,\s+articlesInactifs)/g, (match) => {
  count++;
  return calcNoms + match;
});

// Ajouter nomsArticles dans le JSON retourne
s = s.replace(/scoresMagasins: calculerScoresMagasins\(donnees\),/g, 
  'nomsArticles,\n      scoresMagasins: calculerScoresMagasins(donnees),');

fs.writeFileSync('server.js', s, 'utf8');
console.log('Insertions:', count, '| nomsArticles dans JSON:', (s.match(/nomsArticles,/g)||[]).length);
