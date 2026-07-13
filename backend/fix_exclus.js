const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Filtrer articles exclus au moment du push dans resultats
s = s.replace(
  "if (v.type === 'critique') resultats.critique.push(v.item);",
  "if (v.type === 'critique' && !ARTICLES_EXCLUS.has(String(v.item?.codeArticle))) resultats.critique.push(v.item);"
);
s = s.replace(
  "else if (v.type === 'faible') resultats.faible.push(v.item);",
  "else if (v.type === 'faible' && !ARTICLES_EXCLUS.has(String(v.item?.codeArticle))) resultats.faible.push(v.item);"
);

// Aussi pour la deuxieme route
s = s.replace(
  "if (aCritique) resultats.critique.push(item);",
  "if (aCritique && !ARTICLES_EXCLUS.has(String(item.codeArticle))) resultats.critique.push(item);"
);
s = s.replace(
  "else if (aFaible) resultats.faible.push(item);",
  "else if (aFaible && !ARTICLES_EXCLUS.has(String(item.codeArticle))) resultats.faible.push(item);"
);

console.log('Fix applique');
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK');
