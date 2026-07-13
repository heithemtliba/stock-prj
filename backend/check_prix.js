require("dotenv").config();
const db = require("./config/database");
const r = db.prepare("SELECT code_article, prix_detail FROM articles WHERE code_article IN ('21189','21402','22297')").all();
console.log(r);
