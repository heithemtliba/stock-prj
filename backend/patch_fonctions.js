// -- CALCUL SCORES MAGASINS -------------------------------------------------
function calculerScoresMagasins(donnees) {
  const statsParStore = {};

  // Compter critiques par store
  for (const art of donnees.critique) {
    for (const b of art.analyse || []) {
      const sid = b.storeId;
      if (!sid || sid === '001') continue;
      if (!statsParStore[sid]) statsParStore[sid] = { storeId: sid, storeName: b.storeName, nbArticlesExposes: 0, nbCritiques: 0, nbFaibles: 0 };
      statsParStore[sid].nbArticlesExposes++;
      if (b.statut === 'CRITIQUE') statsParStore[sid].nbCritiques++;
    }
  }
  // Compter faibles par store
  for (const art of donnees.faible) {
    for (const b of art.analyse || []) {
      const sid = b.storeId;
      if (!sid || sid === '001') continue;
      if (!statsParStore[sid]) statsParStore[sid] = { storeId: sid, storeName: b.storeName, nbArticlesExposes: 0, nbCritiques: 0, nbFaibles: 0 };
      statsParStore[sid].nbArticlesExposes++;
      if (b.statut === 'FAIBLE') statsParStore[sid].nbFaibles++;
    }
  }
  // Compter OK par store
  for (const art of donnees.ok) {
    for (const b of art.analyse || []) {
      const sid = b.storeId;
      if (!sid || sid === '001') continue;
      if (!statsParStore[sid]) statsParStore[sid] = { storeId: sid, storeName: b.storeName, nbArticlesExposes: 0, nbCritiques: 0, nbFaibles: 0 };
      statsParStore[sid].nbArticlesExposes++;
    }
  }

  return Object.values(statsParStore).map(s => ({
    ...s,
    scorePct: s.nbArticlesExposes > 0
      ? Math.round((s.nbCritiques / s.nbArticlesExposes) * 100 * 10) / 10
      : 0
  }));
}

// -- CALCUL RUPTURES NOUVELLE COLLECTION -----------------------------------
function calculerRupturesNouvelleCollection(donnees, db, periode) {
  const SAISONS_NC = ['26E', '25H'];
  const ARTICLES_EXCLUS_LOCAL = new Set(["91272", "91273", "91274"]);
  const semaines = periode.jours / 7;

  // Articles nouvelle collection en critique ou faible
  const articlesNC = [...donnees.critique, ...donnees.faible].filter(a => {
    const s = (a.saison || '').trim().toUpperCase();
    return SAISONS_NC.includes(s) && !ARTICLES_EXCLUS_LOCAL.has(String(a.codeArticle));
  });

  const ruptures = [];
  for (const art of articlesNC) {
    for (const b of art.analyse || []) {
      if (b.storeId === '001') continue;
      const stock = parseFloat(b.stockActuel || 0);
      const vps   = parseFloat(b.ventesParSemaine || art.ventesParSemaine || 0);
      const jours = vps > 0 ? Math.round((stock / vps) * 7) : 999;

      if (jours <= 21 || stock === 0) {
        ruptures.push({
          code_article: art.codeArticle,
          saison: art.saison,
          storeName: b.storeName,
          storeId: b.storeId,
          stock: stock,
          ventesParSemaine: vps,
          joursRestants: stock === 0 ? 0 : jours
        });
      }
    }
  }

  // Grouper par article
  const grouped = {};
  for (const r of ruptures) {
    const key = r.code_article;
    if (!grouped[key]) grouped[key] = { code_article: r.code_article, saison: r.saison, boutiques: [] };
    grouped[key].boutiques.push({
      storeName: r.storeName,
      storeId: r.storeId,
      stock: r.stock,
      ventesParSemaine: r.ventesParSemaine,
      joursRestants: r.joursRestants
    });
  }

  return Object.values(grouped).sort((a, b) => {
    const minA = Math.min(...a.boutiques.map(x => x.joursRestants));
    const minB = Math.min(...b.boutiques.map(x => x.joursRestants));
    return minA - minB;
  });
}
