require("dotenv").config();
const db = require("../config/database");

// Combien d EAN pour 22414
const refs = db.prepare("SELECT DISTINCT reference_article FROM ventes WHERE code_article = '22414'").all();
console.log("EANs 22414:", refs.length);
refs.forEach(r => console.log(" -", r.reference_article));

// Comparer avec stock total
const http = require('http');
http.get('http://localhost:3002/stock-article/22414', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    console.log("\nStock agrege par boutique:");
    j.stockParBoutique.filter(s => s.stock > 0).forEach(s => 
      console.log(` ${s.storeId} ${s.description}: ${s.stock}`)
    );
  });
});
