const fs = require('fs');
let s = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8');

// Remplacer la fonction seuil_transfert
const oldFn = `def seuil_transfert(id_receveur):
    if str(id_receveur) in STORES_SUD:    return 8
    if str(id_receveur) in STORES_CENTRE: return 5
    if str(id_receveur) in STORES_NORD:   return 5
    return 1`;

const newFn = `def seuil_transfert(id_donneur, id_receveur):
    id_d = str(id_donneur); id_r = str(id_receveur)
    # Si donneur est Sfax/Sfax Mall -> seuil eleve car transport couteux
    if id_d in STORES_SUD:    return 8
    if id_d in STORES_CENTRE: return 5
    if id_d in STORES_NORD:   return 5
    # Si receveur est loin -> seuil eleve
    if id_r in STORES_SUD:    return 8
    if id_r in STORES_CENTRE: return 5
    if id_r in STORES_NORD:   return 5
    return 1`;

s = s.replace(oldFn, newFn);

// Mettre a jour les appels a seuil_transfert
s = s.replace(/seuil = seuil_transfert\(id_r\)/g, 'seuil = seuil_transfert(id_d, id_r)');

console.log('seuil_transfert updated:', (s.match(/def seuil_transfert/g)||[]).length);
console.log('appels mis a jour:', (s.match(/seuil_transfert\(id_d, id_r\)/g)||[]).length);
fs.writeFileSync('../scripts/exportRapportHebdo.py', s, 'utf8');
console.log('OK');
