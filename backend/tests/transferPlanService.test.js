'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDetailedTransferLines } = require('../services/transferPlanService');

test('ne dépasse jamais une recommandation de 1 unité', () => {
  const result = buildDetailedTransferLines([
    { ean: 'A', taille: 'S', stockDonneur: 40, stockReceveur: 0 },
    { ean: 'B', taille: 'M', stockDonneur: 30, stockReceveur: 0 },
    { ean: 'C', taille: 'L', stockDonneur: 20, stockReceveur: 0 }
  ], 1);

  assert.equal(result.allocatedQuantity, 1);
  assert.equal(result.lines.reduce((s, l) => s + l.quantite, 0), 1);
  assert.ok(result.lines.every((l) => l.quantite <= l.stockDonneur));
});

test('plafonne la somme des variantes à la quantité recommandée', () => {
  const result = buildDetailedTransferLines([
    { ean: 'A', taille: 'S', stockDonneur: 10, stockReceveur: 0 },
    { ean: 'B', taille: 'M', stockDonneur: 10, stockReceveur: 1 },
    { ean: 'C', taille: 'L', stockDonneur: 10, stockReceveur: 2 }
  ], 6);

  assert.equal(result.recommendedQuantity, 6);
  assert.equal(result.allocatedQuantity, 6);
  assert.equal(result.unallocatedQuantity, 0);
  assert.deepEqual(result.lines.map((l) => [l.ean, l.quantite]), [['A', 5], ['B', 1]]);
});

test('priorise les variantes les moins disponibles chez le receveur', () => {
  const result = buildDetailedTransferLines([
    { ean: 'A', stockDonneur: 8, stockReceveur: 5 },
    { ean: 'B', stockDonneur: 8, stockReceveur: 0 },
    { ean: 'C', stockDonneur: 8, stockReceveur: 2 }
  ], 3);

  assert.equal(result.lines[0].ean, 'B');
  assert.equal(result.allocatedQuantity, 3);
});

test('retourne une quantité non allouée si le stock variante ne suffit pas', () => {
  const result = buildDetailedTransferLines([
    { ean: 'A', stockDonneur: 2, stockReceveur: 0 },
    { ean: 'B', stockDonneur: 2, stockReceveur: 0 }
  ], 10);

  assert.equal(result.allocatedQuantity, 2);
  assert.equal(result.unallocatedQuantity, 8);
});

test('gère proprement les entrées nulles ou invalides', () => {
  assert.deepEqual(buildDetailedTransferLines(null, 5).lines, []);
  assert.equal(buildDetailedTransferLines([], 'abc').allocatedQuantity, 0);
  assert.equal(buildDetailedTransferLines([{ ean: 'A', stockDonneur: -4 }], 4).allocatedQuantity, 0);
});
