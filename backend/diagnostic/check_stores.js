require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const config = require('../config/cegid');

console.log(`Nombre de magasins dans config.stores : ${Object.keys(config.stores).length}`);
console.log("\nListe :");
Object.entries(config.stores).forEach(([id, nom]) => {
  console.log(`  ${id} : ${nom}`);
});