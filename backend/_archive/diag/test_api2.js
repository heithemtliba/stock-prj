require("dotenv").config();
const db = require("../config/database");
const c = require("../services/cegidService");

async function test() {
  // Trouver une reference EAN reelle de l article 22064
  const refs = db.prepare("SELECT DISTINCT reference_article FROM ventes WHERE code_article = ? AND reference_article IS NOT NULL LIMIT 5").all("22064");
  console.log("References EAN de 22064:", refs);

  if (refs.length > 0) {
    const ean = refs[0].reference_article;
    console.log("\nTest stock avec EAN:", ean);
    const stock = await c.getStockByStore(ean);
    console.log("Stock:", JSON.stringify(stock, null, 2));
  }
}

test();
