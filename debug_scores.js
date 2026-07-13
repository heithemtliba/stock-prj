const { calculerScoreStore } = require('./backend/services/reassortService');

// Test avec les données réelles
const storeDonneur = {
  storeId: '001',
  storeName: 'SITE CENTRALE',
  stock: 0,
  ventesParSemaine: 0,
  joursStock: 999,
  statut: 'DEPOT'
};

const storeReceveur = {
  storeId: '015',
  storeName: 'ZEPHYR',
  stock: 0,
  ventesParSemaine: 13.25,
  joursStock: 0,
  statut: 'CRITIQUE'
};

console.log('TEST DES SCORES:');
console.log('Score donneur (dépôt):', calculerScoreStore(storeDonneur, 0, '25H'));
console.log('Score receveur (critique):', calculerScoreStore(storeReceveur, 13.25, '25H'));

// Test avec un magasin normal
const storeNormal = {
  storeId: '002',
  storeName: 'MENZAH',
  stock: 5,
  ventesParSemaine: 2,
  joursStock: 17.5,
  statut: 'FAIBLE'
};

console.log('Score normal (faible):', calculerScoreStore(storeNormal, 2, '25H'));
