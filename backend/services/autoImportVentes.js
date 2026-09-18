/**
 * ══════════════════════════════════════════════════════════════════════════
 * AUTO-IMPORT QUOTIDIEN DES VENTES — Cegid → SQLite
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Remplace l'import CSV manuel par un pull automatique via l'API SOAP Cegid.
 * Utilise le endpoint SaleDocumentService pour récupérer les tickets de vente
 * et insérer les lignes dans la table `ventes`.
 *
 * Usage :
 *   - Appelé par le CRON (voir cronJobs.js) chaque nuit à 3h du matin
 *   - Peut aussi être déclenché manuellement via POST /import-auto
 *   - Idempotent : INSERT OR REPLACE évite les doublons
 *
 * Fallback : si l'API SOAP ne retourne pas les lignes de vente détaillées,
 * le système peut importer un CSV déposé dans data/imports/
 *
 * IMPORTANT : Ce fichier doit être adapté au WSDL réel de votre Cegid.
 * Les noms de champs dans le XML varient selon la version de Cegid Y2.
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

// ── RÉCUPÉRER LES VENTES DEPUIS CEGID SOAP ─────────────────────────────
/**
 * ATTENTION : Cette fonction doit être adaptée au WSDL réel de votre Cegid.
 *
 * Option A (préférable) : Si votre Cegid expose GetSaleLineList ou
 * GetDocumentDetailList, utilisez ça pour obtenir directement les lignes
 * de vente avec code_article, reference, taille, couleur, quantite.
 *
 * Option B (fallback) : Utilisez GetHeaderList pour obtenir les numéros
 * de tickets, puis GetDetail pour chaque ticket.
 *
 * Option C (votre setup actuel) : Export CSV automatisé depuis Cegid BO,
 * déposé dans un dossier partagé, et importé par importerCSVAuto().
 */
async function fetchVentesCegid(storeId, beginDate, endDate) {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                 xmlns:tns="${NAMESPACE}">
    <soap:Body>
      <tns:GetHeaderList>
        <tns:searchRequest>
          <tns:StoreId>${storeId}</tns:StoreId>
          <tns:BeginDate>${beginDate}T00:00:00</tns:BeginDate>
          <tns:EndDate>${endDate}T23:59:59</tns:EndDate>
          <tns:DocumentType>SaleDocument</tns:DocumentType>
          <tns:Pager>
            <tns:PageIndex>1</tns:PageIndex>
            <tns:PageSize>500</tns:PageSize>
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
    // Adapter selon la structure réelle de la réponse Cegid
    const body = parsed['s:Envelope']?.['s:Body'];
    const result = body?.GetHeaderListResponse?.GetHeaderListResult;

    if (!result) return { success: true, documents: [] };

    // Normaliser en tableau
    const docs = Array.isArray(result.SaleDocumentHeader)
      ? result.SaleDocumentHeader
      : result.SaleDocumentHeader ? [result.SaleDocumentHeader] : [];

    return { success: true, documents: docs };
  } catch (error) {
    return { success: false, message: error.message, storeId };
  }
}

