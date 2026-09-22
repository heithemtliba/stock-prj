require("dotenv").config();
const db = require("../config/database");
const cegid = require("../services/cegidService");

async function main() {
  // Pour chaque suggestion critique, calculer le detail par variante
  // Exemple: MENZAH -> AZUR CITY pour 22403
  const donneur  = "002"; // MENZAH
  const receveur = "030"; // AZUR CITY
  const codeArticle = "22403";
  
  const refs = db.prepare("SELECT DISTINCT reference_article, taille, couleur FROM ventes WHERE code_article = ?").all(codeArticle);
  console.log(`\nBON DE TRANSFERT: ${codeArticle} | ${donneur} -> ${receveur}`);
  console.log("=".repeat(60));
  
  let totalUnites = 0;
  for (const r of refs) {
    const result = await cegid.getStockByStore(r.reference_article);
    if (!result.success) continue;
    const stores = result.stores.AvailableQtyByStore || [];
    
    const stockDonneur  = stores.find(s => s.StoreId === donneur);
    const stockReceveur = stores.find(s => s.StoreId === receveur);
    
    const qtyD = stockDonneur  ? parseFloat(stockDonneur.AvailableQty)  : 0;
    const qtyR = stockReceveur ? parseFloat(stockReceveur.AvailableQty) : 0;
    
    // Transferer si donneur a du stock et receveur n'en a pas
    if (qtyD > 1) {
      const qteTransfert = Math.floor(qtyD / 2); // donner la moitie
      console.log(`EAN: ${r.reference_article} | Taille: ${r.taille} | Couleur: ${r.couleur}`);
      console.log(`  Stock ${donneur}: ${qtyD} | Stock ${receveur}: ${qtyR} | A transferer: ${qteTransfert}`);
      totalUnites += qteTransfert;
    }
  }
  console.log(`\nTOTAL A TRANSFERER: ${totalUnites} unites`);
}
main().catch(console.error);
