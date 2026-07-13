require("dotenv").config();
const db = require("./config/database");
const cegid = require("./services/cegidService");

async function getStockByCodeArticle(codeArticle) {
  const refs = db.prepare(
    "SELECT DISTINCT reference_article FROM ventes WHERE code_article = ? AND reference_article IS NOT NULL"
  ).all(codeArticle);
  console.log("Refs:", refs.length);
  const stockTotal = {};
  for (const { reference_article } of refs) {
    const result = await cegid.getStockByStore(reference_article);
    if (!result.success || !result.stores.AvailableQtyByStore) continue;
    for (const s of result.stores.AvailableQtyByStore) {
      const qty = parseFloat(s.AvailableQty) || 0;
      if (!stockTotal[s.StoreId]) {
        stockTotal[s.StoreId] = { storeId: s.StoreId, description: s.StoreDescription, stock: 0 };
      }
      stockTotal[s.StoreId].stock += qty;
    }
  }
  return Object.values(stockTotal);
}

getStockByCodeArticle("22064").then(r => {
  console.log("Resultat:", r.length, "boutiques");
  r.forEach(b => console.log(" ", b.description, ":", b.stock));
}).catch(e => console.error("ERREUR:", e.message));
