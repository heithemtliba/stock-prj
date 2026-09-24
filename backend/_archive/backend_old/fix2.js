const fs = require('fs');
let s = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8');

// Fix : remplacer le bloc problematique dans feuille 2
const old = `        stk_d = stock_reel.get(id_d, '\u2014')
        stk_r = stock_reel.get(id_r, '\u2014')
        seuil = seuil_transfert(id_r)
        bg    = RED_BG if row % 2 == 0 else "FFCDD2"
        vals = [code, nom, saison, sc_d, nd, stk_d, sc_r, nr, stk_r,
                quantite, jours_r, seuil,`;

const newv = `        stk_d = bd.get('stock', '—') if bd else '—'
        stk_r = br.get('stock', '—') if br else '—'
        seuil = seuil_transfert(id_r)
        quantite = s.get('quantite', 0)
        if isinstance(quantite, (int, float)) and quantite < seuil:
            continue
        bg = RED_BG if row % 2 == 0 else "FFCDD2"
        vals = [code, nom, saison, sc_d, nd, stk_d, sc_r, nr, stk_r,
                quantite, jours_r, seuil,`;

// Compter occurrences
const count = (s.match(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
console.log('occurrences trouvees:', count);
s = s.split(old).join(newv);
fs.writeFileSync('../scripts/exportRapportHebdo.py', s, 'utf8');
console.log('OK lignes:', s.split('\n').length);
