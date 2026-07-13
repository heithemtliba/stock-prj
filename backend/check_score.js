// Simuler calculerScoreDonneur pour SITE CENTRALE
const store = { stock: 21, statut: 'DEPOT', joursStock: 999, storeId: '001' };
const ventesParSemaine = 0; // depot = 0 ventes
const saison = '26E';

const SAISONS_ACT = ['25H', '25E', '26E'];
const coeffSaison = SAISONS_ACT.includes(saison) ? 1.0 : 0.7;
const stockMinimal = ventesParSemaine * 4; // = 0
const surplus = Math.max(0, store.stock - stockMinimal); // = 21
const scoreSurplus = surplus > 0 ? Math.min(surplus / 10, 5) : 0; // = 2.1
const bonusStatut = store.statut === 'OK' ? 1.2 : (store.statut === 'FAIBLE' ? 0.8 : 0.3);
// DEPOT = 0.3 !! c est le probleme
const score = Math.round(scoreSurplus * bonusStatut * coeffSaison * 100) / 100;
console.log('surplus:', surplus);
console.log('scoreSurplus:', scoreSurplus);
console.log('bonusStatut:', bonusStatut, '(DEPOT = 0.3 -> trop faible!)');
console.log('score final:', score);
console.log('Score attendu pour depot avec 21 unites: devrait etre > 3');
