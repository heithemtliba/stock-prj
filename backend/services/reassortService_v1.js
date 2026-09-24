// Coûts de transport par magasin et fréquence
const DEPOTS_CENTRAUX = ['001', '088'];
const DEPOTS_DONNEURS = ['001'];
const SAISONS_ACTUELLES = ['25H', '25E', '26E'];

const COUTS_TRANSPORT = {
  '002': { cout: 15, frequence: 'hebdomadaire' },  // MENZAH - Tunis: livraison 1x/semaine
  '005': { cout: 25, frequence: 'hebdomadaire' },  // JAMEL ABDENNACEUR - Tunis: livraison 1x/semaine
  '009': { cout: 40, frequence: 'bihebdomadaire' }, // SFAX A - Sfax: livraison 1x/2 semaines
  '032': { cout: 40, frequence: 'bihebdomadaire' }, // SFAX MALL - Sfax: livraison 1x/2 semaines
  '011': { cout: 30, frequence: 'bihebdomadaire' }, // NABEUL - Nabeul: livraison 1x/2 semaines
  '014': { cout: 20, frequence: 'hebdomadaire' },  // CARREFOUR - Tunis: livraison 1x/semaine
  '015': { cout: 20, frequence: 'hebdomadaire' },  // ZEPHYR - Tunis: livraison 1x/semaine
  '016': { cout: 20, frequence: 'hebdomadaire' },  // LAFAYETTE - Tunis: livraison 1x/semaine
  '019': { cout: 5, frequence: 'quotidienne' },   // E-Boutique - en ligne: livraison quotidienne
  '021': { cout: 20, frequence: 'hebdomadaire' },  // TUNISIA MALL - Tunis: livraison 1x/semaine
  '024': { cout: 20, frequence: 'hebdomadaire' },  // GEANT 3 - Tunis: livraison 1x/semaine
  '029': { cout: 25, frequence: 'bihebdomadaire' },  // SOUSSE - Sousse: livraison 1x/2 semaines
  '030': { cout: 20, frequence: 'hebdomadaire' },  // AZUR CITY - Tunis: livraison 1x/semaine
  '031': { cout: 20, frequence: 'hebdomadaire' },  // SOUKRA - Tunis: livraison 1x/semaine
  '033': { cout: 25, frequence: 'hebdomadaire' }   // LAC Premium - Tunis: livraison 1x/semaine
};

function getCoutTransport(storeId, quantite) {
  const info = COUTS_TRANSPORT[storeId] || { cout: 20, frequence: 'hebdomadaire' };
  return {
    cout: info.cout,
    frequence: info.frequence,
    coutUnitaire: info.cout / Math.max(1, quantite) // Coût par article pour éviter la division par zéro
  };
}

function optimiserRegroupements(suggestions) {
  // Regrouper les suggestions par destination pour optimiser les livraisons
  const suggestionsOptimisees = [];
  const destinations = new Map();
  
  // Analyser chaque suggestion
  suggestions.forEach(suggestion => {
    const destination = suggestion.versId;
    
    if (!destinations.has(destination)) {
      destinations.set(destination, {
        vers: suggestion.vers,
        versId: destination,
        articles: [],
        quantiteTotale: 0,
        donneurs: new Set(),
        coutTransportTotal: 0
      });
    }
    
    const group = destinations.get(destination);
    group.articles.push({
      reference: '', // Sera rempli par l'appelant
      quantite: suggestion.quantite,
      de: suggestion.de,
      deId: suggestion.deId,
      scoreDonneur: suggestion.scoreDonneur,
      scoreReceveur: suggestion.scoreReceveur
    });
    
    group.quantiteTotale += suggestion.quantite;
    group.donneurs.add(suggestion.deId);
    
    // Calculer le coût de transport pour cette suggestion
    const coutInfo = getCoutTransport(destination, suggestion.quantite);
    group.coutTransportTotal += coutInfo.cout;
  });
  
  // Convertir les groupes en suggestions optimisées
  destinations.forEach(group => {
    if (group.quantiteTotale > 0) {
      // Calculer le coût moyen de transport
      const coutMoyen = group.coutTransportTotal / group.quantiteTotale;
      
      suggestionsOptimisees.push({
        vers: group.vers,
        versId: group.versId,
        articles: group.articles,
        quantiteTotale: group.quantiteTotale,
        nombreDonneurs: group.donneurs.size,
        coutTransportTotal: group.coutTransportTotal,
        coutMoyenTransport: Math.round(coutMoyen * 100) / 100,
        frequenceLivraison: COUTS_TRANSPORT[group.versId]?.frequence || 'hebdomadaire',
        economiePotentielle: group.donneurs.size > 1 ? 
          (group.donneurs.size - 1) * 20 : 0 // Économie si regroupement possible
      });
    }
  });
  
  return suggestionsOptimisees;
}

