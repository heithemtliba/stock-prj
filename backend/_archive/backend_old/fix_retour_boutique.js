const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Corriger la requete retourParBoutique
const oldReq = `SELECT r.store_id,
               SUM(r.quantite) as total_retours,
               COUNT(DISTINCT r.code_article) as nb_articles
        FROM retours r
        GROUP BY r.store_id
        ORDER BY total_retours DESC`;

const newReq = `SELECT r.store_id,
               SUM(r.quantite) as total,
               COUNT(DISTINCT r.code_article) as nb_articles
        FROM retours r
        GROUP BY r.store_id
        ORDER BY total DESC`;

const count = (s.split(oldReq)).length - 1;
console.log('occurrences:', count);
s = s.split(oldReq).join(newReq);
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK');
