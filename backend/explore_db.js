const db = require('./config/database');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('=== TABLES ===');
tables.forEach(t => console.log(' -', t.name));
tables.forEach(t => {
  try {
    const cols = db.prepare("PRAGMA table_info(" + t.name + ")").all();
    console.log("\n=== " + t.name.toUpperCase() + " ===");
    cols.forEach(c => console.log("  " + c.name + " (" + c.type + ")"));
    const rows = db.prepare("SELECT * FROM " + t.name + " LIMIT 1").all();
    console.log("  Exemple:", JSON.stringify(rows[0] || {}));
  } catch(e) { console.log("  Erreur: " + e.message); }
});
