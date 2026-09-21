/**
 * ══════════════════════════════════════════════════════════════════════════
 * AUTO-IMPORT QUOTIDIEN DES VENTES — Cegid → SQLite (OPTIMISÉ)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Méthodes SOAP utilisées :
 *   - GetHeaderList : liste des documents de vente (entêtes)
 *   - GetByKey      : détail d'un document (lignes)
 *
 * OPTIMISATION : appels GetByKey parallélisés (10 en même temps)
 *   → 425 documents en ~15 secondes (au lieu de 115)
 *
 * Fallback CSV : si l'API SOAP échoue, importe les CSV déposés dans data/imports/
 * ══════════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const config = require('../config/cegid');

const NAMESPACE = 'http://www.cegid.fr/Retail/1.0';
const SALE_SERVICE_URL = `${config.baseUrl}/Y2/SaleDocumentService.svc`;
const TIMEOUT_MS = Number(process.env.CEGID_IMPORT_TIMEOUT_MS || 30000);

function getAuthHeader() {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
}

async function parseXML(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      err ? reject(err) : resolve(result);
    });
  });
}

// ── ASYNC POOL (limite la concurrence) ──────────────────────────────────
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

// ── FORMAT DATE ─────────────────────────────────────────────────────────
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

// ── EXTRAIRE TAILLE ET COULEUR DU LABEL ─────────────────────────────────
function extraireTailleCouleur(label) {
  if (!label) return { taille: '', couleur: '' };

  const parts = label.trim().split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const beforeLast = parts[parts.length - 2];

    if (/^[A-Z0-9]+$/.test(last) && /^[A-Z0-9/]+$/.test(beforeLast)) {
      return { taille: beforeLast, couleur: last };
    }
  }

  return { taille: '', couleur: '' };
}

// ── RÉCUPÉRER LES ENTÊTES DE VENTES ─────────────────────────────────────
async function fetchVentesCegid(storeIds, beginDate, endDate, pageIndex = 1, pageSize = 500) {
  const storeIdsXml = storeIds.map(id => `<a:string>${id}</a:string>`).join('');

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="${NAMESPACE}"
               xmlns:a="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
  <soap:Body>
    <tns:GetHeaderList>
      <tns:searchRequest>
        <tns:BeginDate>${beginDate}T00:00:00</tns:BeginDate>
        <tns:EndDate>${endDate}T00:00:00</tns:EndDate>
        <tns:StoreIds>
          ${storeIdsXml}
        </tns:StoreIds>
        <tns:Pager>
          <tns:PageIndex>${pageIndex}</tns:PageIndex>
          <tns:PageSize>${pageSize}</tns:PageSize>
        </tns:Pager>
      </tns:searchRequest>
      <tns:clientContext>
        <tns:DatabaseId>${config.databaseId}</tns:DatabaseId>
      </tns:clientContext>
    </tns:GetHeaderList>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await axios.post(SALE_SERVICE_URL, soapBody, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}/ISaleDocumentService/GetHeaderList`
      },
      timeout: TIMEOUT_MS
    });

    const parsed = await parseXML(response.data);
    const body = parsed['s:Envelope']?.['s:Body'];
    const result = body?.GetHeaderListResponse?.GetHeaderListResult;

    if (!result || !result.Headers) {
      return { success: true, documents: [] };
    }

    const headers = result.Headers.Get_Header;
    const docs = Array.isArray(headers) ? headers : (headers ? [headers] : []);

    return { success: true, documents: docs };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ── RÉCUPÉRER LE DÉTAIL D'UN DOCUMENT ───────────────────────────────────
async function fetchTicketDetail(key) {
  if (!key || !key.Number || !key.Stump || !key.Type) {
    return { success: false, message: 'Key incomplète' };
  }

  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="${NAMESPACE}">
  <soap:Body>
    <tns:GetByKey>
      <tns:searchRequest>
        <tns:Key>
          <tns:Number>${key.Number}</tns:Number>
          <tns:Stump>${key.Stump}</tns:Stump>
          <tns:Type>${key.Type}</tns:Type>
        </tns:Key>
      </tns:searchRequest>
      <tns:clientContext>
        <tns:DatabaseId>${config.databaseId}</tns:DatabaseId>
      </tns:clientContext>
    </tns:GetByKey>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await axios.post(SALE_SERVICE_URL, soapBody, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}/ISaleDocumentService/GetByKey`
      },
      timeout: TIMEOUT_MS
    });

    const parsed = await parseXML(response.data);
    const body = parsed['s:Envelope']?.['s:Body'];
    const result = body?.GetByKeyResponse?.GetByKeyResult;

    if (!result) return { success: true, lines: [], header: null };

    const lines = result.Lines?.Get_Line;
    const list = Array.isArray(lines) ? lines : (lines ? [lines] : []);

    return { success: true, lines: list, header: result.Header };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ── IMPORT VIA API SOAP (PARALLÉLISÉ) ───────────────────────────────────
async function importerVentesSoap(db, dateDebut, dateFin, log = console.log) {
  const storeIds = Object.keys(config.stores);
  const beginStr = formatDate(dateDebut);
  const endStr = formatDate(dateFin);

  log(`[AUTO-IMPORT] Période : ${beginStr} → ${endStr}`);
  log(`[AUTO-IMPORT] Magasins : ${storeIds.length}`);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO ventes
    (date_vente, store_id, code_article, reference_article, taille, couleur, saison, quantite, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cegid_auto')
  `);

  let totalImported = 0;
  let totalErrors = 0;
  let totalDocuments = 0;

  // Récupérer tous les headers (pagination)
  let pageIndex = 1;
  const pageSize = 500;
  let allDocs = [];

  while (true) {
    const headersResult = await fetchVentesCegid(storeIds, beginStr, endStr, pageIndex, pageSize);
    if (!headersResult.success) {
      log(`[AUTO-IMPORT] ERREUR GetHeaderList: ${headersResult.message}`);
      totalErrors++;
      break;
    }

    if (headersResult.documents.length === 0) break;

    allDocs = allDocs.concat(headersResult.documents);
    log(`[AUTO-IMPORT] Page ${pageIndex}: ${headersResult.documents.length} documents`);

    if (headersResult.documents.length < pageSize) break;
    pageIndex++;

    if (pageIndex > 100) {
      log(`[AUTO-IMPORT] Limite de pagination atteinte (100 pages)`);
      break;
    }
  }

  log(`[AUTO-IMPORT] Total documents à traiter : ${allDocs.length}`);

  // ✅ OPTIMISATION : Traitement PARALLÈLE (10 en même temps)
  const CONCURRENCY = 10;
  log(`[AUTO-IMPORT] Traitement parallèle (concurrence: ${CONCURRENCY})...`);

  const startProcess = Date.now();
  let processed = 0;

  const results = await asyncPool(CONCURRENCY, allDocs, async (doc) => {
    if (!doc.Key) return { error: true };

    try {
      const detail = await fetchTicketDetail(doc.Key);
      if (!detail.success) return { error: true };

      const dateVente = (doc.Date || beginStr).substring(0, 10);
      let imported = 0;

      const transaction = db.transaction(() => {
        for (const line of detail.lines) {
          // Ignorer les taxes
          if (line.ItemCode && line.ItemCode.startsWith('TAXE')) continue;

          const qte = parseFloat(line.Quantity || 0);
          if (qte <= 0) continue;

          const ean = line.ItemReference || '';
          const codeArticle = line.ItemCode || '';
          const label = line.Label || '';
          const { taille, couleur } = extraireTailleCouleur(label);

          if (!ean) continue;

          const saison = '';

          try {
            insert.run(dateVente, doc.StoreId, codeArticle, ean, taille, couleur, saison, qte);
            imported++;
          } catch (e) { /* doublon */ }
        }
      });
      transaction();

      return { imported };
    } catch (error) {
      return { error: true, message: error.message };
    }
  });

  // Compter les résultats
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      if (r.value.error) {
        totalErrors++;
      } else {
        totalImported += r.value.imported || 0;
        totalDocuments++;
      }
    } else {
      totalErrors++;
    }
  }

  const durationProcess = ((Date.now() - startProcess) / 1000).toFixed(1);
  log(`[AUTO-IMPORT] Traitement terminé en ${durationProcess}s (${totalImported} ventes, ${totalErrors} erreurs)`);

  return {
    imported: totalImported,
    errors: totalErrors,
    documents: totalDocuments,
    period: `${beginStr} → ${endStr}`
  };
}

