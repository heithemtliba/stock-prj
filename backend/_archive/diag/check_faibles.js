require("dotenv").config();
const http = require('http');
http.get('http://localhost:3002/reassort-global', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    console.log('Faibles:', j.faible.length);
    j.faible.forEach(a => {
      console.log(`\n${a.codeArticle} ${a.saison} - suggestions: ${a.suggestions.length}`);
      a.suggestions.forEach(s => console.log(`  ${s.de} -> ${s.vers} | qte:${s.quantite} | scoreDonneur:${s.scoreDonneur}`));
    });
  });
});
