require("dotenv").config();
const http = require('http');
http.get('http://localhost:3002/stock-article/22414', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const j = JSON.parse(d);
    console.log("Stock 22414 par boutique:");
    j.stockParBoutique.forEach(s => console.log(` ${s.storeId} ${s.description}: ${s.stock}`));
  });
});