function estSaisonActuelle(saison) {
  if (!saison) return false;
  return SAISONS_ACTUELLES.includes(saison.trim().toUpperCase());
}


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
  const bonusStatut = store.statut === 'DEPOT' ? 2.0 : (store.statut === 'OK' ? 1.2 : (store.statut === 'FAIBLE' ? 0.6 : 0.1));
  return Math.round(scoreSurplus * bonusStatut * coeffSaison * 100) / 100;
}

function calculerScoreStore(store, ventesParSemaine, saison) {
  const SAISONS_ACT = ['25H', '25E', '26E'];
  const coeffSaison = saison && SAISONS_ACT.includes(saison.trim().toUpperCase()) ? 1.5 : 1.0;
  
  // Score basé sur le statut et les jours de stock
  let urgence = 0;
  if (store.statut === 'CRITIQUE') {
    urgence = store.joursStock < 999 ? (1 / (store.joursStock + 1)) : 0.1;
  } else if (store.statut === 'FAIBLE') {
    urgence = store.joursStock < 999 ? (1 / (store.joursStock + 1)) * 0.5 : 0.05;
  } else if (store.statut === 'DEPOT') {
    urgence = 0; // Les dépôts ont un score de base de 0
  } else {
    urgence = 0.01; // Les magasins OK ont un score très faible
  }
  
  return Math.round(ventesParSemaine * urgence * coeffSaison * 100) / 100;
}

function getJoursExposition(joursExposition, storeId) {
  if (!joursExposition || typeof joursExposition !== 'object') return 999;
  const key = String(storeId);
  if (!Object.prototype.hasOwnProperty.call(joursExposition, key)) return 999;
  const n = Number(joursExposition[key]);
  return Number.isFinite(n) && n >= 0 ? n : 999;
}

function classerReassortGlobal(resultatAnalyse) {
  const boutiques = Array.isArray(resultatAnalyse?.analyse) ? resultatAnalyse.analyse : [];
  if (boutiques.some((store) => store?.statut === 'CRITIQUE')) return 'critique';
  if (boutiques.some((store) => store?.statut === 'FAIBLE')) return 'faible';
  return 'ok';
}

