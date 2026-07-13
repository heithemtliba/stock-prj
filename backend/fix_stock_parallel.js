const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

const oldFn = `    const stockTotal = {};
    for (const { reference_article } of refs) {
      const result = await cegid.getStockByStore(reference_article);
      if (!result.success || !result.stores.AvailableQtyByStore) continue;
      for (const s of result.stores.AvailableQtyByStore) {
        const qty = parseFloat(s.AvailableQty) || 0;
        if (!stockTotal[s.StoreId]) {
          stockTotal[s.StoreId] = { storeId: s.StoreId, description: s.StoreDescription, stock: 0 };
        }
        stockTotal[s.StoreId].stock += qty;
      }
    }
    return Object.values(stockTotal);`;

const newFn = `    const stockTotal = {};
    // Paralleliser les appels EAN (max 5 simultanement)
    await asyncPool(5, refs, async ({ reference_article }) => {
      const result = await cegid.getStockByStore(reference_article);
      if (!result.success || !result.stores.AvailableQtyByStore) return;
      for (const st of result.stores.AvailableQtyByStore) {
        const qty = parseFloat(st.AvailableQty) || 0;
        if (!stockTotal[st.StoreId]) {
          stockTotal[st.StoreId] = { storeId: st.StoreId, description: st.StoreDescription, stock: 0 };
        }
        stockTotal[st.StoreId].stock += qty;
      }
    });
    return Object.values(stockTotal);`;

const count = (s.split(oldFn)).length - 1;
console.log('occurrences:', count);
s = s.split(oldFn).join(newFn);
fs.writeFileSync('server.js', s, 'utf8');
console.log('OK');
