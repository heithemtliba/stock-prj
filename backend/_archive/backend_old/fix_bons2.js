const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Ajouter bonsTransfert dans le JSON rapport
s = s.replace(
  /nomsArticles,\s*\n(\s*)prixArticles,/g,
  'nomsArticles,\n$1prixArticles,\n$1bonsTransfert,'
);

console.log('bonsTransfert dans JSON:', (s.match(/bonsTransfert,/g)||[]).length);
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK');
