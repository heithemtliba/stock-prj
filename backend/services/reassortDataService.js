'use strict';

function toPositiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function createArticleSalesReader(db, periodDays) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Une connexion SQLite avec prepare() est requise');
  }

  const days = Math.floor(toPositiveNumber(periodDays, 28));
  const stmt = db.prepare(`
    SELECT store_id, SUM(quantite) as total_vendu
    FROM ventes
    WHERE code_article = ?
    AND date_vente >= date('now', '-${days} days')
    GROUP BY store_id
  `);

  return function readArticleSalesByStore(codeArticle) {
    return stmt.all(codeArticle);
  };
}

function buildWeeklySalesHistory(rows, weeks) {
  const divisor = toPositiveNumber(weeks, 1);

  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const total = Number(row?.total_vendu);
      return {
        storeId: String(row?.store_id ?? ''),
        quantite: Number.isFinite(total) ? total / divisor : 0
      };
    })
    .filter((row) => row.storeId);
}

function assertCompleteStockFetch(referenceCount, successfulCount, codeArticle = '') {
  const expected = Number(referenceCount) || 0;
  const received = Number(successfulCount) || 0;

  if (expected > 0 && received !== expected) {
    const suffix = codeArticle ? ` pour ${codeArticle}` : '';
    throw new Error(
      `Stock Cegid incomplet${suffix}: ${received}/${expected} variante(s) récupérée(s)`
    );
  }
}

/**
 * Construit la liste de boutiques au niveau code_article.
 *
 * Le stock passe déjà par getStockByCodeArticle(), donc il représente la somme
 * de tous les EAN du modèle. On ajoute aussi les boutiques ayant des ventes mais
 * absentes de la réponse stock afin qu'un stock à zéro reste analysable.
 */
function buildArticleStores(stockRows, salesHistory, storeNames = {}) {
  const byStore = new Map();

  for (const row of Array.isArray(stockRows) ? stockRows : []) {
    const storeId = String(row?.storeId ?? '');
    if (!storeId) continue;

    const stock = Number(row?.stock);
    byStore.set(storeId, {
      StoreId: storeId,
      StoreDescription: row?.description || storeNames[storeId] || storeId,
      AvailableQty: String(Number.isFinite(stock) ? stock : 0)
    });
  }

  for (const sale of Array.isArray(salesHistory) ? salesHistory : []) {
    const storeId = String(sale?.storeId ?? '');
    if (!storeId || byStore.has(storeId)) continue;

    byStore.set(storeId, {
      StoreId: storeId,
      StoreDescription: storeNames[storeId] || storeId,
      AvailableQty: '0'
    });
  }

  return Array.from(byStore.values());
}

module.exports = {
  createArticleSalesReader,
  buildWeeklySalesHistory,
  assertCompleteStockFetch,
  buildArticleStores
};
