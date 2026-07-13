const { analyserReassort } = require('./backend/services/reassortService');

// Simuler les données d'un article critique
const stores = [
  { StoreId: '001', StoreDescription: 'SITE CENTRALE', AvailableQty: 100 },
  { StoreId: '015', StoreDescription: 'ZEPHYR', AvailableQty: 0 },
  { StoreId: '002', StoreDescription: 'MENZAH', AvailableQty: 50 }
];

const historiqueVentes = [
  { storeId: '015', quantite: 13.25 },
  { storeId: '002', quantite: 2 }
];

const result = analyserReassort('TEST001', stores, historiqueVentes, '25H', true);

console.log('RÉSULTAT DE L\'ANALYSE:');
console.log('Stock total:', result.stockTotal);
console.log('Nombre de suggestions:', result.suggestions.length);

if (result.suggestions.length > 0) {
  const s = result.suggestions[0];
  console.log('\nPREMIÈRE SUGGESTION:');
  console.log('De:', s.de, '(', s.deId, ')');
  console.log('Vers:', s.vers, '(', s.versId, ')');
  console.log('Quantité:', s.quantite);
  console.log('Score donneur:', s.scoreDonneur);
  console.log('Score receveur:', s.scoreReceveur);
  console.log('Urgence:', s.urgence);
} else {
  console.log('AUCUNE SUGGESTION - Pourquoi ?');
  console.log('Receveurs trouvés:', result.analyse.filter(s => s.statut === 'CRITIQUE' || s.statut === 'FAIBLE').length);
  console.log('Donneurs disponibles:', result.analyse.filter(s => s.stock > 0).length);
}
