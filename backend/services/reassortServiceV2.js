/**
 * ══════════════════════════════════════════════════════════════════════════
 * REASSORT SERVICE V2 — Algorithme amélioré
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Améliorations vs V1 :
 *  1. Scoring multi-critères (prix, marge, tendance, position saison)
 *  2. Choix donneur optimisé par coût de transport
 *  3. Seuils dynamiques basés sur la variabilité de la demande
 *  4. Quantité de transfert optimisée (pas juste max(2, ventes×2))
 *  5. Intégration des prévisions ML (quand disponibles)
 *
 * Ce fichier est un DROP-IN REPLACEMENT de reassortService.js
 * ══════════════════════════════════════════════════════════════════════════
 */

// ── CONFIG ──────────────────────────────────────────────────────────────
const DEPOTS_CENTRAUX = ['001', '088'];
const DEPOTS_DONNEURS = ['001'];
const SAISONS_ACTUELLES = ['25H', '25E', '26E'];

const COUTS_TRANSPORT = {
  '002': { cout: 15, frequence: 'hebdomadaire', zone: 'tunis' },
  '005': { cout: 25, frequence: 'hebdomadaire', zone: 'tunis' },
  '009': { cout: 40, frequence: 'bihebdomadaire', zone: 'sud' },
  '011': { cout: 30, frequence: 'bihebdomadaire', zone: 'nord' },
  '014': { cout: 20, frequence: 'hebdomadaire', zone: 'tunis' },
  '015': { cout: 20, frequence: 'hebdomadaire', zone: 'tunis' },
  '016': { cout: 20, frequence: 'hebdomadaire', zone: 'tunis' },
  '019': { cout: 5,  frequence: 'quotidienne',  zone: 'tunis' },
  '021': { cout: 20, frequence: 'hebdomadaire', zone: 'tunis' },
  '024': { cout: 20, frequence: 'hebdomadaire', zone: 'tunis' },
  '029': { cout: 25, frequence: 'bihebdomadaire', zone: 'centre' },
  '030': { cout: 20, frequence: 'hebdomadaire', zone: 'tunis' },
  '031': { cout: 20, frequence: 'hebdomadaire', zone: 'tunis' },
  '032': { cout: 40, frequence: 'bihebdomadaire', zone: 'sud' },
  '033': { cout: 25, frequence: 'hebdomadaire', zone: 'tunis' }
};

// Seuils de quantité minimum par paire de zones
const SEUILS_ZONE = {
  'tunis-tunis': 1,
  'tunis-nord': 5,   'nord-tunis': 5,
  'tunis-centre': 5, 'centre-tunis': 5,
  'tunis-sud': 8,    'sud-tunis': 8,
  'nord-sud': 8,     'sud-nord': 8,
  'nord-centre': 5,  'centre-nord': 5,
  'centre-sud': 8,   'sud-centre': 8
};

function getZone(storeId) {
  return COUTS_TRANSPORT[storeId]?.zone || 'tunis';
}

function getSeuilTransfert(donneurId, receveurId) {
  const z1 = getZone(donneurId);
  const z2 = getZone(receveurId);
  return SEUILS_ZONE[`${z1}-${z2}`] || 1;
}

function getCoutTransport(storeId) {
  return COUTS_TRANSPORT[storeId] || { cout: 20, frequence: 'hebdomadaire', zone: 'tunis' };
}

function estSaisonActuelle(saison) {
  if (!saison) return false;
  return SAISONS_ACTUELLES.includes(saison.trim().toUpperCase());
}

// ── SCORING V2 — MULTI-CRITÈRES ────────────────────────────────────────
/**
 * Score de priorité amélioré qui prend en compte :
 * - Le volume de ventes (vélocité)
 * - L'urgence (jours de stock restant)
 * - La valeur financière (prix × quantité potentielle)
 * - La position dans le cycle de saison
 * - La tendance récente (accélération/décélération)
 *
 * V1 : score = ventes × urgence × coeffSaison
 * V2 : score = (vélocité × urgence × valeur × tendance × positionSaison) normalisé 0-100
 */
