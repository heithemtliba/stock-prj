/**
 * ══════════════════════════════════════════════════════════════════════════
 * CRON JOBS — Automatisation des tâches récurrentes
 * ══════════════════════════════════════════════════════════════════════════
 *
 * - 03:00  Import quotidien des ventes (SOAP ou CSV)
 * - 04:00  Normalisation des dates dans la base
 * - 06:00  Pré-calcul du cache reassort-global
 * - Toutes les 5 min : nettoyage des jobs rapport expirés
 *
 * Ajouter dans server.js :
 *   require('./services/cronJobs')(cacheClear, calculerReassortGlobal, cacheSet);
 * ══════════════════════════════════════════════════════════════════════════
 */

const cron = require('node-cron');

module.exports = function initCronJobs(cacheClear, calculerReassortGlobal, cacheSet) {
  const db = require('../config/database');
  const { importQuotidien } = require('./autoImportVentes');

  // ── 03:00 — Import quotidien des ventes ─────────────────────────────
  cron.schedule('0 3 * * *', async () => {
    console.log('[CRON] ═══ Import quotidien 03:00 ═══');
    try {
      const result = await importQuotidien(db);
      console.log(`[CRON] Import terminé : ${result.imported} ventes (${result.methode})`);

      // Invalider le cache après nouvel import
      if (result.imported > 0) {
        cacheClear();
        console.log('[CRON] Cache invalidé après import');
      }
    } catch (error) {
      console.error('[CRON] ERREUR import:', error.message);
    }
  }, { timezone: 'Africa/Tunis' });

  // ── 04:00 — Normaliser les dates (DD/MM/YYYY → YYYY-MM-DD) ─────────
  cron.schedule('0 4 * * *', () => {
    console.log('[CRON] Normalisation des dates...');
    try {
      const updated = db.prepare(`
        UPDATE ventes
        SET date_vente = substr(date_vente, 7, 4) || '-' || substr(date_vente, 4, 2) || '-' || substr(date_vente, 1, 2)
        WHERE date_vente LIKE '__/__/____'
      `).run();
      console.log(`[CRON] ${updated.changes} dates normalisées`);
    } catch (error) {
      console.error('[CRON] ERREUR normalisation:', error.message);
    }
  }, { timezone: 'Africa/Tunis' });

  // ── 06:00 — Pré-calcul du reassort global ──────────────────────────
  cron.schedule('0 6 * * 1-6', async () => {
    console.log('[CRON] Pré-calcul reassort-global...');
    try {
      const resultats = await calculerReassortGlobal();
      const { getPeriodeAnalyse } = require('../server'); // ou passer en param
      const periode = getPeriodeAnalyse ? getPeriodeAnalyse() : { label: 'Normal' };
      cacheSet(`reassort-global:${periode.label}`, resultats);
      console.log(`[CRON] Reassort pré-calculé : ${resultats.critique.length} critiques, ${resultats.faible.length} faibles`);
    } catch (error) {
      console.error('[CRON] ERREUR reassort:', error.message);
    }
  }, { timezone: 'Africa/Tunis' });

  console.log('[CRON] Jobs planifiés : import 03:00, normalisation 04:00, reassort 06:00');
};
