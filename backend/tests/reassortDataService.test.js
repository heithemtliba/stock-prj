'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createArticleSalesReader,
  buildWeeklySalesHistory,
  assertCompleteStockFetch,
  buildArticleStores
} = require('../services/reassortDataService');
const reassort = require('../services/reassortService');

test('P0.3 lit les ventes par code_article et non par reference_article', () => {
  let preparedSql = '';
  let receivedCode = null;
  const db = {
    prepare(sql) {
      preparedSql = sql;
      return {
        all(codeArticle) {
          receivedCode = codeArticle;
          return [{ store_id: '009', total_vendu: 12 }];
        }
      };
    }
  };

  const readSales = createArticleSalesReader(db, 28);
  const rows = readSales('25001');

  assert.equal(receivedCode, '25001');
  assert.match(preparedSql, /WHERE\s+code_article\s*=\s*\?/i);
  assert.doesNotMatch(preparedSql, /WHERE\s+reference_article\s*=\s*\?/i);
  assert.deepEqual(rows, [{ store_id: '009', total_vendu: 12 }]);
});

test('P0.3 convertit les ventes article par boutique en rythme hebdomadaire', () => {
  const history = buildWeeklySalesHistory([
    { store_id: '009', total_vendu: 12 },
    { store_id: '029', total_vendu: 4 }
  ], 4);

  assert.deepEqual(history, [
    { storeId: '009', quantite: 3 },
    { storeId: '029', quantite: 1 }
  ]);
});

test('P0.3 refuse un stock Cegid partiel pour éviter de créer une fausse rupture', () => {
  assert.doesNotThrow(() => assertCompleteStockFetch(3, 3, '25001'));
  assert.throws(
    () => assertCompleteStockFetch(3, 2, '25001'),
    /Stock Cegid incomplet pour 25001: 2\/3 variante\(s\) récupérée\(s\)/
  );
});

test('P0.3 conserve le stock agrégé article et ajoute une boutique vendeuse à stock zéro', () => {
  const stores = buildArticleStores([
    { storeId: '001', description: 'Dépôt', stock: 20 },
    { storeId: '029', description: 'Sousse', stock: 7 }
  ], [
    { storeId: '009', quantite: 2 },
    { storeId: '029', quantite: 1 }
  ], {
    '009': 'Mabrouk Sfax'
  });

  assert.deepEqual(stores, [
    { StoreId: '001', StoreDescription: 'Dépôt', AvailableQty: '20' },
    { StoreId: '029', StoreDescription: 'Sousse', AvailableQty: '7' },
    { StoreId: '009', StoreDescription: 'Mabrouk Sfax', AvailableQty: '0' }
  ]);
});

test('P0.3 détecte une rupture sur les ventes de toutes les variantes du code_article', () => {
  const historiqueVentes = buildWeeklySalesHistory([
    // Ces 8 ventes peuvent provenir de plusieurs EAN du même code_article.
    { store_id: '009', total_vendu: 8 }
  ], 4);
  const stores = buildArticleStores([], historiqueVentes, { '009': 'Mabrouk Sfax' });

  const result = reassort.analyserReassort(
    'EAN_REPRESENTATIF',
    stores,
    historiqueVentes,
    '26E',
    false,
    { '009': 30 }
  );

  assert.equal(result.analyse.length, 1);
  assert.equal(result.analyse[0].storeId, '009');
  assert.equal(result.analyse[0].stock, 0);
  assert.equal(result.analyse[0].ventesParSemaine, 2);
  assert.equal(result.analyse[0].statut, 'CRITIQUE');
});
