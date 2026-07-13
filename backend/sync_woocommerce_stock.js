require('dotenv').config();
const axios = require('axios');
const xml2js = require('xml2js');

// ── CONFIG CEGID ─────────────────────────────────────────────
const CEGID_URL = `${process.env.CEGID_BASE_URL}/Y2/ItemInventoryWcfService.svc`;
const NAMESPACE = 'http://www.cegid.fr/Retail/1.0';
const DB_ID = process.env.CEGID_DATABASE_ID;
const CEGID_AUTH = Buffer.from(`${process.env.CEGID_USERNAME}:${process.env.CEGID_PASSWORD}`).toString('base64');

// ── CONFIG WOOCOMMERCE ────────────────────────────────────────
const WOO_URL = process.env.WOO_BASE_URL;          // ex: https://mabrouk.tn
const WOO_KEY = process.env.WOO_CONSUMER_KEY;      // ck_xxx
const WOO_SECRET = process.env.WOO_CONSUMER_SECRET; // cs_xxx

// ── CONFIG SYNC ───────────────────────────────────────────────
const SEUIL = 4;               // Seuil de sécurité
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const BATCH_SIZE = 50;          // Nombre d'EAN par appel Cegid
const WOO_PER_PAGE = 100;       // Variations par page WooCommerce

// ─────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// Récupérer toutes les variations WooCommerce avec pagination
async function getAllVariations() {
  log('Récupération des variations WooCommerce...');
  const variations = [];
  let page = 1;

  while (true) {
    const res = await axios.get(`${WOO_URL}/wp-json/wc/v3/products`, {
      params: {
        type: 'variation',
        per_page: WOO_PER_PAGE,
        page,
        status: 'publish'
      },
      auth: { username: WOO_KEY, password: WOO_SECRET }
    });

    if (res.data.length === 0) break;

    for (const p of res.data) {
      if (p.sku && p.sku.toString().startsWith('619')) {
        variations.push({
          id: p.id,
          ean: p.sku.toString(),
          stockWoo: p.stock_quantity || 0,
          parentId: p.parent_id
        });
      }
    }

    log(`  Page ${page}: ${res.data.length} variations récupérées`);
    if (res.data.length < WOO_PER_PAGE) break;
    page++;
  }

  log(`Total variations avec EAN: ${variations.length}`);
  return variations;
}

// Récupérer toutes les variations depuis les produits parents
async function getAllVariationsFromParents() {
  log('Récupération des produits variables...');
  const allVariations = [];
  let page = 1;

  // Récupérer tous les produits parents
  const parents = [];
  while (true) {
    const res = await axios.get(`${WOO_URL}/wp-json/wc/v3/products`, {
      params: { type: 'variable', per_page: WOO_PER_PAGE, page, status: 'publish' },
      auth: { username: WOO_KEY, password: WOO_SECRET }
    });
    if (res.data.length === 0) break;
    parents.push(...res.data.map(p => ({ id: p.id, sku: p.sku })));
    if (res.data.length < WOO_PER_PAGE) break;
    page++;
  }

  log(`${parents.length} produits parents trouvés`);

  // Pour chaque parent, récupérer les variations
  for (const parent of parents) {
    try {
      const res = await axios.get(`${WOO_URL}/wp-json/wc/v3/products/${parent.id}/variations`, {
        params: { per_page: 100 },
        auth: { username: WOO_KEY, password: WOO_SECRET }
      });

      for (const v of res.data) {
        if (v.sku && v.sku.toString().startsWith('619')) {
          allVariations.push({
            id: v.id,
            ean: v.sku.toString(),
            stockWoo: v.stock_quantity || 0,
            parentId: parent.id,
            parentSku: parent.sku
          });
        }
      }
    } catch (e) {
      log(`  Erreur variations parent ${parent.id}: ${e.message}`);
    }
  }

  log(`Total variations avec EAN: ${allVariations.length}`);
  return allVariations;
}