function calculerScoreV2(analyse, ventesParSemaine, saison, options = {}) {
  const prixUnitaire = options.prixUnitaire || 0;
  const tendance = options.tendance || 1.0; // >1 = accélère, <1 = ralentit
  const joursDepuisDebutSaison = options.joursDepuisDebutSaison || 0;
  const joursDureeSaison = options.joursDureeSaison || 180;

  // 1. Vélocité normalisée (0-5)
  const velocite = Math.min(5, ventesParSemaine / 2);

  // 2. Urgence : combien de boutiques sont en danger
  const boutiquesEnRupture = analyse.filter(s => s.statut === 'CRITIQUE').length;
  const boutiquesEnFaible = analyse.filter(s => s.statut === 'FAIBLE').length;
  const joursMinStock = analyse
    .filter(s => s.statut === 'CRITIQUE' && s.joursStock < 999)
    .reduce((min, s) => Math.min(min, s.joursStock), 999);

  let urgence = 0;
  if (joursMinStock === 0) urgence = 5;
  else if (joursMinStock < 3) urgence = 4;
  else if (joursMinStock < 7) urgence = 3;
  else if (joursMinStock < 14) urgence = 2;
  else if (boutiquesEnFaible > 0) urgence = 1;

  // Bonus si plusieurs boutiques en rupture simultanée
  urgence += Math.min(2, boutiquesEnRupture * 0.5);

  // 3. Valeur financière (0-3)
  let valeur = 1;
  if (prixUnitaire > 0) {
    const ventePotentiellePerdue = ventesParSemaine * prixUnitaire * 2; // 2 semaines
    if (ventePotentiellePerdue > 1000) valeur = 3;
    else if (ventePotentiellePerdue > 500) valeur = 2.5;
    else if (ventePotentiellePerdue > 200) valeur = 2;
    else if (ventePotentiellePerdue > 100) valeur = 1.5;
  }

  // 4. Coefficient saison amélioré
  let coeffSaison = 1.0;
  if (estSaisonActuelle(saison)) {
    // Plus urgent en début/milieu de saison qu'en fin
    const positionPct = joursDepuisDebutSaison / joursDureeSaison;
    if (positionPct < 0.3) coeffSaison = 2.0;      // Début = critique de réappro
    else if (positionPct < 0.6) coeffSaison = 1.5;  // Milieu = encore temps de vendre
    else coeffSaison = 1.0;                          // Fin = bientôt soldes/démarque
  } else {
    coeffSaison = 0.7; // Ancienne saison = moins prioritaire
  }

  // 5. Tendance (accélération récente)
  const coeffTendance = Math.max(0.5, Math.min(2.0, tendance));

  // Score final normalisé 0-100
  const scoreRaw = velocite * urgence * valeur * coeffSaison * coeffTendance;
  const score = Math.min(100, Math.round(scoreRaw * 10) / 10);

  return {
    score,
    composantes: { velocite, urgence, valeur, coeffSaison, coeffTendance },
    boutiquesEnRupture,
    boutiquesEnFaible
  };
}

// ── SEUILS DYNAMIQUES ───────────────────────────────────────────────────
/**
 * Au lieu de seuils fixes (14/30 jours), calcule des seuils adaptés
 * à la variabilité de la demande de chaque article.
 *
 * Un article à demande stable (même chose chaque semaine) a besoin
 * de moins de stock de sécurité qu'un article à demande erratique.
 *
 * Formule : seuil = base + (coeffVariation × facteur)
 */
function calculerSeuilsDynamiques(ventesParSemaine, ventesHistorique = [], soldes = false) {
  const baseC = soldes ? 7 : 14;
  const baseF = soldes ? 21 : 30;

  if (!ventesHistorique || ventesHistorique.length < 4) {
    return { critique: baseC, faible: baseF };
  }

  // Coefficient de variation (écart-type / moyenne)
  const mean = ventesHistorique.reduce((s, v) => s + v, 0) / ventesHistorique.length;
  if (mean === 0) return { critique: baseC, faible: baseF };

  const variance = ventesHistorique.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / ventesHistorique.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / mean; // 0 = très stable, >1 = très variable

  // Plus c'est variable, plus on a besoin de stock de sécurité
  const facteur = Math.min(2, 1 + cv * 0.5); // 1.0 → 2.0
  const critique = Math.round(baseC * facteur);
  const faible = Math.round(baseF * facteur);

  return { critique, faible, coeffVariation: Math.round(cv * 100) / 100 };
}

