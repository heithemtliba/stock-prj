'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  analyserReassort,
  classerReassortGlobal
} = require('../services/reassortService');

function store(StoreId, AvailableQty, StoreDescription = `Store ${StoreId}`) {
  return { StoreId, StoreDescription, AvailableQty: String(AvailableQty) };
}

function sales(storeId, quantite) {
  return { storeId, quantite };
}

test('P0.4 classe une rupture réelle à stock zéro comme CRITIQUE', () => {
  const result = analyserReassort(
    'REF',
    [store('002', 0)],
    [sales('002', 2)],
    '26E',
    false,
    { '002': 30 }
  );

  assert.equal(result.analyse[0].stock, 0);
  assert.equal(result.analyse[0].joursStock, 0);
  assert.equal(result.analyse[0].statut, 'CRITIQUE');
});

test('P0.4 laisse OK une boutique avec plus de 30 jours de couverture', () => {
  const result = analyserReassort(
    'REF',
    [store('002', 10)],
    [sales('002', 2)],
    '26E',
    false,
    { '002': 30 }
  );

  assert.equal(result.analyse[0].joursStock, 35);
  assert.equal(result.analyse[0].statut, 'OK');
  assert.equal(result.suggestions.length, 0);
});

test('P0.4 ne fabrique pas une rupture sans historique de ventes', () => {
  const result = analyserReassort(
    'REF',
    [store('002', 0)],
    [],
    '26E',
    false,
    { '002': 30 }
  );

  assert.equal(result.analyse[0].ventesParSemaine, 0);
  assert.equal(result.analyse[0].joursStock, 999);
  assert.equal(result.analyse[0].statut, 'OK');
  assert.equal(result.suggestions.length, 0);
});

test('P0.4 traite un stock négatif comme zéro sans masquer la rupture', () => {
  const result = analyserReassort(
    'REF',
    [store('002', -5)],
    [sales('002', 1)],
    '26E',
    false,
    { '002': 30 }
  );

  assert.equal(result.analyse[0].stockBrut, -5);
  assert.equal(result.analyse[0].stock, 0);
  assert.equal(result.analyse[0].statut, 'CRITIQUE');
});

test('P0.4 protège deux semaines de ventes chez une boutique donneuse', () => {
  const result = analyserReassort(
    'REF',
    [
      store('002', 10, 'Donneur'),
      store('009', 0, 'Receveur')
    ],
    [
      sales('002', 2),
      sales('009', 3)
    ],
    '26E',
    false,
    { '002': 30, '009': 30 }
  );

  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].deId, '002');
  assert.equal(result.suggestions[0].versId, '009');
  assert.equal(result.suggestions[0].quantite, 6);
  // 10 en stock - 6 transférées = 4, soit 2 semaines à 2 u/sem.
  assert.equal(result.suggestions[0].quantite <= 10 - (2 * 2), true);
});

test('P0.4 bloque un transfert si le receveur est exposé depuis 0 jour', () => {
  const result = analyserReassort(
    'REF',
    [
      store('001', 20, 'Dépôt'),
      store('009', 0, 'Receveur')
    ],
    [sales('009', 2)],
    '26E',
    false,
    { '001': 30, '009': 0 }
  );

  assert.equal(result.analyse[0].statut, 'CRITIQUE');
  assert.equal(result.suggestions.length, 0);
});

test('P0.4 bloque un transfert pendant les 6 premiers jours d’exposition', () => {
  const result = analyserReassort(
    'REF',
    [
      store('001', 20, 'Dépôt'),
      store('009', 0, 'Receveur')
    ],
    [sales('009', 2)],
    '26E',
    false,
    { '001': 30, '009': 6 }
  );

  assert.equal(result.suggestions.length, 0);
});

test('P0.4 autorise le transfert à partir du 7e jour d’exposition', () => {
  const result = analyserReassort(
    'REF',
    [
      store('001', 20, 'Dépôt'),
      store('009', 0, 'Receveur')
    ],
    [sales('009', 2)],
    '26E',
    false,
    { '001': 30, '009': 7 }
  );

  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].quantite, 4);
});

test('P0.4 ne bloque pas un transfert si les jours d’exposition sont inconnus', () => {
  const result = analyserReassort(
    'REF',
    [
      store('001', 20, 'Dépôt'),
      store('009', 0, 'Receveur')
    ],
    [sales('009', 2)],
    '26E',
    false
  );

  assert.equal(result.suggestions.length, 1);
});

test('P0.4 conserve une rupture CRITIQUE même sans donneur disponible', () => {
  const result = analyserReassort(
    'REF',
    [store('009', 0, 'Receveur')],
    [sales('009', 2)],
    '26E',
    false,
    { '009': 30 }
  );

  assert.equal(result.suggestions.length, 0);
  assert.equal(classerReassortGlobal(result), 'critique');
});

test('P0.4 conserve un article FAIBLE même sans suggestion de transfert', () => {
  const result = analyserReassort(
    'REF',
    [
      store('001', 20, 'Dépôt'),
      store('009', 6, 'Receveur')
    ],
    [sales('009', 2)],
    '26E',
    false,
    { '001': 30, '009': 30 }
  );

  assert.equal(result.analyse[0].joursStock, 21);
  assert.equal(result.analyse[0].statut, 'FAIBLE');
  assert.equal(result.suggestions.length, 0);
  assert.equal(classerReassortGlobal(result), 'faible');
});

test('P0.4 interdit la commande pour une ancienne saison dans la consigne', () => {
  const result = analyserReassort(
    'REF',
    [
      store('001', 20, 'Dépôt'),
      store('009', 0, 'Receveur')
    ],
    [sales('009', 2)],
    '24H',
    false,
    { '001': 30, '009': 30 }
  );

  assert.equal(result.suggestions.length, 1);
  assert.match(result.suggestions[0].consigne, /redistribuer uniquement/i);
  assert.match(result.suggestions[0].consigne, /ne pas commander/i);
});
