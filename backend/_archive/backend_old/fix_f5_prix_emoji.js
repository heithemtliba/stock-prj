const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  // Fix 1: remplacer emojis par texte lisible
  if (lines[i].includes("return ('?? NOUVEAU'")) 
    lines[i] = "        return ('NOUVEAU', \"Exposition insuffisante — laisser en rayon\", \"4472C4\", \"D6E4F7\")";
  if (lines[i].includes("return ('?? URGENT'"))
    lines[i] = "        return ('!! URGENT', \"Regrouper dans boutiques fortes — verifier visibilite\", RED_FG, RED_BG)";
  if (lines[i].includes("return ('?? SURVEILLER'"))
    lines[i] = "        return ('>> SURVEILLER', \"Verifier visibilite / repositionner en boutique\", ORANGE_FG, ORANGE_BG)";
  if (lines[i].includes("return ('?? OK'"))
    lines[i] = "        return ('OK', \"Stock faible — ecoulement naturel proche\", GREEN_FG, GREEN_BG)";
  if (lines[i].includes("return ('?? DEMARQUE URGENTE'"))
    lines[i] = "        return ('!! DEMARQUE URGENTE', \"Stock eleve ancienne saison — demarque immediate\", RED_FG, RED_BG)";
  if (lines[i].includes("return ('?? DEMARQUE'"))
    lines[i] = "        return ('>> DEMARQUE', \"Envisager demarque — article en fin de cycle\", ORANGE_FG, ORANGE_BG)";
  if (lines[i].includes("return ('?? LIQUIDATION'"))
    lines[i] = "        return ('~ LIQUIDATION', \"Laisser ecouler — ne pas reapprovisionner\", \"7B6000\", \"FFF9C4\")";
  if (lines[i].includes("return ('? EPUISE'"))
    lines[i] = "        return ('EPUISE', \"Stock nul — aucune action requise\", \"424242\", \"F5F5F5\")";

  // Fix 2: prix depuis table articles via noms_art (on a deja articles en memoire)
  if (lines[i].includes("prix          = 0")) {
    console.log('Prix ligne', i+1);
    lines[i]   = "    prix = 0";
    lines[i+1] = "    # Prix depuis JSON articles";
    lines[i+2] = "    pass";
  }
}

// Ajouter prix_articles dans le chargement des donnees
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("stock_par_article = data.get('stockParArticle'")) {
    lines.splice(i+1, 0, "  prix_articles    = data.get('prixArticles', {})  # Prix TTC par code article");
    console.log('prix_articles insere ligne', i+2);
    break;
  }
}

// Utiliser prix_articles dans la boucle
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "prix = 0") {
    lines[i] = "    prix = prix_articles.get(str(code), 0)";
    console.log('prix utilise ligne', i+1);
    break;
  }
}

fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK');