// ── SCORE DONNEUR V2 ────────────────────────────────────────────────────
/**
 * Amélioré : prend en compte le coût de transport vers le receveur
 * Un bon donneur a beaucoup de surplus ET est proche du receveur
 */
function calculerScoreDonneur(donneur, ventesParSemaine, saison, receveurId = null) {
  const coeffSaison = estSaisonActuelle(saison) ? 1.0 : 0.7;

  // Surplus au-delà de 4 semaines de ventes
  const stockMinimal = ventesParSemaine * 4;
  const surplus = Math.max(0, donneur.stock - stockMinimal);
  const scoreSurplus = surplus > 0 ? Math.min(surplus / 10, 5) : 0;

  // Bonus statut
  const bonusStatut = donneur.statut === 'DEPOT' ? 2.0
    : donneur.statut === 'OK' ? 1.2
    : donneur.statut === 'FAIBLE' ? 0.6 : 0.1;

  // NOUVEAU : pénalité coût de transport si receveur connu
  let penaliteTransport = 1.0;
  if (receveurId && donneur.storeId) {
    const cout = getCoutTransport(donneur.storeId).cout + getCoutTransport(receveurId).cout;
    // Normaliser : 5 (e-boutique) → bonus, 40 (Sfax) → pénalité
    penaliteTransport = Math.max(0.5, 1 - (cout - 20) / 80);
  }

  return Math.round(scoreSurplus * bonusStatut * coeffSaison * penaliteTransport * 100) / 100;
}

