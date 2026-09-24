/**
 * ══════════════════════════════════════════════════════════════════════════
 * ARTICLE SYNC SERVICE — Synchronisation des articles depuis Cegid
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 1. Récupère les articles via ProductMerchandiseItemsService::GetListDetail
 * 2. Récupère les prix de vente via RetailSalesPriceEngine2Service::GetListDetail
 * 3. Upsert dans la table articles
 * ══════════════════════════════════════════════════════════════════════════
 */
require('dotenv').config();

const db = require('../config/database');
const cegid = require('./cegidService');

function getAllBarcodesFromDB() {
  return db.prepare(`
    SELECT DISTINCT reference_article as barcode
    FROM ventes
    WHERE reference_article IS NOT NULL
      AND TRIM(reference_article) != ''
      AND LENGTH(TRIM(reference_article)) >= 8
      AND LENGTH(TRIM(reference_article)) <= 18
  `).all()
    .map(r => String(r.barcode).trim())
    .filter(b => b.length >= 8 && b.length <= 18);
}

function normalizeArticle(item) {
  const rawId = item?.Identification?.Identifier?.Id || '';
  const cleanId = String(rawId).trim().split(/\s+/)[0] || '';
  const isClosed = item?.Closed === 'true' || item?.Closed === true;
  const isSuspended = item?.Characteristics?.Properties?.SalesSuspended === 'true';

  return {
    cegidId: cleanId,
    barcode: item?.Identification?.Identifier?.Barcode || '',
    libelle: item?.Description || '',
    libelleCompl: item?.Characteristics?.ComplementaryDescription || '',
    collection: item?.Characteristics?.Collections?.Current || '',
    fournisseur: item?.Characteristics?.MainSupplierId || '',
    famille: item?.Characteristics?.Categories?.Category?.[0]?.Id || '',
    closed: isClosed,
    status: item?.Status || '',
    salesSuspended: isSuspended,
    replenishmentExcluded: item?.Characteristics?.Properties?.ReplenishmentExcluded === 'true',
    inventoryManagement: item?.Characteristics?.Properties?.InventoryManagement === 'true',
    actif: (!isClosed && !isSuspended) ? 1 : 0,
    dateCreation: item?.SystemFields?.CreationDate || '',
    dateUpdateServer: item?.SystemFields?.ServerUpdateDate || '',
    dateUpdate: item?.SystemFields?.UpdateDate || ''
  };
}

