require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { execSync, execFile } = require('child_process');
const fs = require('fs');
const cegid = require('./services/cegidService');
const reassort = require('./services/reassortService');
const config = require('./config/cegid');
const { importerCSV } = require('./services/importCSV');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// â”€â”€ CACHE 30 MINUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Cache en mÃ©moire : clÃ© â†’ { data, timestamp }
const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Jobs en mémoire pour génération du rapport hebdo (évite timeout HTTP)
const rapportJobs = new Map(); // id -> { status, createdAt, updatedAt, filename, outputPath, error }
const RAPPORT_JOB_TTL_MS = 60 * 60 * 1000; // 1h

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

function cacheClear(pattern = null) {
  if (!pattern) { cache.clear(); return; }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

// â”€â”€ DÃ‰TECTION AUTOMATIQUE DE LA PÃ‰RIODE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      label: 'Soldes EtÃ©'
    }
  ];
  for (const p of periodes) {
    if (aujourd >= p.debut && aujourd <= p.fin) {
      return { jours: 28, label: p.label, soldes: true };
    }
  }
  return { jours: 180, label: 'Normal', soldes: false };
}

// â”€â”€ SCORE DE PRIORITÃ‰ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function calculerScore(analyse, ventesParSemaine, saison) {
  const SAISONS_ACT = ['25H', '25E', '26E'];
  const coeffSaison = saison && SAISONS_ACT.includes(saison.trim().toUpperCase()) ? 1.5 : 1.0;
  const boutiquesEnRupture = analyse.filter(s => s.statut === 'CRITIQUE').length;
  const joursMinStock = analyse
    .filter(s => s.statut === 'CRITIQUE' && s.joursStock < 999)
    .reduce((min, s) => Math.min(min, s.joursStock), 999);
  const urgence = joursMinStock < 999 ? (1 / (joursMinStock + 1)) : boutiquesEnRupture;
  return Math.round(ventesParSemaine * urgence * coeffSaison * 100) / 100;
}

function toSafeInt(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function asyncPool(poolLimit, items, iteratorFn) {
  const ret = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);
    if (executing.size >= poolLimit) {
      await Promise.race(executing);
    }
  }
  return Promise.allSettled(ret);
}

function newJobId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanupRapportJobs() {
  const now = Date.now();
  for (const [id, job] of rapportJobs.entries()) {
    if (!job?.updatedAt || now - job.updatedAt < RAPPORT_JOB_TTL_MS) continue;
    // Best effort cleanup
    if (job.outputPath) {
      try { fs.unlinkSync(job.outputPath); } catch (e) {}
    }
    rapportJobs.delete(id);
  }
}

function execFileAsync(file, args, options) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (err, stdout, stderr) => {
      if (err) {
        const msg = stderr?.toString?.() || stdout?.toString?.() || err.message;
        const e = new Error(msg);
        e.cause = err;
        return reject(e);
      }
      resolve({ stdout, stderr });
    });
  });
}

// â”€â”€ HELPER : calculer reassort global (rÃ©utilisÃ© par 2 routes) â”€â”€â”€
async function calculerReassortGlobal(opts = {}) {
  const db = require('./config/database');
  const periode = getPeriodeAnalyse();
  const semaines = periode.jours / 7;
  const limit = toSafeInt(opts.limit, 500);
  const concurrency = toSafeInt(opts.concurrency, 15);

  const articles = db.prepare(`
    SELECT MIN(reference_article) as reference_article, code_article, saison, SUM(quantite) as total
    FROM ventes
    WHERE date_vente >= date('now', '-${periode.jours} days')
    GROUP BY code_article
    HAVING total >= 3
    ORDER BY total DESC
    LIMIT ?
  `).all(limit);

  const resultats = { critique: [], faible: [], ok: [], total: articles.length, traites: 0, erreurs: 0, periode };

  const ventesStmt = db.prepare(`
    SELECT store_id, SUM(quantite) as total_vendu
    FROM ventes
    WHERE reference_article = ?
    AND date_vente >= date('now', '-${periode.jours} days')
    GROUP BY store_id
  `);

  // Pre-calculer stock agrege par code article (evite double appel Cegid dans le loop)
  const codesUniquesArticles = [...new Set(articles.map(a => a.code_article))];
  const stockAgregeParCode = {};
  await asyncPool(concurrency, codesUniquesArticles, async (code) => {
    try {
      const stockList = await getStockByCodeArticle(code);
      stockAgregeParCode[code] = {};
      stockList.forEach(st => stockAgregeParCode[code][String(st.storeId)] = st.stock);
    } catch(e) { stockAgregeParCode[code] = {}; }
  });
  console.log('Stock pre-calcule pour', codesUniquesArticles.length, 'articles');
  const settled = await asyncPool(concurrency, articles, async (article) => {
    const ref = article.reference_article;
    const stockResult = await cegid.getStockByStore(ref);
    if (!stockResult.success) throw new Error(`Cegid stock failed for ${ref}: ${stockResult.message || 'unknown'}`);
    const ventesDB = ventesStmt.all(ref);
    const historiqueVentes = ventesDB.map(v => ({ storeId: v.store_id, quantite: v.total_vendu / semaines }));
      const expoRows = db.prepare(`
        SELECT v.store_id,
          CASE WHEN COUNT(d.date_envoi) > 0
               THEN CAST(julianday('now') - julianday(MIN(d.date_envoi)) AS INTEGER)
               ELSE 999 END as jours
        FROM (SELECT DISTINCT store_id FROM ventes WHERE code_article = ?) v
        LEFT JOIN distributions d ON d.code_article = ? AND d.store_id = v.store_id
        GROUP BY v.store_id
      `).all(article.code_article, article.code_article);
      const joursExposition = {};
      expoRows.forEach(r => joursExposition[r.store_id] = r.jours);
      const storesRaw = stockResult.stores.AvailableQtyByStore || [];
      // Utiliser stock pre-calcule (tous EAN agrege)
      const stockAgr = stockAgregeParCode[article.code_article] || {};
      const stores = storesRaw.map(s => ({
        ...s,
        AvailableQty: String(stockAgr[String(s.StoreId)] !== undefined
          ? stockAgr[String(s.StoreId)]
          : parseFloat(s.AvailableQty) || 0)
      }));
      const analyse = reassort.analyserReassort(ref, stores, historiqueVentes, article.saison, periode.soldes, joursExposition);
      const aCritique = analyse.analyse.some(s => s.statut === 'CRITIQUE');
      const aFaible   = analyse.analyse.some(s => s.statut === 'FAIBLE');
      const stockCentrale = stores.find(s => s.StoreId === '001');
      const qteCentrale = stockCentrale ? parseFloat(stockCentrale.AvailableQty) : 0;
      const ventesParSemaine = article.total / semaines;
      const score = calculerScore(analyse.analyse, ventesParSemaine, article.saison);

    if (analyse.suggestions.length > 0) {
      const item = {
        reference: ref, codeArticle: article.code_article, saison: article.saison,
        stockCentrale: qteCentrale, score,
        ventesParSemaine: Math.round(ventesParSemaine * 100) / 100,
        suggestions: analyse.suggestions,  // Utiliser suggestions originales
        analyse: analyse.analyse.filter(s => s.statut !== 'OK')
      };
      return { type: aCritique ? 'critique' : (aFaible ? 'faible' : 'ok-item'), item, okRef: ref };
    }
    return { type: 'ok-ref', okRef: ref };
  });

  for (const r of settled) {
    if (r.status === 'fulfilled') {
      const v = r.value;
      if (v.type === 'critique' && !ARTICLES_EXCLUS.has(String(v.item?.codeArticle))) resultats.critique.push(v.item);
      else if (v.type === 'faible' && !ARTICLES_EXCLUS.has(String(v.item?.codeArticle))) resultats.faible.push(v.item);
      else if (v.type === 'ok-ref') resultats.ok.push(v.okRef);
      else if (v.type === 'ok-item') resultats.ok.push(v.item);
      resultats.traites++;
    } else {
      resultats.erreurs++;
    }
  }

  resultats.critique.sort((a, b) => b.score - a.score);
  resultats.faible.sort((a, b) => b.score - a.score);
  return resultats;
}

