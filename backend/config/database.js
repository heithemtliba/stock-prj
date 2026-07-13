const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../data/mabrouk.db'));

// Créer les tables si elles n'existent pas
db.exec(`
  CREATE TABLE IF NOT EXISTS ventes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date_vente TEXT NOT NULL,
    store_id TEXT NOT NULL,
    reference_article TEXT NOT NULL,
    taille TEXT,
    couleur TEXT,
    quantite REAL NOT NULL,
    source TEXT DEFAULT 'cegid_csv',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(date_vente, store_id, reference_article, taille, couleur)
  );
  CREATE INDEX IF NOT EXISTS idx_reference ON ventes(reference_article);
  CREATE INDEX IF NOT EXISTS idx_store ON ventes(store_id);
  CREATE INDEX IF NOT EXISTS idx_date ON ventes(date_vente);
`);

module.exports = db;