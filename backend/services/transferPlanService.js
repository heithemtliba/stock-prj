'use strict';

function toNonNegativeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizeRecommendedQuantity(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Ventile une recommandation globale de transfert sur les variantes taille/couleur.
 *
 * Invariants :
 * - la somme des lignes ne dépasse JAMAIS la quantité recommandée ;
 * - aucune ligne ne dépasse le stock disponible de la variante donneuse ;
 * - la politique historique "au plus environ la moitié du stock variante" est conservée ;
 * - les variantes les moins disponibles chez le receveur sont servies en premier.
 */
function buildDetailedTransferLines(candidates, recommendedQuantity) {
  const target = normalizeRecommendedQuantity(recommendedQuantity);
  if (target === 0) {
    return {
      lines: [],
      recommendedQuantity: 0,
      allocatedQuantity: 0,
      unallocatedQuantity: 0
    };
  }

  const safeCandidates = (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => ({
      ean: String(candidate?.ean ?? ''),
      taille: candidate?.taille ?? '',
      couleur: candidate?.couleur ?? '',
      stockDonneur: toNonNegativeNumber(candidate?.stockDonneur),
      stockReceveur: toNonNegativeNumber(candidate?.stockReceveur)
    }))
    .filter((candidate) => candidate.ean && candidate.stockDonneur >= 1)
    .sort((a, b) => {
      if (a.stockReceveur !== b.stockReceveur) return a.stockReceveur - b.stockReceveur;
      if (a.stockDonneur !== b.stockDonneur) return b.stockDonneur - a.stockDonneur;
      return a.ean.localeCompare(b.ean);
    });

  let remaining = target;
  const lines = [];

  for (const candidate of safeCandidates) {
    if (remaining <= 0) break;

    // Conserve la règle historique du bon détaillé : céder au plus ~50 %
    // du stock de la variante (et 1 unité si le stock variante vaut 1).
    const maxForVariant = Math.min(
      candidate.stockDonneur,
      Math.max(1, Math.floor(candidate.stockDonneur / 2))
    );

    const quantity = Math.min(remaining, maxForVariant);
    if (quantity <= 0) continue;

    lines.push({ ...candidate, quantite: quantity });
    remaining -= quantity;
  }

  const allocatedQuantity = lines.reduce((sum, line) => sum + line.quantite, 0);

  if (allocatedQuantity > target) {
    throw new Error(
      `Invariant transfert violé: ${allocatedQuantity} alloué(s) pour ${target} recommandé(s)`
    );
  }

  return {
    lines,
    recommendedQuantity: target,
    allocatedQuantity,
    unallocatedQuantity: Math.max(0, target - allocatedQuantity)
  };
}

module.exports = {
  buildDetailedTransferLines,
  normalizeRecommendedQuantity
};
