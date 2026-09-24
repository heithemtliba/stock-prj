'use strict';

function estCodeArticle(ref, db) {
  // 13 chiffres = EAN, pas un code_article
  if (/^\d{13}$/.test(ref)) return false;
  try {
    return !!db.prepare('SELECT 1 FROM ventes WHERE code_article = ? LIMIT 1').get(ref);
  } catch (e) {
    return false; // en cas de doute → EAN (comportement d'origine)
  }
}

module.exports = { estCodeArticle };