async function syncArticlesFromCegid(options = {}) {
  const batchSize = Math.min(options.batchSize || 1000, 1000);
  const fields = options.fields || ['SystemFields', 'Characteristics'];

  console.log('[ARTICLE-SYNC] Début synchronisation...');

  const allBarcodes = getAllBarcodesFromDB();
  console.log(`[ARTICLE-SYNC] ${allBarcodes.length} barcodes à synchroniser`);

  if (allBarcodes.length === 0) {
    return { success: true, total: 0, imported: 0, updated: 0, errors: 0, skipped: 0 };
  }

  const batches = [];
  for (let i = 0; i < allBarcodes.length; i += batchSize) {
    batches.push(allBarcodes.slice(i, i + batchSize));
  }
  console.log(`[ARTICLE-SYNC] ${batches.length} lots de ${batchSize} max`);

  // Détecter si la colonne actif existe
  let hasActif = false;
  try {
    const cols = db.prepare("PRAGMA table_info(articles)").all();
    hasActif = cols.some(c => c.name === 'actif');
  } catch (e) { /* ignore */ }

  // Upsert avec ou sans la colonne actif
  const upsert = hasActif
    ? db.prepare(`
        INSERT INTO articles (code_article, libelle, famille, fournisseur, collection, prix_revient, prix_detail, actif)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code_article) DO UPDATE SET
          libelle = excluded.libelle,
          famille = excluded.famille,
          fournisseur = excluded.fournisseur,
          collection = excluded.collection,
          prix_detail = CASE WHEN excluded.prix_detail > 0 THEN excluded.prix_detail ELSE articles.prix_detail END,
          actif = excluded.actif
      `)
    : db.prepare(`
        INSERT INTO articles (code_article, libelle, famille, fournisseur, collection, prix_revient, prix_detail)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code_article) DO UPDATE SET
          libelle = excluded.libelle,
          famille = excluded.famille,
          fournisseur = excluded.fournisseur,
          collection = excluded.collection,
          prix_detail = CASE WHEN excluded.prix_detail > 0 THEN excluded.prix_detail ELSE articles.prix_detail END
      `);

  const exists = db.prepare('SELECT 1 FROM articles WHERE code_article = ?');
  const getPrices = db.prepare('SELECT prix_revient, prix_detail FROM articles WHERE code_article = ?');
  const getCodeFromVentes = db.prepare(`
    SELECT DISTINCT code_article FROM ventes
    WHERE reference_article = ? AND code_article IS NOT NULL AND code_article != ''
    LIMIT 1
  `);

  let imported = 0;
  let updated = 0;
  let errors = 0;
  let total = 0;
  let skipped = 0;
  let returnedTotal = 0;
  let pricesTotal = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`[ARTICLE-SYNC] Lot ${i + 1}/${batches.length} (${batch.length} barcodes)`);

    let result;
    try {
      result = await cegid.getArticlesList(batch, 'Barcodes', fields);
    } catch (err) {
      console.error(`[ARTICLE-SYNC] Exception lot ${i + 1}:`, err.message);
      errors += batch.length;
      continue;
    }

    if (!result.success) {
      console.error(`[ARTICLE-SYNC] Erreur lot ${i + 1}:`, result.message || 'inconnue');
      errors += batch.length;
      continue;
    }

    const returnedCount = result.articles?.length || 0;
    returnedTotal += returnedCount;

    // ═══ RÉCUPÉRATION DES PRIX DE VENTE ═══
    let pricesMap = {};
    if (returnedCount > 0) {
      const barcodesWithPrice = result.articles.filter(a => a.barcode).map(a => a.barcode);
      try {
        const priceResult = await cegid.getSalePrices(barcodesWithPrice, '001', null, false);
        if (priceResult.success) {
          priceResult.prices.forEach(p => {
            // On utilise Current (prix actuel avec promo) si > 0, sinon Base
            const prix = p.currentPrice > 0 ? p.currentPrice : p.basePrice;
            if (prix > 0) pricesMap[p.barcode] = prix;
          });
          pricesTotal += Object.keys(pricesMap).length;
          console.log(`[ARTICLE-SYNC] Lot ${i + 1} : ${Object.keys(pricesMap).length} prix récupérés`);
        } else {
          console.warn(`[ARTICLE-SYNC] Lot ${i + 1} : erreur récupération prix - ${priceResult.message}`);
        }
      } catch (e) {
        console.error(`[ARTICLE-SYNC] Lot ${i + 1} : exception prix -`, e.message);
      }
    }

    // ═══ TRAITEMENT DES ARTICLES ═══
    for (const art of result.articles || []) {
      const codeFromVentes = art.barcode ? getCodeFromVentes.get(art.barcode)?.code_article : null;
      const code = codeFromVentes || art.cegidId;

      if (!code || code.length < 3) { skipped++; continue; }
      if (/\s/.test(code)) { skipped++; continue; }

      total++;

      const existing = exists.get(code);

      try {
        const current = existing ? getPrices.get(code) : { prix_revient: 0, prix_detail: 0 };
        const prixDetailFromCegid = pricesMap[art.barcode] || 0;
        const prixDetailFinal = prixDetailFromCegid > 0 ? prixDetailFromCegid : (current?.prix_detail || 0);

        if (hasActif) {
          upsert.run(
            code,
            art.libelle,
            art.famille,
            art.fournisseur,
            art.collection,
            current?.prix_revient || 0,
            prixDetailFinal,
            art.actif ?? 1
          );
        } else {
          upsert.run(
            code,
            art.libelle,
            art.famille,
            art.fournisseur,
            art.collection,
            current?.prix_revient || 0,
            prixDetailFinal
          );
        }

        if (existing) updated++;
        else imported++;
      } catch (e) {
        errors++;
      }
    }
  }

  console.log(`[ARTICLE-SYNC] Terminé : ${imported} nouveaux, ${updated} mis à jour, ${errors} erreurs, ${skipped} skippés`);
  console.log(`[ARTICLE-SYNC] Prix récupérés : ${pricesTotal} / ${returnedTotal} articles Cegid`);

  return {
    success: true,
    total: allBarcodes.length,
    articlesReturned: returnedTotal,
    pricesFetched: pricesTotal,
    imported,
    updated,
    errors,
    skipped
  };
}

module.exports = { syncArticlesFromCegid, getAllBarcodesFromDB, normalizeArticle };