// Interroger Cegid pour une liste d'EAN (batch)
async function getStockCegid(eans) {
  const itemIdentifiers = eans.map(ean =>
    `<tns:ItemIdentifier><tns:Reference>${ean}</tns:Reference></tns:ItemIdentifier>`
  ).join('\n');

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="${NAMESPACE}">
  <soap:Body>
    <tns:GetListItemInventoryDetailByStore>
      <tns:inventoryStoreItemDetailRequest>
        <tns:ItemIdentifiers>
          ${itemIdentifiers}
        </tns:ItemIdentifiers>
        <tns:WithStoreName>false</tns:WithStoreName>
        <tns:DetailSku>false</tns:DetailSku>
        <tns:OnlyAvailableStock>false</tns:OnlyAvailableStock>
      </tns:inventoryStoreItemDetailRequest>
      <tns:clientContext>
        <tns:DatabaseId>${DB_ID}</tns:DatabaseId>
      </tns:clientContext>
    </tns:GetListItemInventoryDetailByStore>
  </soap:Body>
</soap:Envelope>`;

  const res = await axios.post(CEGID_URL, soapBody, {
    headers: {
      Authorization: `Basic ${CEGID_AUTH}`,
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `${NAMESPACE}/IItemInventoryWcfService/GetListItemInventoryDetailByStore`
    },
    timeout: 30000
  });

  // Parser le XML de réponse
  const parsed = await xml2js.parseStringPromise(res.data, { explicitArray: false });
  const result = parsed['s:Envelope']['s:Body']
    ['GetListItemInventoryDetailByStoreResponse']
    ['GetListItemInventoryDetailByStoreResult'];

  const stockMap = {};

  if (!result || !result.InventoryDetailsByStore) return stockMap;

  let items = result.InventoryDetailsByStore.AvailableQtyByItemByStore;
  if (!Array.isArray(items)) items = [items];

  for (const item of items) {
    if (!item) continue;
    const itemCode = item.ItemCode;
    let totalStock = 0;

    if (item.StoresAvailableQty && item.StoresAvailableQty.StoreAvailableQty) {
      let stores = item.StoresAvailableQty.StoreAvailableQty;
      if (!Array.isArray(stores)) stores = [stores];
      for (const store of stores) {
        totalStock += parseFloat(store.AvailableQuantity || 0);
      }
    }

    // Appliquer le seuil
    const stockVendable = totalStock > SEUIL ? Math.floor(totalStock - SEUIL) : 0;
    stockMap[itemCode] = stockVendable;
  }

  return stockMap;
}

// Mettre à jour le stock d'une variation WooCommerce
async function updateVariationStock(parentId, variationId, stock) {
  await axios.put(
    `${WOO_URL}/wp-json/wc/v3/products/${parentId}/variations/${variationId}`,
    {
      stock_quantity: stock,
      manage_stock: true,
      in_stock: stock > 0
    },
    { auth: { username: WOO_KEY, password: WOO_SECRET } }
  );
}

// Fonction principale de sync
async function syncStock() {
  log('════════════════════════════════════════');
  log('Démarrage de la sync stock Cegid → WooCommerce');

  try {
    // 1. Récupérer toutes les variations WooCommerce
    const variations = await getAllVariationsFromParents();

    if (variations.length === 0) {
      log('Aucune variation trouvée — sync annulée');
      return;
    }

    // 2. Grouper les EAN par batch et interroger Cegid
    const eans = variations.map(v => v.ean);
    const stockMapGlobal = {};
    const eanToVariation = {};

    for (const v of variations) {
      eanToVariation[v.ean] = v;
    }

    log(`Interrogation Cegid en batches de ${BATCH_SIZE}...`);
    for (let i = 0; i < eans.length; i += BATCH_SIZE) {
      const batch = eans.slice(i, i + BATCH_SIZE);
      try {
        const stockMap = await getStockCegid(batch);
        Object.assign(stockMapGlobal, stockMap);
        log(`  Batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(eans.length/BATCH_SIZE)}: ${Object.keys(stockMap).length} articles reçus`);
      } catch (e) {
        log(`  Erreur batch: ${e.message}`);
      }
      // Pause entre les batches pour ne pas surcharger Cegid
      await new Promise(r => setTimeout(r, 500));
    }

    // 3. Mettre à jour WooCommerce uniquement si le stock a changé
    let updated = 0;
    let unchanged = 0;
    let notFound = 0;

    for (const variation of variations) {
      // Chercher dans stockMap par EAN (la réponse Cegid utilise ItemCode)
      // On essaie d'abord par EAN direct, sinon par ItemCode
      let stockCegid = stockMapGlobal[variation.ean];

      if (stockCegid === undefined) {
        notFound++;
        continue;
      }

      if (stockCegid === variation.stockWoo) {
        unchanged++;
        continue;
      }

      try {
        await updateVariationStock(variation.parentId, variation.id, stockCegid);
        updated++;
        if (updated % 10 === 0) {
          log(`  ${updated} variations mises à jour...`);
        }
      } catch (e) {
        log(`  Erreur update variation ${variation.id}: ${e.message}`);
      }

      // Petite pause pour ne pas surcharger WooCommerce
      await new Promise(r => setTimeout(r, 100));
    }

    log(`✅ Sync terminée:`);
    log(`   Mises à jour: ${updated}`);
    log(`   Inchangées:   ${unchanged}`);
    log(`   Non trouvées: ${notFound}`);

  } catch (e) {
    log(`❌ Erreur sync: ${e.message}`);
    console.error(e);
  }
}

// ── DÉMARRAGE ─────────────────────────────────────────────────
log('Script de sync stock démarré');
log(`Interval: ${INTERVAL_MS / 60000} minutes`);
log(`Seuil de sécurité: ${SEUIL} unités`);
log(`Batch Cegid: ${BATCH_SIZE} EAN par appel`);

// Première exécution immédiate
syncStock();

// Puis toutes les 15 minutes
setInterval(syncStock, INTERVAL_MS);