const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

s = s.replace(
  "const limit = toSafeInt(req.query?.limit || process.env.RAPPORT_HEBDO_LIMIT, 50);",
  "const limit = toSafeInt(req.query?.limit || process.env.RAPPORT_HEBDO_LIMIT, 500);"
);
s = s.replace(
  "const concurrency = toSafeInt(req.query?.concurrency || process.env.RAPPORT_HEBDO_CONCURRENCY, 10);",
  "const concurrency = toSafeInt(req.query?.concurrency || process.env.RAPPORT_HEBDO_CONCURRENCY, 15);"
);

console.log('limit 500:', s.includes("RAPPORT_HEBDO_LIMIT, 500)"));
console.log('concurrency 15:', s.includes("RAPPORT_HEBDO_CONCURRENCY, 15)"));
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK');