// ── IMPORT VIA CSV AUTOMATIQUE (Fallback) ───────────────────────────────
function importerCSVAuto(db, log = console.log) {
  const importDir = path.join(__dirname, '../../data/imports');
  if (!fs.existsSync(importDir)) {
    fs.mkdirSync(importDir, { recursive: true });
    log(`[CSV-AUTO] Dossier créé : ${importDir}`);
    return { imported: 0, message: 'Dossier imports créé — déposez les CSV ici' };
  }

  const files = fs.readdirSync(importDir).filter(f => f.endsWith('.csv') && !f.startsWith('_done_'));
  if (files.length === 0) {
    log('[CSV-AUTO] Aucun nouveau fichier CSV');
    return { imported: 0, files: 0 };
  }

  const insert = db.prepare(`
    INSERT OR REPLACE INTO ventes
    (date_vente, store_id, code_article, reference_article, taille, couleur, saison, quantite, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'csv_auto')
  `);

  let totalImported = 0;

  for (const file of files) {
    const filePath = path.join(importDir, file);
    log(`[CSV-AUTO] Import : ${file}`);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.replace(/\r\n/g, '\n').split('\n').slice(1).filter(l => l.trim());

      const importBatch = db.transaction(() => {
        for (const line of lines) {
          const parts = line.split(';');
          if (parts.length < 8) continue;

          let dateVente = parts[0].trim();
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateVente)) {
            const [j, m, a] = dateVente.split('/');
            dateVente = `${a}-${m}-${j}`;
          }

          const storeId = parts[1].trim();
          const codeArticle = parts[2].trim();
          const reference = parts[3].trim();
          const taille = parts[4].trim();
          const couleur = parts[5].trim();
          const saison = parts[6].trim();
          const quantiteRaw = parts[8] ? parts[8].trim() : parts[7].trim();
          const quantite = parseFloat(quantiteRaw.replace(',', '.'));

          if (isNaN(quantite) || quantite <= 0 || !storeId || !reference) continue;
          if (!dateVente) continue;

          try {
            insert.run(dateVente, storeId, codeArticle, reference, taille, couleur, saison, quantite);
            totalImported++;
          } catch (e) { /* doublon */ }
        }
      });
      importBatch();

      const donePath = path.join(importDir, `_done_${file}`);
      fs.renameSync(filePath, donePath);
      log(`[CSV-AUTO] ${file} → ${totalImported} lignes importées`);
    } catch (error) {
      log(`[CSV-AUTO] ERREUR ${file}: ${error.message}`);
    }
  }

  return { imported: totalImported, files: files.length };
}

