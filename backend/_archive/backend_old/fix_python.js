const fs = require('fs');
let s = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8');

// Fix 1 : feuille 2 critiques - utiliser deId/versId et scoreDonneur/scoreReceveur depuis suggestions
s = s.replace(
  "        id_d = str(bd.get('storeId','')); id_r = str(br.get('storeId',''))\n        sc_d = bd.get('score', s.get('scoreDonneur', 0))\n        sc_r = br.get('score', s.get('scoreReceveur', 0))\n        jours_r = br.get('joursStock', 0)\n        stk_d = stock_reel.get(id_d, '\u2014')\n        stk_r = stock_reel.get(id_r, '\u2014')\n        seuil = seuil_transfert(id_r)\n        bg    = RED_BG if row % 2 == 0 else \"FFCDD2\"",
  "        id_d = str(s.get('deId', '')); id_r = str(s.get('versId', ''))\n        sc_d = s.get('scoreDonneur', 0)\n        sc_r = s.get('scoreReceveur', 0)\n        stk_d = bd.get('stock', '\u2014')\n        stk_r = br.get('stock', '\u2014')\n        jours_r = br.get('joursStock', 0)\n        seuil = seuil_transfert(id_r)\n        quantite = s.get('quantite', 0)\n        if isinstance(quantite, (int, float)) and quantite < seuil:\n            continue\n        bg = RED_BG if row % 2 == 0 else \"FFCDD2\""
);

// Fix 2 : remplacer s.get('quantite',0) par quantite dans vals feuille 2
s = s.replace("                s.get('quantite',0), jours_r, seuil,", "                quantite, jours_r, seuil,");

// Fix 3 : meme correction feuille 3 faibles
s = s.replace(
  "        id_d = str(bd.get('storeId','')); id_r = str(br.get('storeId',''))\n        sc_d = bd.get('score', s.get('scoreDonneur', 0))\n        sc_r = br.get('score', s.get('scoreReceveur', 0))\n        jours_r = br.get('joursStock', 0)\n        stk_d = stock_reel.get(id_d, '\u2014')\n        stk_r = stock_reel.get(id_r, '\u2014')\n        bg    = ORANGE_BG if row % 2 == 0 else \"FFE0B2\"",
  "        id_d = str(s.get('deId', '')); id_r = str(s.get('versId', ''))\n        sc_d = s.get('scoreDonneur', 0)\n        sc_r = s.get('scoreReceveur', 0)\n        stk_d = bd.get('stock', '\u2014')\n        stk_r = br.get('stock', '\u2014')\n        jours_r = br.get('joursStock', 0)\n        seuil = seuil_transfert(id_r)\n        quantite = s.get('quantite', 0)\n        if isinstance(quantite, (int, float)) and quantite < seuil:\n            continue\n        bg = ORANGE_BG if row % 2 == 0 else \"FFE0B2\""
);

fs.writeFileSync('../scripts/exportRapportHebdo.py', s, 'utf8');
console.log('OK - lignes:', s.split('\n').length);

// Verifier
const lines = s.split('\n');
lines.forEach((l, i) => { if (l.includes('deId') || l.includes('scoreDonneur')) console.log(i+1, l.trim()); });
