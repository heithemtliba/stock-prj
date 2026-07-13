const fs = require('fs');
let s = fs.readFileSync('./services/reassortService.js', 'utf8');

// === 1. CORRIGER calculerScoreStore pour le DONNEUR ===
// Ajouter une fonction separee pour le score donneur
const nouvelleFonction = `
// Score donneur : capacite a ceder du stock
// Bon donneur = beaucoup de stock + ventes faibles = score eleve
function calculerScoreDonneur(store, ventesParSemaine, saison) {
  const SAISONS_ACT = ['25H', '25E', '26E'];
  const coeffSaison = saison && SAISONS_ACT.includes(saison.trim().toUpperCase()) ? 1.0 : 0.7;
  // Surplus = stock au dela de 4 semaines de ventes
  const stockMinimal = ventesParSemaine * 4;
  const surplus = Math.max(0, store.stock - stockMinimal);
  // Score = surplus normalise * coefficient saison
  // Plus le surplus est grand, plus le donneur peut ceder
  const scoreSurplus = surplus > 0 ? Math.min(surplus / 10, 5) : 0;
  // Bonus si statut OK (boutique saine)
  const bonusStatut = store.statut === 'OK' ? 1.2 : (store.statut === 'FAIBLE' ? 0.8 : 0.3);
  return Math.round(scoreSurplus * bonusStatut * coeffSaison * 100) / 100;
}

`;

// Inserer avant calculerScoreStore
s = s.replace('function calculerScoreStore(store', nouvelleFonction + 'function calculerScoreStore(store');

// === 2. UTILISER calculerScoreDonneur pour le donneur ===
s = s.replace(
  'const scoreDonneur = calculerScoreStore(donneur, donneur.ventesParSemaine, saison);',
  'const scoreDonneur = calculerScoreDonneur(donneur, donneur.ventesParSemaine, saison);'
);

// === 3. CORRIGER LA QUANTITE SUGGEREE ===
// Actuellement : qteATransferer = Math.min(stockDisponible, qteRestante)
// Nouveau : couvrir 2 semaines de ventes du receveur, minimum 2 unites
s = s.replace(
  'const qteATransferer = Math.min(stockDisponible, qteRestante);',
  `// Quantite = couvrir 2 semaines de ventes receveur, min 2, max stockDisponible
        const qteIdeal = Math.max(2, Math.ceil(receveur.ventesParSemaine * 2));
        const qteATransferer = Math.min(stockDisponible, Math.min(qteRestante, qteIdeal));`
);

console.log('calculerScoreDonneur:', s.includes('function calculerScoreDonneur'));
console.log('scoreDonneur corrige:', s.includes('calculerScoreDonneur(donneur'));
console.log('qteIdeal:', s.includes('qteIdeal'));
fs.writeFileSync('./services/reassortService.js', s, 'utf8');
console.log('OK');
