const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');
let count = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('nomsArticles,') && lines[i+1] && !lines[i+1].includes('prixArticles')) {
    console.log('Ligne', i+1, ':', lines[i].trim(), '| suivante:', lines[i+1].trim());
    lines.splice(i+1, 0, lines[i].replace('nomsArticles,', 'prixArticles,'));
    count++;
    i++; // skip la ligne inseree
  }
}
console.log('Insertions:', count);
fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log('OK');
