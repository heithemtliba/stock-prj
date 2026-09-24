const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Ajouter endpoint cache-clear apres la definition du cache
const cacheClearEndpoint = `
// Endpoint pour vider le cache
app.post('/cache-clear', (req, res) => {
  cache.clear();
  res.json({ success: true, message: 'Cache vide' });
});
app.get('/cache-clear', (req, res) => {
  cache.clear();
  res.json({ success: true, message: 'Cache vide' });
});

`;

// Inserer apres "function cacheSet"
s = s.replace(
  'function cacheSet(key, data) {\n  cache.set(key, { data, timestamp: Date.now() });\n}',
  'function cacheSet(key, data) {\n  cache.set(key, { data, timestamp: Date.now() });\n}' + cacheClearEndpoint
);

console.log('cache-clear:', s.includes("app.post('/cache-clear'"));
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK');