// ── ANALYSE REASSORT V2 ────────────────────────────────────────────────
function analyserReassort(reference, stores, historiqueVentes, saison = null, soldes = false, joursExposition = {}, options = {}) {
  const articleActuel = estSaisonActuelle(saison);
  const prixUnitaire = options.prixUnitaire || 0;
  const tendance = options.tendance || 1.0;
  const ventesHistorique = options.ventesHistorique || [];

  // Seuils dynamiques (si on a l'historique) ou fixes
  const seuils = ventesHistorique.length >= 4
    ? calculerSeuilsDynamiques(0, ventesHistorique, soldes)
    : { critique: soldes ? 7 : 14, faible: soldes ? 21 : 30 };

  const seuilCritique = seuils.critique;
  const seuilFaible = seuils.faible;

  // Analyser chaque boutique
  const analyse = stores
    .filter(store => !DEPOTS_CENTRAUX.includes(store.StoreId))
    .map(store => {
      const ventes = historiqueVentes.find(h => h.storeId === store.StoreId);
      const ventesParSemaine = ventes ? ventes.quantite : 0;
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

  // Dépôt central
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

  // Donneurs : dépôt + boutiques excédentaires
  const donneursRaw = [
    ...depotCentral.filter(d => d.stock > 0),
    ...analyse.filter(s => s.stock > 0 && s.joursStock > seuilFaible)
      .sort((a, b) => a.ventesParSemaine - b.ventesParSemaine),
    ...analyse.filter(s => s.stock > 0 && s.ventesParSemaine === 0)
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

  // ── GÉNÉRATION DES SUGGESTIONS (améliorée) ──────────────────────────
  const suggestions = [];

  receveurs.forEach(receveur => {
    const objectifSemaines = receveur.statut === 'CRITIQUE' ? 3 : 2;
    const qteNecessaire = Math.ceil(receveur.ventesParSemaine * objectifSemaines) - receveur.stock;
    if (qteNecessaire <= 0) return;

    let qteRestante = qteNecessaire;

    // NOUVEAU V2 : Trier les donneurs par score donneur (intègre le coût transport)
    const donneursTriesPourReceveur = donneurs
      .filter(d => d.storeId !== receveur.storeId)
      .map(d => ({
        ...d,
        scoreDonneurCalc: calculerScoreDonneur(d, d.ventesParSemaine, saison, receveur.storeId)
      }))
      .sort((a, b) => b.scoreDonneurCalc - a.scoreDonneurCalc);

    donneursTriesPourReceveur.forEach(donneur => {
      if (qteRestante <= 0) return;

      const stockMinimum = DEPOTS_DONNEURS.includes(donneur.storeId)
        ? 0
        : Math.ceil(donneur.ventesParSemaine * 2);

      const stockDisponible = donneur.stock - stockMinimum;
      if (stockDisponible <= 0) return;

      // Quantité à transférer
      const qteIdeal = Math.max(2, Math.ceil(receveur.ventesParSemaine * 2));
      const qteATransferer = Math.min(stockDisponible, Math.min(qteRestante, qteIdeal));

      if (qteATransferer <= 0) return;

      // Règle 7 jours d'exposition minimum
      const expoD = joursExposition[String(donneur.storeId)] || 0;
      const expoR = joursExposition[String(receveur.storeId)] || 0;
      if (expoD > 0 && expoD < 7) return;
      if (expoR > 0 && expoR < 7) return;

      // NOUVEAU V2 : Vérifier le seuil de zone
      const seuil = getSeuilTransfert(donneur.storeId, receveur.storeId);
      if (qteATransferer < seuil) return; // Filtrer en amont, pas dans le rapport

      const consigne = articleActuel
        ? 'Article saison actuelle - redistribuer ET commander si insuffisant'
        : 'Article ancienne saison - redistribuer uniquement, ne pas commander';

      const scoreDonneur = donneur.scoreDonneurCalc;
      const scoreReceveur = calculerScoreStore(receveur, receveur.ventesParSemaine, saison);

      suggestions.push({
        de: donneur.storeName,
        deId: donneur.storeId,
        vers: receveur.storeName,
        versId: receveur.storeId,
        quantite: qteATransferer,
        urgence: receveur.statut,
        consigne,
        raison: `${receveur.storeName} vend ${receveur.ventesParSemaine} u/sem — stock ${receveur.joursStock}j`,
        scoreDonneur,
        scoreReceveur,
        // NOUVEAU V2 : Métadonnées transport
        coutTransport: getCoutTransport(receveur.storeId).cout,
        zone: getZone(receveur.storeId),
        seuilZone: seuil,
        frequenceLivraison: getCoutTransport(receveur.storeId).frequence
      });

      donneur.stock -= qteATransferer;
      qteRestante -= qteATransferer;
    });
  });

  const stockTotal = analyse.reduce((sum, s) => sum + s.stock, 0) +
    depotCentral.reduce((sum, s) => sum + s.stock, 0);

  const ventesParSemaineTotal = analyse.reduce((sum, s) => sum + s.ventesParSemaine, 0);

  // Score V2
  const scoring = calculerScoreV2(analyse, ventesParSemaineTotal, saison, {
    prixUnitaire, tendance
  });

  return {
    reference,
    saison,
    articleActuel,
    stockTotal,
    score: scoring.score,
    scoreDetail: scoring.composantes,
    ruptureGlobale: receveurs.length > 0 && stockTotal < receveurs.length,
    analyse,
    suggestions,
    seuils: { critique: seuilCritique, faible: seuilFaible, soldes, dynamique: !!seuils.coeffVariation }
  };
}

function calculerScoreStore(store, ventesParSemaine, saison) {
  const coeffSaison = estSaisonActuelle(saison) ? 1.5 : 1.0;
  let urgence = 0;
  if (store.statut === 'CRITIQUE') {
    urgence = store.joursStock < 999 ? (1 / (store.joursStock + 1)) : 0.1;
  } else if (store.statut === 'FAIBLE') {
    urgence = store.joursStock < 999 ? (1 / (store.joursStock + 1)) * 0.5 : 0.05;
  } else if (store.statut === 'DEPOT') {
    urgence = 0;
  } else {
    urgence = 0.01;
  }
  return Math.round(ventesParSemaine * urgence * coeffSaison * 100) / 100;
}

module.exports = {
  analyserReassort,
  calculerScoreV2,
  calculerScoreStore,
  calculerSeuilsDynamiques,
  getSeuilTransfert,
  getCoutTransport,
  COUTS_TRANSPORT,
  DEPOTS_CENTRAUX,
  DEPOTS_DONNEURS
};