function analyserReassort(reference, stores, historiqueVentes, saison = null, soldes = false, joursExposition = {}) {
  const articleActuel = estSaisonActuelle(saison);

  // Seuils adaptés selon la période
  // Soldes : tout va vite, seuils plus courts mais standards
  // Normal : seuils standard
  const seuilCritique = soldes ? 7  : 14;
  const seuilFaible   = soldes ? 21 : 30;

  const analyse = stores
    .filter(store => !DEPOTS_CENTRAUX.includes(store.StoreId))
    .map(store => {
      const ventes = historiqueVentes.find(h => h.storeId === store.StoreId);
      const ventesParSemaine = ventes ? ventes.quantite : 0;

      // Stocks negatifs traites comme 0
      const stockBrut = parseFloat(store.AvailableQty);
      const stock = stockBrut < 0 ? 0 : stockBrut;

      const joursStock = ventesParSemaine > 0
        ? (stock / ventesParSemaine) * 7
        : 999;

      let statut = 'OK';
      if (ventesParSemaine >= 0.25) {
        if (joursStock < seuilCritique) statut = 'CRITIQUE';
        else if (joursStock < seuilFaible) statut = 'FAIBLE';
      }

      return {
        storeId: store.StoreId,
        storeName: store.StoreDescription,
        stock,
        stockBrut,
        ventesParSemaine: Math.round(ventesParSemaine * 100) / 100,
        joursStock: Math.round(joursStock),
        statut
      };
    });

  // Depot central
  const depotCentral = stores
    .filter(store => DEPOTS_DONNEURS.includes(store.StoreId))
    .map(store => {
      const stockBrut = parseFloat(store.AvailableQty);
      return {
        storeId: store.StoreId,
        storeName: store.StoreDescription,
        stock: stockBrut < 0 ? 0 : stockBrut,
        ventesParSemaine: 0,
        joursStock: 999,
        statut: 'DEPOT'
      };
    });

  // Receveurs : boutiques critiques ou faibles
  const receveurs = analyse
    .filter(s => (s.statut === 'CRITIQUE' || s.statut === 'FAIBLE') && s.ventesParSemaine >= 0.25)
    .sort((a, b) => {
      if (a.statut !== b.statut) return a.statut === 'CRITIQUE' ? -1 : 1;
      return b.ventesParSemaine - a.ventesParSemaine;
    });

  // Donneurs : depot central + boutiques excedentaires
  const donneursRaw = [
    ...depotCentral.filter(d => d.stock > 0),
    ...analyse
      .filter(s => s.stock > 0 && s.joursStock > seuilFaible)
      .sort((a, b) => a.ventesParSemaine - b.ventesParSemaine),
    ...analyse
      .filter(s => s.stock > 0 && s.ventesParSemaine === 0)
      .sort((a, b) => b.stock - a.stock)
  ];

  const donneurs = [];
  const dejaDonneur = new Set();
  for (const d of donneursRaw) {
    if (!dejaDonneur.has(d.storeId)) {
      donneurs.push({ ...d });
      dejaDonneur.add(d.storeId);
    }
  }

  const suggestions = [];

  receveurs.forEach(receveur => {
    // Objectif : 3 semaines pour CRITIQUE, 2 semaines pour FAIBLE
    const objectifSemaines = receveur.statut === 'CRITIQUE' ? 3 : 2;
    const qteNecessaire = Math.ceil(receveur.ventesParSemaine * objectifSemaines) - receveur.stock;
    if (qteNecessaire <= 0) return;

    let qteRestante = qteNecessaire;

    donneurs.forEach(donneur => {
      if (qteRestante <= 0) return;
      if (donneur.storeId === receveur.storeId) return;

      const stockMinimum = DEPOTS_DONNEURS.includes(donneur.storeId)
        ? 0
        : Math.ceil(donneur.ventesParSemaine * 2);

      const stockDisponible = donneur.stock - stockMinimum;
      if (stockDisponible <= 0) return;

      // Quantite = couvrir 2 semaines de ventes receveur, min 2, max stockDisponible
        const qteIdeal = Math.max(2, Math.ceil(receveur.ventesParSemaine * 2));
        const qteATransferer = Math.min(stockDisponible, Math.min(qteRestante, qteIdeal));

      if (qteATransferer > 0) {
          // Regle 7 jours exposition minimum
          const expoD = getJoursExposition(joursExposition, donneur.storeId);
          const expoR = getJoursExposition(joursExposition, receveur.storeId);
          if (expoD < 7) return;
          if (expoR < 7) return;
        const consigne = articleActuel
          ? 'Article saison actuelle - redistribuer ET commander si insuffisant'
          : 'Article ancienne saison - redistribuer uniquement, ne pas commander';

        // Calculer les scores individuels pour donneur et receveur
        const scoreDonneur = calculerScoreDonneur(donneur, donneur.ventesParSemaine, saison);
        const scoreReceveur = calculerScoreStore(receveur, receveur.ventesParSemaine, saison);

        suggestions.push({
          de: donneur.storeName,
          deId: donneur.storeId,
          vers: receveur.storeName,
          versId: receveur.storeId,
          quantite: qteATransferer,
          urgence: receveur.statut,
          consigne,
          raison: `${receveur.storeName} vend ${receveur.ventesParSemaine} u/sem - stock pour ${receveur.joursStock} jours`,
          scoreDonneur: scoreDonneur,
          scoreReceveur: scoreReceveur
        });
        donneur.stock -= qteATransferer;
        qteRestante -= qteATransferer;
      }
    });
  });

  const stockTotal = analyse.reduce((sum, s) => sum + s.stock, 0) +
    depotCentral.reduce((sum, s) => sum + s.stock, 0);

  return {
    reference,
    saison,
    articleActuel,
    stockTotal,
    ruptureGlobale: receveurs.length > 0 && stockTotal < receveurs.length,
    analyse,
    suggestions,  // Retour aux suggestions originales
    seuils: { critique: seuilCritique, faible: seuilFaible, soldes }
  };
}

module.exports = { analyserReassort, calculerScoreStore, optimiserRegroupements, classerReassortGlobal };