const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');
s = s.replace("app.get('/stock/:codeArticle'", "app.get('/stock-article/:codeArticle'");
fs.writeFileSync('server.js', s, 'utf8');
console.log('Done. Lignes:', s.split('\n').length);