// ── IMPORT PRINCIPAL ────────────────────────────────────────────────────
async function importQuotidien(db, options = {}) {
  const log = options.log || console.log;
  const dateDebut = options.dateDebut || yesterday();
  const dateFin = options.dateFin || yesterday();

  log(`[IMPORT] ═══ Import quotidien démarré ═══`);
  log(`[IMPORT] Date : ${formatDate(new Date())}`);

  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS import_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date_import TEXT NOT NULL,
        methode TEXT NOT NULL,
        periode_debut TEXT,
        periode_fin TEXT,
        nb_importes INTEGER DEFAULT 0,
        nb_erreurs INTEGER DEFAULT 0,
        duree_ms INTEGER DEFAULT 0,
        statut TEXT DEFAULT 'en_cours',
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
  } catch (e) { /* existe déjà */ }

  const start = Date.now();
  let result;
  let methode = 'soap';

  try {
    result = await importerVentesSoap(db, dateDebut, dateFin, log);
    if (result.imported === 0 && result.errors > 0) {
      throw new Error('API SOAP échouée — fallback CSV');
    }
    log(`[IMPORT] SOAP: ${result.imported} ventes importées, ${result.errors} erreurs`);
  } catch (soapError) {
    log(`[IMPORT] SOAP indisponible: ${soapError.message}`);
    log(`[IMPORT] Tentative fallback CSV...`);
    methode = 'csv_auto';
    result = importerCSVAuto(db, log);
    log(`[IMPORT] CSV: ${result.imported} ventes importées`);
  }

  const duree = Date.now() - start;

  try {
    db.prepare(`
      INSERT INTO import_log (date_import, methode, periode_debut, periode_fin, nb_importes, nb_erreurs, duree_ms, statut, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      formatDate(new Date()),
      methode,
      formatDate(dateDebut),
      formatDate(dateFin),
      result.imported || 0,
      result.errors || 0,
      duree,
      result.imported > 0 ? 'ok' : 'vide',
      JSON.stringify(result)
    );
  } catch (e) { /* pas grave */ }

  log(`[IMPORT] ═══ Terminé en ${duree}ms ═══`);

  return {
    success: true,
    methode,
    imported: result.imported || 0,
    errors: result.errors || 0,
    documents: result.documents || 0,
    dureeMs: duree
  };
}

module.exports = { importQuotidien, importerCSVAuto, importerVentesSoap, formatDate };