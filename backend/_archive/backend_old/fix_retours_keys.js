const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Corriger les cles dans analyseRetours
s = s.replace(
  'const analyseRetours = { retourStats, retourParBoutique, tauxRetour };',
  'const analyseRetours = { parArticle: retourStats, parBoutique: retourParBoutique, tauxRetour, total: db.prepare("SELECT COUNT(*) as nb, SUM(quantite) as total FROM retours").get() };'
);

const count = (s.match(/parArticle: retourStats/g)||[]).length;
console.log('Corrections:', count);
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK');
