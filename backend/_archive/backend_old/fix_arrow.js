const fs = require('fs');
let s = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8');
const avant = (s.match(/\u2192/g)||[]).length;
s = s.split('\u2192').join('->');
const apres = (s.match(/\u2192/g)||[]).length;
console.log('Fleches remplacees:', avant - apres);
fs.writeFileSync('../scripts/exportRapportHebdo.py', s, 'utf8');
console.log('OK');
