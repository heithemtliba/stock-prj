'use strict';
const { buildDetailedTransferLines } = require('./transferPlanService');

function trierSuggestionsParUrgence(art) {
  const analyseParStore = new Map((art.analyse || []).map(a => [String(a.storeId), a]));
  const rang = (s) => (s === 'CRITIQUE' ? 0 : s === 'FAIBLE' ? 1 : 2);
  const info = (sug) => analyseParStore.get(String(sug.versId)) || {};
  const jours = (i) => (Number.isFinite(i.joursStock) ? i.joursStock : 999);

  return [...(art.suggestions || [])].sort((a, b) => {
    const ia = info(a), ib = info(b);
    const ra = rang(ia.statut ?? a.urgence), rb = rang(ib.statut ?? b.urgence);
    if (ra !== rb) return ra - rb;
    if (jours(ia) !== jours(ib)) return jours(ia) - jours(ib);
    return (ib.ventesParSemaine || 0) - (ia.ventesParSemaine || 0);
  });
}

async function genererBonsTransfert({ db, donnees, refCache, logTag = 'BONS-TRANSFERT', deps }) {
  const { getStockByStoreCached, getNomsArticles, ARTICLES_EXCLUS } = deps;
  const bonsTransfert = [];
  const suggestionsTraitees = new Set();
  const donorLedger = new Map(); // `${donneurId}|${ean}` -> stock encore disponible
  let bonsProgress = 0;

  const seuilPour = (deId, versId) => {
    const touche = (ids) => ids.includes(deId) || ids.includes(versId);
    if (touche(['009', '032'])) return 8;
    if (touche(['029'])) return 5;
    if (touche(['011'])) return 5;
    return 1;
  };

  for (const art of donnees.critique) {
    const codeStr = String(art.codeArticle);
    if (ARTICLES_EXCLUS.has(codeStr)) continue;

    const nomArticle = getNomsArticles(db, [codeStr])[codeStr] || '';
    let refs = null;
    let nonServisEpuise = 0;
    let nonServisSeuil = 0;

    for (const sug of trierSuggestionsParUrgence(art)) {
      const key = art.codeArticle + '_' + sug.deId + '_' + sug.versId;
      if (suggestionsTraitees.has(key)) continue;
      suggestionsTraitees.add(key);
      bonsProgress++;
      if (bonsProgress % 20 === 0) console.log(`[${logTag}] suggestions traitées: ${bonsProgress}`);

      try {
        if (!refs) {
          refs = db.prepare(
            "SELECT DISTINCT reference_article, taille, couleur FROM ventes WHERE code_article = ? AND reference_article IS NOT NULL AND reference_article != ''"
          ).all(art.codeArticle);
        }

        const candidats = [];
        let donneurAvaitDuStock = false;

        for (const r of refs) {
          let result;
          try {
            result = await getStockByStoreCached(r.reference_article, refCache);
          } catch (e) {
            console.warn(`[${logTag}] Timeout/erreur ${r.reference_article}: ${e.message}`);
            continue;
          }
          if (!result.success) continue;

          const stores = result.stores.AvailableQtyByStore || [];
          const stD = stores.find(s => s.StoreId === sug.deId);
          const stR = stores.find(s => s.StoreId === sug.versId);
          const qD = stD ? Math.max(0, parseFloat(stD.AvailableQty) || 0) : 0;
          const qR = stR ? Math.max(0, parseFloat(stR.AvailableQty) || 0) : 0;
          if (qD < 1) continue;

          const ledgerKey = `${sug.deId}|${r.reference_article}`;
          if (!donorLedger.has(ledgerKey)) donorLedger.set(ledgerKey, qD);
          const restant = donorLedger.get(ledgerKey);
          donneurAvaitDuStock = true;
          if (restant < 1) continue;

          candidats.push({
            ean: r.reference_article,
            taille: r.taille || '',
            couleur: r.couleur || '',
            stockDonneur: qD,
            remainingDonneur: restant,
            stockReceveur: qR
          });
        }

        if (candidats.length === 0) {
          if (donneurAvaitDuStock) nonServisEpuise++;
          continue;
        }

        const allocation = buildDetailedTransferLines(candidats, sug.quantite);
        const lignes = allocation.lines;
        if (lignes.length === 0) continue;

        const totalBon = lignes.reduce((s, l) => s + l.quantite, 0);
        if (totalBon < seuilPour(sug.deId, sug.versId)) {
          nonServisSeuil++;
          continue;
        }

        for (const l of lignes) {
          const k = `${sug.deId}|${l.ean}`;
          donorLedger.set(k, Math.max(0, (donorLedger.get(k) ?? 0) - l.quantite));
        }

        bonsTransfert.push({
          codeArticle: art.codeArticle,
          nomArticle,
          saison: art.saison,
          donneur: sug.de,
          donneurId: sug.deId,
          receveur: sug.vers,
          receveurId: sug.versId,
          lignes,
          quantiteRecommandee: allocation.recommendedQuantity,
          quantiteNonAllouee: allocation.unallocatedQuantity,
          totalUnites: allocation.allocatedQuantity
        });
      } catch (e) { /* skip */ }
    }

    if (nonServisEpuise > 0) {
      console.log(`[${logTag}] Article ${art.codeArticle} : ${nonServisEpuise} receveurs non servis (stock épuisé)`);
    }
    if (nonServisSeuil > 0) {
      console.log(`[${logTag}] Article ${art.codeArticle} : ${nonServisSeuil} receveurs ignorés (sous seuil transport)`);
    }
  }

  return bonsTransfert;
}

module.exports = { genererBonsTransfert, trierSuggestionsParUrgence };