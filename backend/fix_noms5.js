const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Supprimer tous les blocs nomsArticles existants
s = s.replace(/\s*\/\/ Noms articles depuis table articles\s*\nconst codesUniques[\s\S]*?}\s*\n/g, '\n');
s = s.replace(/\s*\/\/ Noms articles depuis table articles\s*\n\s*const codesUniques[\s\S]*?}\s*\n/g, '\n');

console.log('Blocs restants:', (s.match(/const codesUniques/g)||[]).length);

// Ajouter une fonction globale apres ARTICLES_EXCLUS
const fonctionNoms = `
// Noms articles depuis table articles
function getNomArticle(db, code) {
  try {
    const art = db.prepare("SELECT libelle, famille FROM articles WHERE code_article = ?").get(code);
    return art ? art.libelle + (art.famille ? ' - ' + art.famille : '') : '';
  } catch(e) { return ''; }
}
function getNomsArticles(db, codes) {
  const noms = {};
  for (const code of codes) noms[code] = getNomArticle(db, code);
  return noms;
}

`;

s = s.replace('// ARTICLES EXCLUS', fonctionNoms + '// ARTICLES EXCLUS');

// Ajouter le calcul dans le rapport juste avant "const rapport = {"
const calcNoms = `
      const nomsArticles = getNomsArticles(db, [...new Set([
        ...donnees.critique.map(a => String(a.codeArticle)),
        ...donnees.faible.map(a => String(a.codeArticle)),
        ...articlesInactifs.map(a => String(a.code_article)),
        ...topArticles.map(a => String(a.code_article))
      ].filter(Boolean))]);
`;

s = s.replace(/const rapport = \{/g, calcNoms + 'const rapport = {');

console.log('nomsArticles occurrences:', (s.match(/const nomsArticles/g)||[]).length);
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK lignes:', s.split('\n').length);
