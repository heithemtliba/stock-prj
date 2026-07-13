// ---------------------------------------------------------------
// PATCH 1 — ENDPOINT STOCK TEMPS REEL PAR CODE ARTICLE
// A inserer AVANT la ligne : const PORT = process.env.PORT
// ---------------------------------------------------------------

// Articles a exclure (sacs d emballage)
const ARTICLES_EXCLUS = new Set(["91272", "91273", "91274"]);

// Fonction stock par code article (agrege tous les EAN)
async function getStockByCodeArticle(codeArticle) {
  const db = require("./config/database");
  const refs = db.prepare(
    "SELECT DISTINCT reference_article FROM ventes WHERE code_article = ? AND reference_article IS NOT NULL"
  ).all(codeArticle);
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

app.get("/stock/:codeArticle", async (req, res) => {
  try {
    const code = req.params.codeArticle;
    const cacheKey = `stock_${code}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const stockParBoutique = await getStockByCodeArticle(code);
    const result = { success: true, codeArticle: code, stockParBoutique };
    cacheSet(cacheKey, result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