// â”€â”€ ROUTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/', (req, res) => res.json({ message: 'Mabrouk Stock API - OK' }));
app.get('/test-cegid', async (req, res) => res.json(await cegid.testConnection()));
app.get('/hello', async (req, res) => res.json(await cegid.helloWorld()));

// PÃ‰RIODE ACTUELLE
app.get('/periode', (req, res) => res.json(getPeriodeAnalyse()));

// STATUT CACHE â€” voir ce qui est en cache
app.get('/cache-status', (req, res) => {
  const now = Date.now();
  const entrees = [];
  for (const [key, entry] of cache.entries()) {
    const ageMin = Math.round((now - entry.timestamp) / 60000);
    const restantMin = Math.round((CACHE_TTL_MS - (now - entry.timestamp)) / 60000);
    entrees.push({ key, ageMin, restantMin });
  }
  res.json({ nbEntrees: cache.size, ttlMinutes: 30, entrees });
});

// VIDER CACHE manuellement
app.post('/cache-clear', (req, res) => {
  const avant = cache.size;
  cacheClear();
  res.json({ success: true, message: `Cache vidÃ© : ${avant} entrees supprimÃ©es` });
});

// STOCK
app.get('/stock', async (req, res) => res.json(await cegid.getStockAllStores()));
app.get('/stock/:reference', async (req, res) => res.json(await cegid.getStockByStore(req.params.reference)));

