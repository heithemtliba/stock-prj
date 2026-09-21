/**
 * ══════════════════════════════════════════════════════════════════════════
 * CRON JOBS — Automatisation des tâches récurrentes (CORRIGÉ)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * - 03:00  Import quotidien des ventes (SOAP ou CSV)
 * - 04:00  Normalisation des dates dans la base
 * - 06:00  Pré-calcul du cache reassort-global
 *
 * Ajouter dans server.js (avant app.listen) :
 *   require('./services/cronJobs')(cacheClear, calculerReassortGlobal, cacheSet);
 * ══════════════════════════════════════════════════════════════════════════
 */

const cron = require('node-cron');

// ── FONCTION LOCALE (évite le require circulaire avec server.js) ────────
function getPeriodeAnalyse() {
  const aujourd = new Date();
  const periodes = [
    {
      debut: new Date(process.env.SOLDES_HIVER_DEBUT || '2026-01-29'),
      fin:   new Date(process.env.SOLDES_HIVER_FIN   || '2026-03-29'),
      label: 'Soldes Hiver'
    },
    {
      debut: new Date(process.env.SOLDES_ETE_DEBUT || '2026-08-07'),
      fin:   new Date(process.env.SOLDES_ETE_FIN   || '2026-10-09'),
      label: 'Soldes Été'
    }
  ];
  for (const p of periodes) {
    if (aujourd >= p.debut && aujourd <= p.fin) {
      return { jours: 28, label: p.label, soldes: true };
    }
  }
  return { jours: 180, label: 'Normal', soldes: false };
}

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

  // ── 06:00 — Pré-calcul du reassort global (lundi-samedi) ───────────
  cron.schedule('0 6 * * 1-6', async () => {
    console.log('[CRON] Pré-calcul reassort-global...');
    try {
      const resultats = await calculerReassortGlobal();
      const periode = getPeriodeAnalyse();
      cacheSet(`reassort-global:${periode.label}`, resultats);
      console.log(`[CRON] Reassort pré-calculé : ${resultats.critique.length} critiques, ${resultats.faible.length} faibles`);
    } catch (error) {
      console.error('[CRON] ERREUR reassort:', error.message);
    }
  }, { timezone: 'Africa/Tunis' });

    // ── 05:00 Lundi — Régénérer les prévisions ML ──────────────────────
  cron.schedule('0 5 * * 1', async () => {
    console.log('[CRON] Régénération des prévisions ML...');
    try {
      const { execSync } = require('child_process');
      const path = require('path');
      const dbPath = path.join(__dirname, '../../data/mabrouk_updated.db');
      const outputPath = path.join(__dirname, '../../exports/previsions.json');
      const scriptPath = path.join(__dirname, '../../scripts/prevision_demande.py');
      
      execSync(`python "${scriptPath}" --db "${dbPath}" --output "${outputPath}" --top 200`, {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        timeout: 30 * 60 * 1000
      });
      
      console.log('[CRON] Prévisions ML régénérées');
    } catch (error) {
      console.error('[CRON] ERREUR prévisions ML:', error.message);
    }
  }, { timezone: 'Africa/Tunis' });

   console.log('[CRON] Jobs planifiés : import 03:00, normalisation 04:00, prévisions 05:00 (lundi), reassort 06:00');
};