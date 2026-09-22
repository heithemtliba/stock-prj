const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

const fonctionNoms = `// Noms articles depuis table articles
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

s = s.replace('const ARTICLES_EXCLUS', fonctionNoms + 'const ARTICLES_EXCLUS');
console.log('getNomsArticles inserted:', s.includes('function getNomsArticles'));
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK lignes:', s.split('\n').length);
