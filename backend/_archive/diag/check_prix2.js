require("dotenv").config();
const db = require("../config/database");

// Verifier que prixArticles est bien calcule dans server.js
const codes = ["21189","21402","22297","22044"];
const prix = {};
for (const code of codes) {
  const a = db.prepare("SELECT prix_detail FROM articles WHERE code_article = ?").get(code);
  if (a) prix[code] = a.prix_detail;
}
console.log("Prix depuis DB:", prix);
