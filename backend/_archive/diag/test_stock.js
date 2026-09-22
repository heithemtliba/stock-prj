const c = require('../services/cegidService');

async function test() {
  try {
    console.log('Test getStockByStore pour article 22064...');
    const r1 = await c.getStockByStore('22064');
    console.log('getStockByStore:', JSON.stringify(r1, null, 2));
  } catch(e) { console.log('getStockByStore erreur:', e.message); }

  try {
    console.log('Test getStockAllStores...');
    const r2 = await c.getStockAllStores('22064');
    console.log('getStockAllStores:', JSON.stringify(r2, null, 2));
  } catch(e) { console.log('getStockAllStores erreur:', e.message); }
}

test();
