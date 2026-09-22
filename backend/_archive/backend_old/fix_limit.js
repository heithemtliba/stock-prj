const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Augmenter limit de 200 a 500 et concurrency de 8 a 15
s = s.replace(
  'const limit = toSafeInt(opts.limit, 200);',
  'const limit = toSafeInt(opts.limit, 500);'
);
s = s.replace(
  'const concurrency = toSafeInt(opts.concurrency, 8);',
  'const concurrency = toSafeInt(opts.concurrency, 15);'
);

// Augmenter le seuil minimum de ventes de 2 a 3
s = s.replace(
  'HAVING total >= 2',
  'HAVING total >= 3'
);

console.log('limit 500:', s.includes('toSafeInt(opts.limit, 500)'));
console.log('concurrency 15:', s.includes('toSafeInt(opts.concurrency, 15)'));
console.log('seuil 3:', (s.match(/HAVING total >= 3/g)||[]).length);
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK');