// VENTES
app.get('/ventes-stats', (req, res) => {
  try {
    const db = require('./config/database');
    const stats = db.prepare(`SELECT COUNT(DISTINCT reference_article) as nb_articles, COUNT(DISTINCT store_id) as nb_boutiques, COUNT(DISTINCT saison) as nb_saisons, SUM(quantite) as total_ventes FROM ventes`).get();
    const saisons = db.prepare(`SELECT DISTINCT saison, COUNT(DISTINCT reference_article) as nb_articles FROM ventes WHERE saison IS NOT NULL AND saison != '' GROUP BY saison ORDER BY saison DESC`).all();
    res.json({ ...stats, saisons });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.get('/ventes/:reference', (req, res) => {
  try {
    const db = require('./config/database');
    const ventes = db.prepare(`SELECT store_id, taille, couleur, saison, SUM(quantite) as total_vendu FROM ventes WHERE reference_article = ? GROUP BY store_id, taille, couleur ORDER BY total_vendu DESC`).all(req.params.reference);
    res.json(ventes);
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// RESET BASE DE DONNEES
app.get('/reset-db', (req, res) => {
  try {
    const db = require('./config/database');
    db.exec(`
      DROP TABLE IF EXISTS ventes;
      CREATE TABLE ventes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date_vente TEXT NOT NULL, store_id TEXT NOT NULL, code_article TEXT,
        reference_article TEXT NOT NULL, taille TEXT, couleur TEXT, saison TEXT,
        quantite REAL NOT NULL, source TEXT DEFAULT 'cegid_csv',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(date_vente, store_id, reference_article, taille, couleur)
      );
    `);
    cacheClear();
    res.json({ success: true, message: 'Base reinitialisee avec succes' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// IMPORT CSV â€” vide le cache aprÃ¨s import
app.post('/import-csv/:mois', (req, res) => {
  try {
    const moisNoms = { 'septembre': 'septembre_2025', 'octobre': 'octobre_2025', 'novembre': 'novembre_2025', 'decembre': 'decembre_2025', 'janvier': 'janvier_2026', 'fevrier': 'fevrier_2026', 'mars': 'mars_2026' };
    const dates = { 'septembre': '2025-09-01', 'octobre': '2025-10-01', 'novembre': '2025-11-01', 'decembre': '2025-12-01', 'janvier': '2026-01-01', 'fevrier': '2026-02-01', 'mars': '2026-03-01' };
    const nomFichier = moisNoms[req.params.mois];
    if (!nomFichier) return res.status(400).json({ success: false, message: 'Mois invalide' });
    const filePath = path.join(__dirname, `../data/${nomFichier}.csv`);
    const result = importerCSV(filePath, dates[req.params.mois]);
    cacheClear(); // Nouvelles donnÃ©es = cache invalide
    res.json({ fichier: nomFichier, ...result });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// REASSORT PAR CODE-BARRES (dÃ©tail) â€” avec cache
app.get('/reassort/:reference', async (req, res) => {
  try {
    const db = require('./config/database');
    const periode = getPeriodeAnalyse();
    const cacheKey = `reassort:${req.params.reference}:${periode.label}`;

    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, _cache: true });

    const stockResult = await cegid.getStockByStore(req.params.reference);
    if (!stockResult.success) return res.status(500).json(stockResult);

    const semaines = periode.jours / 7;
    const ventesDB = db.prepare(`
      SELECT store_id, SUM(quantite) as total_vendu
      FROM ventes
      WHERE reference_article = ?
      AND date_vente >= date('now', '-${periode.jours} days')
      GROUP BY store_id
    `).all(req.params.reference);
    const infoArticle = db.prepare(`SELECT code_article, saison FROM ventes WHERE reference_article = ? LIMIT 1`).get(req.params.reference);
    const historiqueVentes = ventesDB.map(v => ({ storeId: v.store_id, quantite: v.total_vendu / semaines }));
    const stores = stockResult.stores.AvailableQtyByStore;
    const stockCentrale = stores.find(s => s.StoreId === '001');
    const qteCentrale = stockCentrale ? parseFloat(stockCentrale.AvailableQty) : 0;
    const result = reassort.analyserReassort(req.params.reference, stores, historiqueVentes, infoArticle?.saison, periode.soldes);
    const response = { ...result, codeArticle: infoArticle?.code_article, saison: infoArticle?.saison, stockCentrale: qteCentrale, periode };

    cacheSet(cacheKey, response);
    res.json(response);
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// REASSORT GLOBAL â€” avec cache
app.get('/reassort-global', async (req, res) => {
  try {
    const periode = getPeriodeAnalyse();
    const cacheKey = `reassort-global:${periode.label}`;

    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, _cache: true });

    const resultats = await calculerReassortGlobal();
    cacheSet(cacheKey, resultats);
    res.json(resultats);
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// VUE PAR CODE ARTICLE â€” avec cache
app.get('/articles', async (req, res) => {
  try {
    const db = require('./config/database');
    const periode = getPeriodeAnalyse();
    const cacheKey = `articles:${periode.label}`;

    const cached = cacheGet(cacheKey);
    if (cached) return res.json({ ...cached, _cache: true });

    const semaines = periode.jours / 7;

    const codesArticles = db.prepare(`
      SELECT code_article, saison, COUNT(DISTINCT reference_article) as nb_variantes, SUM(quantite) as total_vendu
      FROM ventes
      WHERE code_article IS NOT NULL AND code_article != ''
      AND date_vente >= date('now', '-${periode.jours} days')
      GROUP BY code_article
      HAVING total_vendu >= 2
      ORDER BY total_vendu DESC
      LIMIT 200
    `).all();

    const resultats = { critique: [], faible: [], ok: [], traites: 0, erreurs: 0, periode };

    for (const art of codesArticles) {
      try {
        const variantes = db.prepare(`SELECT DISTINCT reference_article, couleur, taille, SUM(quantite) as ventes FROM ventes WHERE code_article = ? AND date_vente >= date('now', '-${periode.jours} days') GROUP BY reference_article, couleur, taille ORDER BY taille, couleur`).all(art.code_article);
        const stockParBoutique = {};
        const ventesParVariante = [];
        let stockCentrale = 0;

        for (const variante of variantes) {
          try {
            const stockResult = await cegid.getStockByStore(variante.reference_article);
            if (!stockResult.success) continue;
            const stores = stockResult.stores.AvailableQtyByStore;
            for (const store of stores) {
              const qty = parseFloat(store.AvailableQty) || 0;
              if (store.StoreId === '001') { stockCentrale += qty; continue; }
              if (store.StoreId === '088') continue;
              if (!stockParBoutique[store.StoreId]) stockParBoutique[store.StoreId] = { storeId: store.StoreId, storeName: store.StoreDescription, stock: 0 };
              stockParBoutique[store.StoreId].stock += qty;
            }
            ventesParVariante.push({ reference: variante.reference_article, couleur: variante.couleur, taille: variante.taille, ventesTotal: variante.ventes });
          } catch (e) { continue; }
        }

        const ventesParBoutique = db.prepare(`SELECT store_id, SUM(quantite) as total_vendu FROM ventes WHERE code_article = ? AND date_vente >= date('now', '-${periode.jours} days') GROUP BY store_id`).all(art.code_article);
        const stockTotal = Object.values(stockParBoutique).reduce((s, b) => s + b.stock, 0);
        const ventesTotalSemaine = art.total_vendu / semaines;
        const parCouleur = db.prepare(`SELECT couleur, SUM(quantite) as ventes FROM ventes WHERE code_article = ? AND date_vente >= date('now', '-${periode.jours} days') GROUP BY couleur ORDER BY ventes DESC`).all(art.code_article);
        const parTaille  = db.prepare(`SELECT taille,  SUM(quantite) as ventes FROM ventes WHERE code_article = ? AND date_vente >= date('now', '-${periode.jours} days') GROUP BY taille  ORDER BY ventes DESC`).all(art.code_article);

        const seuilCrit = periode.soldes ? 7  : 14;
        const seuilFaib = periode.soldes ? 21 : 30;
        const boutiquesAnalyse = Object.values(stockParBoutique).map(b => {
          const vBoutique = ventesParBoutique.find(v => v.store_id === b.storeId);
          const vSemaine = vBoutique ? vBoutique.total_vendu / semaines : 0;
          const stock = b.stock < 0 ? 0 : b.stock;
          const jours = vSemaine > 0 ? Math.round((stock / vSemaine) * 7) : 999;
          let statut = 'OK';
          if (jours < seuilCrit && vSemaine >= 0.25) statut = 'CRITIQUE';
          else if (jours < seuilFaib && vSemaine >= 0.25) statut = 'FAIBLE';
          return { ...b, stock, ventesParSemaine: Math.round(vSemaine * 100) / 100, joursStock: jours, statut };
        });

        const aCritique = boutiquesAnalyse.some(b => b.statut === 'CRITIQUE');
        const aFaible   = boutiquesAnalyse.some(b => b.statut === 'FAIBLE');
        const score = calculerScore(boutiquesAnalyse, ventesTotalSemaine, art.saison);

        const item = {
          codeArticle: art.code_article, saison: art.saison, nbVariantes: art.nb_variantes,
          stockTotal, stockCentrale, ventesParSemaine: Math.round(ventesTotalSemaine * 100) / 100,
          score, boutiques: boutiquesAnalyse, parCouleur, parTaille, variantes: ventesParVariante,
          statut: aCritique ? 'CRITIQUE' : (aFaible ? 'FAIBLE' : 'OK')
        };

        if (aCritique && !ARTICLES_EXCLUS.has(String(item.codeArticle))) resultats.critique.push(item);
        else if (aFaible && !ARTICLES_EXCLUS.has(String(item.codeArticle))) resultats.faible.push(item);
        else resultats.ok.push(item);
        resultats.traites++;
      } catch (e) { resultats.erreurs++; }
    }

    resultats.critique.sort((a, b) => b.score - a.score);
    resultats.faible.sort((a, b) => b.score - a.score);

    cacheSet(cacheKey, resultats);
    res.json(resultats);
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// EXPORT EXCEL (transferts â€” existant)
app.post('/export-excel', async (req, res) => {
  try {
    const data = req.body;
    const scriptPath = path.join(__dirname, '../scripts/exportReassort.py');
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir);
    const filename = `reassort_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.xlsx`;
    const outputPath = path.join(exportsDir, filename);
    const tmpPath = path.join(exportsDir, 'tmp_data.json');
    fs.writeFileSync(tmpPath, JSON.stringify(data), { encoding: 'utf8' });
    execSync(`python "${scriptPath}" "${outputPath}" "${tmpPath}"`, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    fs.unlinkSync(tmpPath);
    res.download(outputPath, filename, (err) => {
      if (!err) setTimeout(() => { try { fs.unlinkSync(outputPath); } catch(e) {} }, 5000);
    });
  } catch (error) {
    console.error('Export error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// â”€â”€ RAPPORT HEBDOMADAIRE EXCEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GÃ©nÃ¨re automatiquement le rapport complet de la semaine
app.post('/rapport-hebdomadaire', async (req, res) => {
  try {
    // Mode "download direct" (historique) : peut dépasser 120s selon Cegid/volume.
    // Mode par défaut : asynchrone (job) pour éviter les timeouts clients.
    if (String(req.query?.download || '') === '1') {
    const db = require('./config/database');
    const periode = getPeriodeAnalyse();

    // RÃ©utiliser le cache reassort-global si disponible
    const cacheKey = `reassort-global:${periode.label}`;
    let donnees = cacheGet(cacheKey);
    if (!donnees) {
      const limit = toSafeInt(req.query?.limit || process.env.RAPPORT_HEBDO_LIMIT, 500);
      const concurrency = toSafeInt(req.query?.concurrency || process.env.RAPPORT_HEBDO_CONCURRENCY, 15);
      donnees = await calculerReassortGlobal({ limit, concurrency });
      cacheSet(cacheKey, donnees);
    }

    // Stats ventes 7 derniers jours par boutique
    const ventesParBoutique7j = db.prepare(`
      SELECT store_id, SUM(quantite) as total_ventes, COUNT(DISTINCT reference_article) as nb_references
      FROM ventes
      WHERE date_vente >= date('now', '-7 days')
      GROUP BY store_id
      ORDER BY total_ventes DESC
    `).all();

    // Total ventes semaine courante vs semaine prÃ©cÃ©dente
    const ventesCetteSemaine = db.prepare(`SELECT COALESCE(SUM(quantite),0) as total FROM ventes WHERE date_vente >= date('now', '-7 days')`).get();
    const ventesSemainePrec  = db.prepare(`SELECT COALESCE(SUM(quantite),0) as total FROM ventes WHERE date_vente >= date('now', '-14 days') AND date_vente < date('now', '-7 days')`).get();

    // Top 10 articles plus vendus cette semaine
    const topArticles = db.prepare(`
      SELECT code_article, saison, SUM(quantite) as total_vendu
      FROM ventes
      WHERE date_vente >= date('now', '-7 days')
      AND code_article IS NOT NULL AND code_article != ''
      GROUP BY code_article
      ORDER BY total_vendu DESC
      LIMIT 10
    `).all();

    // Articles sans mouvement cette semaine (potentielles dÃ©marques)
    const articlesInactifs = db.prepare(`
      SELECT code_article, saison, SUM(quantite) as total_periode,
                      ROUND(SUM(quantite) * 7.0 / 28, 2) as ventes_semaine,
               CAST(julianday('now') - julianday(MAX(date_vente)) AS INTEGER) as jours_sans_vente
      FROM ventes
      WHERE date_vente >= date('now', '-${periode.jours} days')
      AND code_article NOT IN (
        SELECT DISTINCT code_article FROM ventes
        WHERE date_vente >= date('now', '-7 days')
        AND code_article IS NOT NULL AND code_article != ''
      )
      AND code_article IS NOT NULL AND code_article != ''
      GROUP BY code_article
      HAVING total_periode >= 5
      ORDER BY total_periode DESC
      LIMIT 20
    `).all();

      const codesRapport = [...new Set([
        ...donnees.critique.map(a => String(a.codeArticle)),
        ...donnees.faible.map(a => String(a.codeArticle)),
        ...articlesInactifs.map(a => String(a.code_article)),
        ...topArticles.map(a => String(a.code_article))
      ].filter(Boolean))];
      const nomsArticles = getNomsArticles(db, codesRapport);
      // Prix articles depuis table articles
      const prixArticles = {};
      for (const code of codesRapport) {
        const a = db.prepare('SELECT prix_detail FROM articles WHERE code_article = ?').get(code);
        if (a) prixArticles[code] = a.prix_detail;
      }
      const stockParArticle = {};
      for (const code of codesRapport) {
        try {
          const stockList = await getStockByCodeArticle(code);
          stockParArticle[code] = {};
          for (const st of stockList) stockParArticle[code][String(st.storeId)] = st.stock;
        } catch(e) { stockParArticle[code] = {}; }
      }

      // Bons de transfert detailles par variante (taille/couleur)
      const bonsTransfert = [];
      const suggestionsTraitees = new Set();
      for (const art of donnees.critique) {
        if (ARTICLES_EXCLUS.has(String(art.codeArticle))) continue;
        for (const sug of (art.suggestions || [])) {
          const key = art.codeArticle + '_' + sug.deId + '_' + sug.versId;
          if (suggestionsTraitees.has(key)) continue;
          suggestionsTraitees.add(key);
          try {
            const refs = db.prepare("SELECT DISTINCT reference_article, taille, couleur FROM ventes WHERE code_article = ? AND reference_article IS NOT NULL AND reference_article != ''").all(art.codeArticle);
            const lignes = [];
            for (const r of refs) {
              const result = await cegid.getStockByStore(r.reference_article);
              if (!result.success) continue;
              const stores = result.stores.AvailableQtyByStore || [];
              const stD = stores.find(s => s.StoreId === sug.deId);
              const stR = stores.find(s => s.StoreId === sug.versId);
              const qD = stD ? Math.max(0, parseFloat(stD.AvailableQty) || 0) : 0;
              const qR = stR ? Math.max(0, parseFloat(stR.AvailableQty) || 0) : 0;
              if (qD >= 1) {
                const qTransfert = Math.max(1, Math.floor(qD / 2));
                lignes.push({
                  ean: r.reference_article,
                  taille: r.taille || '',
                  couleur: r.couleur || '',
                  stockDonneur: qD,
                  stockReceveur: qR,
                  quantite: qTransfert
                });
              }
            }
              // Filtrer selon seuil transport
              const seuilBon = (['009','032'].includes(sug.deId) || ['009','032'].includes(sug.versId)) ? 8
                : (['029'].includes(sug.deId) || ['029'].includes(sug.versId)) ? 5
                : (['011'].includes(sug.deId) || ['011'].includes(sug.versId)) ? 5 : 1;
              const totalBon = lignes.reduce((s,l) => s + l.quantite, 0);
              if (totalBon < seuilBon) { /* skip - sous seuil */ } else
            if (lignes.length > 0) {
              bonsTransfert.push({
                codeArticle: art.codeArticle,
                nomArticle: getNomsArticles(db, [String(art.codeArticle)])[String(art.codeArticle)] || '',
                saison: art.saison,
                donneur: sug.de,
                donneurId: sug.deId,
                receveur: sug.vers,
                receveurId: sug.versId,
                lignes,
                totalUnites: lignes.reduce((s, l) => s + l.quantite, 0)
              });
            }
          } catch(e) { /* skip */ }
        }
      }


      // Analyse retours et annulations
      const retourStats = db.prepare(`
        SELECT r.code_article, a.libelle, a.famille, a.prix_detail,
               SUM(r.quantite) as total_retours,
               COUNT(DISTINCT r.store_id) as nb_boutiques,
               COUNT(*) as nb_transactions
        FROM retours r
        LEFT JOIN articles a ON a.code_article = r.code_article
        GROUP BY r.code_article
        ORDER BY total_retours DESC
        LIMIT 30
      `).all();

      const retourParBoutique = db.prepare(`
        SELECT r.store_id,
               SUM(r.quantite) as total,
               COUNT(DISTINCT r.code_article) as nb_articles
        FROM retours r
        GROUP BY r.store_id
        ORDER BY total DESC
      `).all();

      const tauxRetour = db.prepare(`
        SELECT v.code_article, a.libelle, a.famille, a.prix_detail,
               SUM(v.quantite) as ventes,
               COALESCE(r.total_retours, 0) as retours,
               ROUND(COALESCE(r.total_retours, 0) * 100.0 / SUM(v.quantite), 1) as taux_pct
        FROM ventes v
        LEFT JOIN (SELECT code_article, SUM(quantite) as total_retours FROM retours GROUP BY code_article) r
          ON r.code_article = v.code_article
        LEFT JOIN articles a ON a.code_article = v.code_article
        WHERE v.date_vente >= date('now', '-28 days')
        GROUP BY v.code_article
        HAVING retours > 0 AND SUM(v.quantite) >= 3
        ORDER BY taux_pct DESC
        LIMIT 20
      `).all();

      const analyseRetours = { parArticle: retourStats, parBoutique: retourParBoutique, tauxRetour, total: db.prepare("SELECT COUNT(*) as nb, SUM(quantite) as total FROM retours").get() };

const rapport = {
      periode,
      dateGeneration: new Date().toISOString(),
      resumeUrgences: {
        nbCritique: donnees.critique.length,
        nbFaible: donnees.faible.length,
        nbOk: donnees.ok.length,
        totalTransferts: donnees.critique.reduce((s, a) => s + a.suggestions.length, 0) +
                         donnees.faible.reduce((s, a) => s + a.suggestions.length, 0)
      },
      articlesCritiques: donnees.critique.filter(a => !ARTICLES_EXCLUS.has(String(a.codeArticle))),
      articlesFaibles: donnees.faible.filter(a => !ARTICLES_EXCLUS.has(String(a.codeArticle))),
      ventesHebdo: {
        cetteSemaine: ventesCetteSemaine.total,
        semainePrec: ventesSemainePrec.total,
        evolution: ventesSemainePrec.total > 0
          ? Math.round(((ventesCetteSemaine.total - ventesSemainePrec.total) / ventesSemainePrec.total) * 100)
          : 0,
        parBoutique: ventesParBoutique7j
      },

      topArticles,
      articlesInactifs: articlesInactifs.filter(a => !ARTICLES_EXCLUS.has(String(a.code_article))),
      analyseRetours,
      nomsArticles,
      prixArticles,
      bonsTransfert,
      stockParArticle,
      scoresMagasins: calculerScoresMagasins(donnees),
      rupturesNouvelleCollection: calculerRupturesNouvelleCollection(donnees, db, periode)
    };

    // GÃ©nÃ©rer le fichier Excel via le script Python
    const scriptPath = path.join(__dirname, '../scripts/exportRapportHebdo.py');
    const exportsDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir);

    const now = new Date();
    const dateStr = now.toISOString().slice(0,10).replace(/-/g,'');
    // NumÃ©ro de semaine ISO
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    const filename = `rapport_hebdo_S${weekNum}_${dateStr}.xlsx`;
    const outputPath = path.join(exportsDir, filename);
    const tmpPath = path.join(exportsDir, 'tmp_rapport.json');

    fs.writeFileSync(tmpPath, JSON.stringify(rapport), { encoding: 'utf8' });
    execSync(`python "${scriptPath}" "${outputPath}" "${tmpPath}"`, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    fs.unlinkSync(tmpPath);

    res.download(outputPath, filename, (err) => {
      if (!err) setTimeout(() => { try { fs.unlinkSync(outputPath); } catch(e) {} }, 5000);
    });
    return;
    }

    cleanupRapportJobs();
    const jobId = newJobId();
    rapportJobs.set(jobId, { status: 'queued', createdAt: Date.now(), updatedAt: Date.now(), error: null, filename: null, outputPath: null });

    // Lancer en arrière-plan (sans bloquer la requête HTTP)
    (async () => {
      const setJob = (patch) => {
        const current = rapportJobs.get(jobId);
        if (!current) return;
        rapportJobs.set(jobId, { ...current, ...patch, updatedAt: Date.now() });
      };

      try {
        setJob({ status: 'running' });
        const db = require('./config/database');
        const periode = getPeriodeAnalyse();

        const cacheKey = `reassort-global:${periode.label}`;
        let donnees = cacheGet(cacheKey);
        if (!donnees) {
          const limit = toSafeInt(req.query?.limit || process.env.RAPPORT_HEBDO_LIMIT, 500);
          const concurrency = toSafeInt(req.query?.concurrency || process.env.RAPPORT_HEBDO_CONCURRENCY, 15);
          donnees = await calculerReassortGlobal({ limit, concurrency });
          cacheSet(cacheKey, donnees);
        }

        const ventesParBoutique7j = db.prepare(`
          SELECT store_id, SUM(quantite) as total_ventes, COUNT(DISTINCT reference_article) as nb_references
          FROM ventes
          WHERE date_vente >= date('now', '-7 days')
          GROUP BY store_id
          ORDER BY total_ventes DESC
        `).all();

        const ventesCetteSemaine = db.prepare(`SELECT COALESCE(SUM(quantite),0) as total FROM ventes WHERE date_vente >= date('now', '-7 days')`).get();
        const ventesSemainePrec  = db.prepare(`SELECT COALESCE(SUM(quantite),0) as total FROM ventes WHERE date_vente >= date('now', '-14 days') AND date_vente < date('now', '-7 days')`).get();

        const topArticles = db.prepare(`
          SELECT code_article, saison, SUM(quantite) as total_vendu
          FROM ventes
          WHERE date_vente >= date('now', '-7 days')
          AND code_article IS NOT NULL AND code_article != ''
          GROUP BY code_article
          ORDER BY total_vendu DESC
          LIMIT 10
        `).all();

        const articlesInactifs = db.prepare(`
          SELECT code_article, saison, SUM(quantite) as total_periode,
                      ROUND(SUM(quantite) * 7.0 / 28, 2) as ventes_semaine,
               CAST(julianday('now') - julianday(MAX(date_vente)) AS INTEGER) as jours_sans_vente
          FROM ventes
          WHERE date_vente >= date('now', '-${periode.jours} days')
          AND code_article NOT IN (
            SELECT DISTINCT code_article FROM ventes
            WHERE date_vente >= date('now', '-7 days')
            AND code_article IS NOT NULL AND code_article != ''
          )
          AND code_article IS NOT NULL AND code_article != ''
          GROUP BY code_article
          HAVING total_periode >= 5
          ORDER BY total_periode DESC
          LIMIT 20
        `).all();

      const codesRapport = [...new Set([
        ...donnees.critique.map(a => String(a.codeArticle)),
        ...donnees.faible.map(a => String(a.codeArticle)),
        ...articlesInactifs.map(a => String(a.code_article)),
        ...topArticles.map(a => String(a.code_article))
      ].filter(Boolean))];
      const nomsArticles = getNomsArticles(db, codesRapport);
      // Prix articles depuis table articles
      const prixArticles = {};
      for (const code of codesRapport) {
        const a = db.prepare('SELECT prix_detail FROM articles WHERE code_article = ?').get(code);
        if (a) prixArticles[code] = a.prix_detail;
      }
      const stockParArticle = {};
      for (const code of codesRapport) {
        try {
          const stockList = await getStockByCodeArticle(code);
          stockParArticle[code] = {};
          for (const st of stockList) stockParArticle[code][String(st.storeId)] = st.stock;
        } catch(e) { stockParArticle[code] = {}; }
      }

      // Bons de transfert detailles par variante (taille/couleur)
      const bonsTransfert = [];
      const suggestionsTraitees = new Set();
      for (const art of donnees.critique) {
        if (ARTICLES_EXCLUS.has(String(art.codeArticle))) continue;
        for (const sug of (art.suggestions || [])) {
          const key = art.codeArticle + '_' + sug.deId + '_' + sug.versId;
          if (suggestionsTraitees.has(key)) continue;
          suggestionsTraitees.add(key);
          try {
            const refs = db.prepare("SELECT DISTINCT reference_article, taille, couleur FROM ventes WHERE code_article = ? AND reference_article IS NOT NULL AND reference_article != ''").all(art.codeArticle);
            const lignes = [];
            for (const r of refs) {
              const result = await cegid.getStockByStore(r.reference_article);
              if (!result.success) continue;
              const stores = result.stores.AvailableQtyByStore || [];
              const stD = stores.find(s => s.StoreId === sug.deId);
              const stR = stores.find(s => s.StoreId === sug.versId);
              const qD = stD ? Math.max(0, parseFloat(stD.AvailableQty) || 0) : 0;
              const qR = stR ? Math.max(0, parseFloat(stR.AvailableQty) || 0) : 0;
              if (qD >= 1) {
                const qTransfert = Math.max(1, Math.floor(qD / 2));
                lignes.push({
                  ean: r.reference_article,
                  taille: r.taille || '',
                  couleur: r.couleur || '',
                  stockDonneur: qD,
                  stockReceveur: qR,
                  quantite: qTransfert
                });
              }
            }
              // Filtrer selon seuil transport
              const seuilBon = (['009','032'].includes(sug.deId) || ['009','032'].includes(sug.versId)) ? 8
                : (['029'].includes(sug.deId) || ['029'].includes(sug.versId)) ? 5
                : (['011'].includes(sug.deId) || ['011'].includes(sug.versId)) ? 5 : 1;
              const totalBon = lignes.reduce((s,l) => s + l.quantite, 0);
              if (totalBon < seuilBon) { /* skip - sous seuil */ } else
            if (lignes.length > 0) {
              bonsTransfert.push({
                codeArticle: art.codeArticle,
                nomArticle: getNomsArticles(db, [String(art.codeArticle)])[String(art.codeArticle)] || '',
                saison: art.saison,
                donneur: sug.de,
                donneurId: sug.deId,
                receveur: sug.vers,
                receveurId: sug.versId,
                lignes,
                totalUnites: lignes.reduce((s, l) => s + l.quantite, 0)
              });
            }
          } catch(e) { /* skip */ }
        }
      }


      // Analyse retours et annulations
      const retourStats = db.prepare(`
        SELECT r.code_article, a.libelle, a.famille, a.prix_detail,
               SUM(r.quantite) as total_retours,
               COUNT(DISTINCT r.store_id) as nb_boutiques,
               COUNT(*) as nb_transactions
        FROM retours r
        LEFT JOIN articles a ON a.code_article = r.code_article
        GROUP BY r.code_article
        ORDER BY total_retours DESC
        LIMIT 30
      `).all();

      const retourParBoutique = db.prepare(`
        SELECT r.store_id,
               SUM(r.quantite) as total,
               COUNT(DISTINCT r.code_article) as nb_articles
        FROM retours r
        GROUP BY r.store_id
        ORDER BY total DESC
      `).all();

      const tauxRetour = db.prepare(`
        SELECT v.code_article, a.libelle, a.famille, a.prix_detail,
               SUM(v.quantite) as ventes,
               COALESCE(r.total_retours, 0) as retours,
               ROUND(COALESCE(r.total_retours, 0) * 100.0 / SUM(v.quantite), 1) as taux_pct
        FROM ventes v
        LEFT JOIN (SELECT code_article, SUM(quantite) as total_retours FROM retours GROUP BY code_article) r
          ON r.code_article = v.code_article
        LEFT JOIN articles a ON a.code_article = v.code_article
        WHERE v.date_vente >= date('now', '-28 days')
        GROUP BY v.code_article
        HAVING retours > 0 AND SUM(v.quantite) >= 3
        ORDER BY taux_pct DESC
        LIMIT 20
      `).all();

      const analyseRetours = { parArticle: retourStats, parBoutique: retourParBoutique, tauxRetour, total: db.prepare("SELECT COUNT(*) as nb, SUM(quantite) as total FROM retours").get() };

const rapport = {
          periode,
          dateGeneration: new Date().toISOString(),
          resumeUrgences: {
            nbCritique: donnees.critique.length,
            nbFaible: donnees.faible.length,
            nbOk: donnees.ok.length,
            totalTransferts: donnees.critique.reduce((s, a) => s + a.suggestions.length, 0) +
                             donnees.faible.reduce((s, a) => s + a.suggestions.length, 0)
          },
          articlesCritiques: donnees.critique.filter(a => !ARTICLES_EXCLUS.has(String(a.codeArticle))),
          articlesFaibles: donnees.faible.filter(a => !ARTICLES_EXCLUS.has(String(a.codeArticle))),
          ventesHebdo: {
            cetteSemaine: ventesCetteSemaine.total,
            semainePrec: ventesSemainePrec.total,
            evolution: ventesSemainePrec.total > 0
              ? Math.round(((ventesCetteSemaine.total - ventesSemainePrec.total) / ventesSemainePrec.total) * 100)
              : 0,
            parBoutique: ventesParBoutique7j
          },

          topArticles,
          articlesInactifs: articlesInactifs.filter(a => !ARTICLES_EXCLUS.has(String(a.code_article))),
            analyseRetours,
          nomsArticles,
          prixArticles,
          bonsTransfert,
      stockParArticle,
      scoresMagasins: calculerScoresMagasins(donnees),
          rupturesNouvelleCollection: calculerRupturesNouvelleCollection(donnees, db, periode)
        };

        const scriptPath = path.join(__dirname, '../scripts/exportRapportHebdo.py');
        const exportsDir = path.join(__dirname, '../exports');
        if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir);

        const now = new Date();
        const dateStr = now.toISOString().slice(0,10).replace(/-/g,'');
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
        const filename = `rapport_hebdo_S${weekNum}_${dateStr}.xlsx`;
        const outputPath = path.join(exportsDir, `${jobId}_${filename}`);
        const tmpPath = path.join(exportsDir, `tmp_rapport_${jobId}.json`);

        fs.writeFileSync(tmpPath, JSON.stringify(rapport), { encoding: 'utf8' });
        await execFileAsync('python', [scriptPath, outputPath, tmpPath], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
        try { fs.unlinkSync(tmpPath); } catch (e) {}

        setJob({ status: 'ready', filename, outputPath });
      } catch (e) {
        const msg = e?.message || String(e);
        const current = rapportJobs.get(jobId);
        if (current?.outputPath) { try { fs.unlinkSync(current.outputPath); } catch (err) {} }
        setJob({ status: 'error', error: msg, filename: null, outputPath: null });
      }
    })();

    return res.status(202).json({
      success: true,
      jobId,
      statusUrl: `/rapport-hebdomadaire/jobs/${jobId}`,
      downloadUrl: `/rapport-hebdomadaire/jobs/${jobId}/download`
    });
  } catch (error) {
    console.error('Rapport error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Statut job rapport hebdo
app.get('/rapport-hebdomadaire/jobs/:id', (req, res) => {
  cleanupRapportJobs();
  const job = rapportJobs.get(req.params.id);
  if (!job) return res.status(404).json({ success: false, message: 'Job introuvable (expiré ou invalide)' });
  res.json({
    success: true,
    jobId: req.params.id,
    status: job.status,
    filename: job.filename,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    downloadUrl: job.status === 'ready' ? `/rapport-hebdomadaire/jobs/${req.params.id}/download` : null
  });
});

// Télécharger le fichier généré
app.get('/rapport-hebdomadaire/jobs/:id/download', (req, res) => {
  cleanupRapportJobs();
  const job = rapportJobs.get(req.params.id);
  if (!job) return res.status(404).json({ success: false, message: 'Job introuvable (expiré ou invalide)' });
  if (job.status !== 'ready' || !job.outputPath || !job.filename) {
    return res.status(409).json({ success: false, status: job.status, message: 'Rapport pas prêt' });
  }
  return res.download(job.outputPath, job.filename, (err) => {
    if (err) return;
    // Supprimer après téléchargement + expirer l'entrée
    setTimeout(() => {
      try { fs.unlinkSync(job.outputPath); } catch (e) {}
      rapportJobs.delete(req.params.id);
    }, 5000);
  });
});


// ── ARTICLES EXCLUS (sacs emballage Mabrouk) ──────────────────────────────
// Noms articles depuis table articles
function getNomArticle(db, code) {
  try {
    const art = db.prepare("SELECT libelle, famille FROM articles WHERE code_article = ?").get(code);
    return art ? art.libelle + (art.famille ? ' - ' + art.famille : '') : '';
  } catch(e) { return ''; }
}
function getNomsArticles(db, codes) {
  const noms = {};
  for (const code of codes) noms[code] = getNomArticle(db, code);
  return noms;
}

const ARTICLES_EXCLUS = new Set(["91272", "91273", "91274"]);

// -- CALCUL SCORES MAGASINS -------------------------------------------------
function calculerScoresMagasins(donnees) {
  const statsParStore = {};

  // Compter critiques par store
  for (const art of donnees.critique) {
    for (const b of art.analyse || []) {
      const sid = b.storeId;
      if (!sid || sid === '001') continue;
      if (!statsParStore[sid]) statsParStore[sid] = { storeId: sid, storeName: b.storeName, nbArticlesExposes: 0, nbCritiques: 0, nbFaibles: 0 };
      statsParStore[sid].nbArticlesExposes++;
      if (b.statut === 'CRITIQUE') statsParStore[sid].nbCritiques++;
    }
  }
  // Compter faibles par store
  for (const art of donnees.faible) {
    for (const b of art.analyse || []) {
      const sid = b.storeId;
      if (!sid || sid === '001') continue;
      if (!statsParStore[sid]) statsParStore[sid] = { storeId: sid, storeName: b.storeName, nbArticlesExposes: 0, nbCritiques: 0, nbFaibles: 0 };
      statsParStore[sid].nbArticlesExposes++;
      if (b.statut === 'FAIBLE') statsParStore[sid].nbFaibles++;
    }
  }
  // Compter OK par store
  for (const art of donnees.ok) {
    for (const b of art.analyse || []) {
      const sid = b.storeId;
      if (!sid || sid === '001') continue;
      if (!statsParStore[sid]) statsParStore[sid] = { storeId: sid, storeName: b.storeName, nbArticlesExposes: 0, nbCritiques: 0, nbFaibles: 0 };
      statsParStore[sid].nbArticlesExposes++;
    }
  }

  return Object.values(statsParStore).map(s => ({
    ...s,
    scorePct: s.nbArticlesExposes > 0
      ? Math.round((s.nbCritiques / s.nbArticlesExposes) * 100 * 10) / 10
      : 0
  }));
}

// -- CALCUL RUPTURES NOUVELLE COLLECTION -----------------------------------
function calculerRupturesNouvelleCollection(donnees, db, periode) {
  const SAISONS_NC = ['26E', '25H'];
  const ARTICLES_EXCLUS_LOCAL = new Set(["91272", "91273", "91274"]);
  const semaines = periode.jours / 7;

  // Articles nouvelle collection en critique ou faible
  const articlesNC = [...donnees.critique, ...donnees.faible].filter(a => {
    const s = (a.saison || '').trim().toUpperCase();
    return SAISONS_NC.includes(s) && !ARTICLES_EXCLUS_LOCAL.has(String(a.codeArticle));
  });

  const ruptures = [];
  for (const art of articlesNC) {
    for (const b of art.analyse || []) {
      if (b.storeId === '001') continue;
      const stock = parseFloat(b.stockActuel || 0);
      const vps   = parseFloat(b.ventesParSemaine || art.ventesParSemaine || 0);
      const jours = vps > 0 ? Math.round((stock / vps) * 7) : 999;

      if (jours <= 21 || stock === 0) {
        ruptures.push({
          code_article: art.codeArticle,
          saison: art.saison,
          storeName: b.storeName,
          storeId: b.storeId,
          stock: stock,
          ventesParSemaine: vps,
          joursRestants: stock === 0 ? 0 : jours
        });
      }
    }
  }

  // Grouper par article
  const grouped = {};
  for (const r of ruptures) {
    const key = r.code_article;
    if (!grouped[key]) grouped[key] = { code_article: r.code_article, saison: r.saison, boutiques: [] };
    grouped[key].boutiques.push({
      storeName: r.storeName,
      storeId: r.storeId,
      stock: r.stock,
      ventesParSemaine: r.ventesParSemaine,
      joursRestants: r.joursRestants
    });
  }

  return Object.values(grouped).sort((a, b) => {
    const minA = Math.min(...a.boutiques.map(x => x.joursRestants));
    const minB = Math.min(...b.boutiques.map(x => x.joursRestants));
    return minA - minB;
  });
}



// Fonction stock temps reel par code article (agregation tous EAN)
async function getStockByCodeArticle(codeArticle) {
  const db = require('./config/database');
  const refs = db.prepare(
    "SELECT DISTINCT reference_article FROM ventes WHERE code_article = ? AND reference_article IS NOT NULL"
  ).all(codeArticle);
  const stockTotal = {};
    await asyncPool(5, refs, async ({ reference_article }) => {
    const result = await cegid.getStockByStore(reference_article);
    if (!result.success || !result.stores.AvailableQtyByStore) return;
    for (const st of result.stores.AvailableQtyByStore) {
      const qty = parseFloat(st.AvailableQty) || 0;
      if (!stockTotal[st.StoreId]) {
        stockTotal[st.StoreId] = { storeId: st.StoreId, description: st.StoreDescription, stock: 0 };
      }
      stockTotal[st.StoreId].stock += qty;
    }
    });
  return Object.values(stockTotal);
}

// ENDPOINT : Stock temps reel par code article
app.get('/stock-article/:codeArticle', async (req, res) => {
  try {
    const code = req.params.codeArticle;
    if (ARTICLES_EXCLUS.has(code)) return res.json({ success: true, codeArticle: code, stockParBoutique: [] });
    const cacheKey = `stock_${code}`;
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
    const stockParBoutique = await getStockByCodeArticle(code);
    const result = { success: true, codeArticle: code, stockParBoutique };
    cacheSet(cacheKey, result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const p = getPeriodeAnalyse();
  console.log(`Serveur dÃ©marrÃ© sur le port ${PORT}`);
  console.log(`Mode actuel : ${p.label} (${p.jours} jours)`);
  console.log(`Cache TTL : 30 minutes`);
});


