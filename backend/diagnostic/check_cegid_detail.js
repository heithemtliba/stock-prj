// diagnostic/check_cegid_detail.js
// Usage : node check_cegid_detail.js 55840
//
// Affiche le detail Cegid (stock par boutique, taille, couleur) pour un code article,
// en interrogeant directement le SOAP Cegid (pas le chatbot).

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../config/database');
const cegid = require('../services/cegidService');

async function main() {
  const codeArticle = process.argv[2];
  if (!codeArticle) {
    console.error('Usage: node check_cegid_detail.js <codeArticle>');
    process.exit(1);
  }

  console.log(`\n=== Detail Cegid pour l'article ${codeArticle} ===\n`);

  // 1. Recuperer tous les EAN (references) connus pour ce code article, avec taille/couleur
  const refs = db.prepare(
    `SELECT DISTINCT reference_article, taille, couleur
     FROM ventes
     WHERE code_article = ? AND reference_article IS NOT NULL AND reference_article != ''`
  ).all(codeArticle);

  if (refs.length === 0) {
    console.log('Aucune reference (EAN) trouvee en base pour ce code article.');
    process.exit(0);
  }

  console.log(`${refs.length} reference(s) EAN trouvee(s) en base.\n`);

  // 2. Pour chaque EAN, interroger Cegid (stock par boutique)
  // rows[storeId] = { storeName, lignes: [{ean, taille, couleur, stock}] }
  const parBoutique = {};

  for (const r of refs) {
    const result = await cegid.getStockByStore(r.reference_article);
    if (!result.success) {
      console.log(`  [ERREUR] EAN ${r.reference_article} : ${result.message}`);
      continue;
    }
    const stores = result.stores?.AvailableQtyByStore || [];
    const storesArr = Array.isArray(stores) ? stores : [stores];

    for (const st of storesArr) {
      const stock = parseFloat(st.AvailableQty) || 0;
      if (stock <= 0) continue; // on n'affiche que ce qui a du stock
      const sid = st.StoreId;
      if (!parBoutique[sid]) {
        parBoutique[sid] = { storeName: st.StoreDescription, lignes: [] };
      }
      parBoutique[sid].lignes.push({
        ean: r.reference_article,
        taille: r.taille || '-',
        couleur: r.couleur || '-',
        stock
      });
    }
  }

  // 3. Affichage trie par boutique
  const boutiqueIds = Object.keys(parBoutique).sort();

  if (boutiqueIds.length === 0) {
    console.log('Aucun stock disponible (toutes boutiques a 0) pour cet article.');
    process.exit(0);
  }

  let totalGlobal = 0;

  for (const sid of boutiqueIds) {
    const b = parBoutique[sid];
    const totalBoutique = b.lignes.reduce((s, l) => s + l.stock, 0);
    totalGlobal += totalBoutique;

    console.log(`--- ${b.storeName} (${sid}) : ${totalBoutique} unite(s) ---`);
    // Trier par couleur puis taille pour lisibilite
    const lignesTriees = [...b.lignes].sort((a, c) => {
      if (a.couleur !== c.couleur) return a.couleur.localeCompare(c.couleur);
      return a.taille.localeCompare(c.taille);
    });
    for (const l of lignesTriees) {
      console.log(`   EAN ${l.ean}  | Taille: ${String(l.taille).padEnd(5)} | Couleur: ${String(l.couleur).padEnd(8)} | Stock: ${l.stock}`);
    }
    console.log('');
  }

  console.log(`=== TOTAL GLOBAL (toutes boutiques) : ${totalGlobal} unite(s) ===\n`);
}

main().catch(err => {
  console.error('Erreur script:', err.message);
  process.exit(1);
});