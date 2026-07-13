require("dotenv").config();
const cegid = require("./services/cegidService");
const db = require("./config/database");

async function main() {
  // Recuperer tous les EAN de 22403 MELINA (article critique avec stock)
  const refs = db.prepare("SELECT DISTINCT reference_article FROM ventes WHERE code_article = '22403'").all();
  console.log("EANs 22403:", refs.length);
  
  // Pour chaque EAN, recuperer stock par boutique
  const stockParVariante = {};
  for (const r of refs) {
    const result = await cegid.getStockByStore(r.reference_article);
    if (!result.success) continue;
    const stores = result.stores.AvailableQtyByStore || [];
    const nonZero = stores.filter(s => parseFloat(s.AvailableQty) > 0);
    if (nonZero.length > 0) {
      stockParVariante[r.reference_article] = nonZero.map(s => ({
        storeId: s.StoreId,
        store: s.StoreDescription,
        qty: parseFloat(s.AvailableQty)
      }));
    }
  }
  
  // Afficher
  for (const [ean, stores] of Object.entries(stockParVariante)) {
    // Recuperer taille/couleur depuis ventes
    const info = db.prepare("SELECT taille, couleur FROM ventes WHERE reference_article = ? LIMIT 1").get(ean);
    console.log(`\nEAN ${ean} | Taille: ${info?.taille} | Couleur: ${info?.couleur}`);
    stores.forEach(s => console.log(`  ${s.storeId} ${s.store}: ${s.qty}`));
  }
}
main().catch(console.error);
