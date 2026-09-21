require("dotenv").config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const db = require('../config/database');
const { importQuotidien } = require('../services/autoImportVentes');

(async () => {
  try {
    console.log("🚀 Test import auto sur 2 jours (14-15 sept 2026)...\n");
    
    const result = await importQuotidien(db, {
      dateDebut: new Date('2026-09-14'),
      dateFin: new Date('2026-09-15')
    });
    
    console.log("\n✅ Résultat:", JSON.stringify(result, null, 2));
    
    // Vérifier ce qui a été importé
    const stats = db.prepare(`
      SELECT source, COUNT(*) as nb, SUM(quantite) as total
      FROM ventes
      WHERE date_vente >= '2026-09-14' AND date_vente <= '2026-09-15'
      GROUP BY source
    `).all();
    
    console.log("\n📊 Ventes par source:");
    stats.forEach(s => console.log(`  ${s.source}: ${s.nb} lignes, ${s.total} unités`));
    
  } catch (error) {
    console.error("❌ ERREUR:", error.message);
    console.error(error.stack);
  }
})();