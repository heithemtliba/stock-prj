require("dotenv").config();
const db = require("./config/database");
const cegid = require("./services/cegidService");

async function debug() {
  const code = "22064";
  
  // Etape 1 : refs en DB
  const refs = db.prepare(
    "SELECT DISTINCT reference_article FROM ventes WHERE code_article = ? AND reference_article IS NOT NULL"
  ).all(code);
  console.log("Refs trouvees en DB:", refs.length, refs.slice(0,3));

  if (refs.length === 0) {
    console.log("PROBLEME : aucune reference en DB pour ce code !");
    // Verifier sans filtre NULL
    const refs2 = db.prepare("SELECT DISTINCT reference_article FROM ventes WHERE code_article = ? LIMIT 5").all(code);
    console.log("Sans filtre NULL:", refs2);
    return;
  }

  // Etape 2 : appel cegid pour 1 ref
  const ref = refs[0].reference_article;
  console.log("Test avec ref:", ref);
  const result = await cegid.getStockByStore(ref);
  console.log("Success:", result.success);
  console.log("AvailableQtyByStore:", result.stores?.AvailableQtyByStore?.length ?? "ABSENT");
  if (result.stores?.AvailableQtyByStore) {
    console.log("Exemple:", result.stores.AvailableQtyByStore[0]);
  }
}

debug().catch(console.error);