// ── RÉCUPÉRER LE DÉTAIL D'UN TICKET ─────────────────────────────────────
async function fetchTicketDetail(documentId) {
  const soapBody = `<?xml version="1.0" encoding="utf-8"?>
  <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                 xmlns:tns="${NAMESPACE}">
    <soap:Body>
      <tns:GetDetail>
        <tns:documentKey>
          <tns:DocumentId>${documentId}</tns:DocumentId>
        </tns:documentKey>
        <tns:clientContext>
          <tns:DatabaseId>${config.databaseId}</tns:DatabaseId>
        </tns:clientContext>
      </tns:GetDetail>
    </soap:Body>
  </soap:Envelope>`;

  try {
    const response = await axios.post(SALE_SERVICE_URL, soapBody, {
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `${NAMESPACE}/ISaleDocumentService/GetDetail`
      },
      timeout: TIMEOUT_MS
    });

    const parsed = await parseXML(response.data);
    const body = parsed['s:Envelope']?.['s:Body'];
    const result = body?.GetDetailResponse?.GetDetailResult;

    if (!result) return { success: true, lines: [] };

    const lines = Array.isArray(result.SaleDocumentLine)
      ? result.SaleDocumentLine
      : result.SaleDocumentLine ? [result.SaleDocumentLine] : [];

    return { success: true, lines };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ── IMPORT VIA API SOAP (Option A/B) ────────────────────────────────────
async function importerVentesSoap(db, dateDebut, dateFin, log = console.log) {
  const storeIds = Object.keys(config.stores);
  const beginStr = formatDate(dateDebut);
  const endStr = formatDate(dateFin);

  log(`[AUTO-IMPORT] Période : ${beginStr} → ${endStr}`);
  log(`[AUTO-IMPORT] Boutiques : ${storeIds.length}`);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO ventes
    (date_vente, store_id, code_article, reference_article, taille, couleur, saison, quantite, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cegid_auto')
  `);

  let totalImported = 0;
  let totalErrors = 0;

  for (const storeId of storeIds) {
    try {
      const headersResult = await fetchVentesCegid(storeId, beginStr, endStr);
      if (!headersResult.success) {
        log(`[AUTO-IMPORT] ERREUR ${storeId}: ${headersResult.message}`);
        totalErrors++;
        continue;
      }

      log(`[AUTO-IMPORT] ${storeId}: ${headersResult.documents.length} tickets`);

      for (const doc of headersResult.documents) {
        const docId = doc.DocumentId || doc.Id;
        if (!docId) continue;

        const detail = await fetchTicketDetail(docId);
        if (!detail.success) continue;

        const transaction = db.transaction(() => {
          for (const line of detail.lines) {
            const qte = parseFloat(line.Quantity || line.Qty || 0);
            if (qte <= 0) continue;

            const dateVente = (line.Date || doc.Date || beginStr).substring(0, 10);
            const reference = line.ItemId || line.Reference || '';
            const codeArticle = line.ItemCode || line.CodeArticle || '';
            const taille = line.Size || line.Dimension1 || '';
            const couleur = line.Color || line.Dimension2 || '';
            const saison = line.Season || line.Collection || '';

            if (!reference) continue;

            try {
              insert.run(dateVente, storeId, codeArticle, reference, taille, couleur, saison, qte);
              totalImported++;
            } catch (e) { /* doublon, ignoré */ }
          }
        });
        transaction();
      }
    } catch (error) {
      log(`[AUTO-IMPORT] ERREUR critique ${storeId}: ${error.message}`);
      totalErrors++;
    }
  }

  return { imported: totalImported, errors: totalErrors, period: `${beginStr} → ${endStr}` };
}

// ── IMPORT VIA CSV AUTOMATIQUE (Option C - Fallback) ────────────────────
/**
 * Si vous ne pouvez pas utiliser l'API SOAP pour les ventes,
 * configurez un export CSV automatique depuis Cegid BO vers
 * un dossier partagé. Ce script surveille le dossier et importe
 * les nouveaux fichiers automatiquement.
 */
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
          // Convertir DD/MM/YYYY → YYYY-MM-DD
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

      // Renommer le fichier traité
      const donePath = path.join(importDir, `_done_${file}`);
      fs.renameSync(filePath, donePath);
      log(`[CSV-AUTO] ${file} → ${totalImported} lignes importées`);
    } catch (error) {
      log(`[CSV-AUTO] ERREUR ${file}: ${error.message}`);
    }
  }

  return { imported: totalImported, files: files.length };
}

// ── IMPORT PRINCIPAL (essaie SOAP, fallback CSV) ────────────────────────
async function importQuotidien(db, options = {}) {
  const log = options.log || console.log;
  const dateDebut = options.dateDebut || yesterday();
  const dateFin = options.dateFin || yesterday();

  log(`[IMPORT] ═══ Import quotidien démarré ═══`);
  log(`[IMPORT] Date : ${formatDate(new Date())}`);

  // Enregistrer l'import dans la table de suivi
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
  } catch (e) { /* table existe déjà */ }

  const start = Date.now();
  let result;
  let methode = 'soap';

  // Essai 1 : API SOAP
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
    log(`[IMPORT] CSV: ${result.imported} ventes importées depuis ${result.files || 0} fichiers`);
  }

  const duree = Date.now() - start;

  // Enregistrer dans le log
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
    dureeMs: duree
  };
}

module.exports = { importQuotidien, importerCSVAuto, importerVentesSoap, formatDate };
