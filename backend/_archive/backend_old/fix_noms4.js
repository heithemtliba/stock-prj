const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Supprimer TOUTES les occurrences du bloc nomsArticles
const pattern = /\s*\/\/ Noms articles depuis table articles\s*\n\s*const codesUniques[\s\S]*?nomsArticles\[code\] = art \? art\.libelle[\s\S]*?''\;\s*\n\s*\}/g;
const before = (s.match(/const codesUniques/g)||[]).length;
s = s.replace(pattern, '');
const after = (s.match(/const codesUniques/g)||[]).length;
console.log('Blocs supprimes:', before - after, '| Restants:', after);

// Inserer UNE SEULE FOIS juste avant "const rapport = {"
// Chercher la premiere occurrence de "const rapport = {"
const bloc = `
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

// Remplacer toutes les occurrences de "const rapport = {"
s = s.replace(/const rapport = \{/g, bloc + 'const rapport = {');
console.log('Insertions:', (s.match(/const codesUniques/g)||[]).length);

fs.writeFileSync('server.js', s, 'utf8');
console.log('OK lignes:', s.split('\n').length);
