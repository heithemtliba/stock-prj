require("dotenv").config();
const db = require("../config/database");
const c = require("../services/cegidService");

async function getStockByCodeArticle(codeArticle) {
  const refs = db.prepare(
    "SELECT DISTINCT reference_article FROM ventes WHERE code_article = ? AND reference_article IS NOT NULL"
  ).all(codeArticle);

  const stockTotal = {};

  for (const { reference_article } of refs) {
    const result = await c.getStockByStore(reference_article);
    if (!result.success || !result.stores.AvailableQtyByStore) continue;

    for (const s of result.stores.AvailableQtyByStore) {
      const qty = parseFloat(s.AvailableQty) || 0;
      if (!stockTotal[s.StoreId]) {
        stockTotal[s.StoreId] = { storeId: s.StoreId, description: s.StoreDescription, stock: 0 };
      }
      stockTotal[s.StoreId].stock += qty;
    }
  }

  return { codeArticle, refs: refs.length, stockParBoutique: Object.values(stockTotal) };
}

getStockByCodeArticle("22064").then(r => console.log(JSON.stringify(r, null, 2)));
