require("dotenv").config();
const db = require("./config/database");

const avant = db.prepare("SELECT COUNT(*) as n FROM ventes WHERE strftime('%Y-%m', date_vente) = '2026-03'").get();
console.log("Lignes Mars avant import:", avant.n);

const derniereDate = db.prepare("SELECT MAX(date_vente) as d FROM ventes WHERE strftime('%Y-%m', date_vente) = '2026-03'").get();
console.log("Derniere date Mars:", derniereDate.d);
