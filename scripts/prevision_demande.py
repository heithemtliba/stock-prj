"""
══════════════════════════════════════════════════════════════════════════
PRÉVISION DE LA DEMANDE — Machine Learning
══════════════════════════════════════════════════════════════════════════

Remplace la moyenne plate (total_vendu / nb_semaines) par un modèle
LightGBM qui prédit les ventes par article × boutique pour les
prochaines semaines.

Features utilisées :
  - Jour de la semaine (lun-dim)
  - Semaine de l'année (saisonnalité)
  - Mois
  - Boutique (one-hot)
  - Saison collection (25H, 25E, 26E...)
  - Position dans le cycle de saison (début/milieu/fin)
  - Moyenne mobile 7j, 14j, 28j
  - Tendance (pente sur les 4 dernières semaines)
  - Prix unitaire

Usage :
  python prevision_demande.py --db ../data/mabrouk.db --output previsions.json
  python prevision_demande.py --db ../data/mabrouk.db --article 22064 --horizon 14

══════════════════════════════════════════════════════════════════════════
"""

import sqlite3
import json
import sys
import os
import argparse
from datetime import datetime, timedelta
from collections import defaultdict

import numpy as np

# ── Essayer d'importer les librairies ML ─────────────────────────────────
try:
    import lightgbm as lgb
    HAS_LGBM = True
except ImportError:
    HAS_LGBM = False

try:
    from prophet import Prophet
    HAS_PROPHET = True
except ImportError:
    HAS_PROPHET = False


# ══════════════════════════════════════════════════════════════════════════
# MÉTHODE 1 : Moyenne mobile pondérée (toujours disponible, pas de dépendance)
# ══════════════════════════════════════════════════════════════════════════
def prevision_moyenne_ponderee(ventes_quotidiennes, horizon=14):
    """
    Amélioration simple de la moyenne plate :
    - Moyenne pondérée (semaines récentes comptent plus)
    - Calcul de la tendance (accélère ou ralentit)
    - Intervalle de confiance basé sur la variabilité

    Retourne : prévision par jour, tendance, variabilité
    """
    if not ventes_quotidiennes or len(ventes_quotidiennes) < 7:
        return {
            'prevision_par_semaine': 0,
            'tendance': 1.0,
            'variabilite': 0,
            'methode': 'insuffisant',
            'previsions': []
        }

    # Convertir en array numpy
    ventes = np.array(ventes_quotidiennes, dtype=float)

    # Moyennes par période
    if len(ventes) >= 28:
        moy_4sem = np.mean(ventes[-28:])
        moy_2sem = np.mean(ventes[-14:])
        moy_1sem = np.mean(ventes[-7:])
        # Moyenne pondérée : récent compte plus
        moy_ponderee = moy_1sem * 0.5 + moy_2sem * 0.3 + moy_4sem * 0.2
        tendance = moy_1sem / moy_4sem if moy_4sem > 0 else 1.0
    elif len(ventes) >= 14:
        moy_2sem = np.mean(ventes[-14:])
        moy_1sem = np.mean(ventes[-7:])
        moy_ponderee = moy_1sem * 0.6 + moy_2sem * 0.4
        tendance = moy_1sem / moy_2sem if moy_2sem > 0 else 1.0
    else:
        moy_ponderee = np.mean(ventes[-7:])
        tendance = 1.0

    # Variabilité (coefficient de variation)
    if len(ventes) >= 14:
        # Calculer les totaux hebdomadaires pour mesurer la variabilité
        semaines = []
        for i in range(0, len(ventes) - 6, 7):
            semaines.append(sum(ventes[i:i+7]))
        if len(semaines) >= 2 and np.mean(semaines) > 0:
            variabilite = np.std(semaines) / np.mean(semaines)
        else:
            variabilite = 0
    else:
        variabilite = 0

    # Prévisions jour par jour (avec jour de la semaine)
    previsions = []
    if len(ventes) >= 7:
        # Profil jour de la semaine
        profil_jour = np.zeros(7)
        count_jour = np.zeros(7)
        for i, v in enumerate(ventes):
            # On ne connaît pas le jour exact, on utilise les positions
            jour = i % 7
            profil_jour[jour] += v
            count_jour[jour] += 1
        profil_jour = np.where(count_jour > 0, profil_jour / count_jour, moy_ponderee)
        # Normaliser pour que la moyenne = moy_ponderee
        if profil_jour.mean() > 0:
            profil_jour = profil_jour * (moy_ponderee / profil_jour.mean())

        for j in range(horizon):
            jour = (len(ventes) + j) % 7
            prev = max(0, profil_jour[jour] * min(2, max(0.5, tendance)))
            previsions.append(round(prev, 2))
    else:
        previsions = [round(moy_ponderee, 2)] * horizon

    return {
        'prevision_par_jour': round(moy_ponderee, 3),
        'prevision_par_semaine': round(moy_ponderee * 7, 2),
        'tendance': round(tendance, 3),
        'variabilite': round(variabilite, 3),
        'methode': 'moyenne_ponderee',
        'previsions': previsions
    }


# ══════════════════════════════════════════════════════════════════════════
# MÉTHODE 2 : LightGBM (si installé)
# ══════════════════════════════════════════════════════════════════════════
def creer_features(dates, ventes, store_id, saison, prix=0):
    """Crée les features pour chaque jour."""
    features = []
    targets = []

    for i in range(28, len(dates)):  # Besoin de 28 jours d'historique
        d = dates[i]
        dt = datetime.strptime(d, '%Y-%m-%d')

        # Features temporelles
        jour_semaine = dt.weekday()  # 0=lundi
        semaine_annee = dt.isocalendar()[1]
        mois = dt.month
        est_weekend = 1 if jour_semaine >= 5 else 0

        # Moyennes mobiles
        moy_7j = np.mean(ventes[i-7:i])
        moy_14j = np.mean(ventes[i-14:i])
        moy_28j = np.mean(ventes[i-28:i])

        # Tendance (pente linéaire sur 14 jours)
        x = np.arange(14)
        y = np.array(ventes[i-14:i])
        if np.std(y) > 0:
            slope = np.polyfit(x, y, 1)[0]
        else:
            slope = 0

        # Écart-type 14 jours (variabilité)
        std_14j = np.std(ventes[i-14:i])

        # Jour précédent, même jour semaine précédente
        vente_j_1 = ventes[i-1]
        vente_j_7 = ventes[i-7]

        # Saison encoding
        saison_map = {'25H': 0, '25E': 1, '26E': 2, '24H': 3, '24E': 4}
        saison_code = saison_map.get(str(saison).strip().upper(), 5)

        feat = [
            jour_semaine, semaine_annee, mois, est_weekend,
            moy_7j, moy_14j, moy_28j,
            slope, std_14j,
            vente_j_1, vente_j_7,
            saison_code,
            int(store_id) if store_id.isdigit() else hash(store_id) % 100,
            prix
        ]
        features.append(feat)
        targets.append(ventes[i])

    return np.array(features), np.array(targets)


FEATURE_NAMES = [
    'jour_semaine', 'semaine_annee', 'mois', 'est_weekend',
    'moy_7j', 'moy_14j', 'moy_28j',
    'slope_14j', 'std_14j',
    'vente_j_1', 'vente_j_7',
    'saison_code', 'store_code', 'prix'
]


def entrainer_lgbm(X, y):
    """Entraîne un modèle LightGBM."""
    if not HAS_LGBM:
        raise ImportError("LightGBM non installé. pip install lightgbm")

    # Split train/test
    split = int(len(X) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]

    train_data = lgb.Dataset(X_train, label=y_train, feature_name=FEATURE_NAMES)
    test_data = lgb.Dataset(X_test, label=y_test, reference=train_data)

    params = {
        'objective': 'regression',
        'metric': 'rmse',
        'learning_rate': 0.05,
        'num_leaves': 15,
        'max_depth': 5,
        'min_data_in_leaf': 5,
        'feature_fraction': 0.8,
        'bagging_fraction': 0.8,
        'bagging_freq': 5,
        'verbose': -1
    }

    model = lgb.train(
        params, train_data,
        valid_sets=[test_data],
        num_boost_round=200,
        callbacks=[lgb.early_stopping(20), lgb.log_evaluation(0)]
    )

    # Évaluation
    pred_test = model.predict(X_test)
    rmse = np.sqrt(np.mean((pred_test - y_test) ** 2))
    mae = np.mean(np.abs(pred_test - y_test))

    return model, {'rmse': round(rmse, 3), 'mae': round(mae, 3), 'n_train': len(X_train), 'n_test': len(X_test)}


def prevoir_lgbm(model, derniers_28j, dates_28j, store_id, saison, prix, horizon=14):
    """Prévision sur les prochains jours avec le modèle entraîné."""
    ventes = list(derniers_28j)
    dates = list(dates_28j)
    previsions = []

    for j in range(horizon):
        # Prochaine date
        last_date = datetime.strptime(dates[-1], '%Y-%m-%d')
        next_date = last_date + timedelta(days=1)
        next_str = next_date.strftime('%Y-%m-%d')

        dt = next_date
        jour_semaine = dt.weekday()
        semaine_annee = dt.isocalendar()[1]
        mois = dt.month
        est_weekend = 1 if jour_semaine >= 5 else 0

        moy_7j = np.mean(ventes[-7:])
        moy_14j = np.mean(ventes[-14:])
        moy_28j = np.mean(ventes[-28:])

        x = np.arange(14)
        y = np.array(ventes[-14:])
        slope = np.polyfit(x, y, 1)[0] if np.std(y) > 0 else 0
        std_14j = np.std(ventes[-14:])

        saison_map = {'25H': 0, '25E': 1, '26E': 2, '24H': 3, '24E': 4}
        saison_code = saison_map.get(str(saison).strip().upper(), 5)

        feat = np.array([[
            jour_semaine, semaine_annee, mois, est_weekend,
            moy_7j, moy_14j, moy_28j,
            slope, std_14j,
            ventes[-1], ventes[-7],
            saison_code,
            int(store_id) if store_id.isdigit() else hash(store_id) % 100,
            prix
        ]])

        pred = max(0, model.predict(feat)[0])
        previsions.append(round(pred, 2))

        # Ajouter la prévision à l'historique pour la prochaine itération
        ventes.append(pred)
        dates.append(next_str)

    return previsions


# ══════════════════════════════════════════════════════════════════════════
# PIPELINE PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════
def charger_ventes(db_path, code_article=None, store_id=None, jours=180):
    """Charge les ventes depuis SQLite, normalisées par jour."""
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    where = ["date_vente >= date('now', ? || ' days')"]
    params = [f'-{jours}']

    if code_article:
        where.append("code_article = ?")
        params.append(code_article)
    if store_id:
        where.append("store_id = ?")
        params.append(store_id)

    where_str = " AND ".join(where)

    # Normaliser les dates DD/MM/YYYY → YYYY-MM-DD dans la requête
    query = f"""
        SELECT
          CASE
            WHEN date_vente LIKE '__/__/____'
            THEN substr(date_vente,7,4) || '-' || substr(date_vente,4,2) || '-' || substr(date_vente,1,2)
            ELSE date_vente
          END as date_norm,
          store_id,
          code_article,
          saison,
          SUM(quantite) as total
        FROM ventes
        WHERE {where_str}
        GROUP BY date_norm, store_id, code_article
        ORDER BY date_norm
    """
    rows = c.execute(query, params).fetchall()

    # Charger les prix
    prix = {}
    for row in c.execute("SELECT code_article, prix_detail FROM articles WHERE prix_detail > 0").fetchall():
        prix[row[0]] = row[1]

    conn.close()
    return rows, prix


def pipeline_prevision(db_path, code_article=None, horizon=14, methode='auto'):
    """
    Pipeline complet de prévision.

    methode: 'auto' (meilleur dispo), 'moyenne', 'lgbm', 'prophet'
    """
    rows, prix_articles = charger_ventes(db_path, code_article)

    if not rows:
        return {'erreur': 'Aucune donnée de vente trouvée', 'code_article': code_article}

    # Organiser par (code_article, store_id) → séries temporelles
    series = defaultdict(lambda: {'dates': [], 'ventes': [], 'saison': '', 'store_id': ''})
    for date, store, code, saison, total in rows:
        key = f"{code}_{store}"
        series[key]['dates'].append(date)
        series[key]['ventes'].append(float(total))
        series[key]['saison'] = saison or ''
        series[key]['store_id'] = store
        series[key]['code_article'] = code

    resultats = {}

    for key, data in series.items():
        code = data['code_article']
        store = data['store_id']
        saison = data['saison']
        prix = prix_articles.get(code, 0)

        # Remplir les jours manquants avec 0
        if len(data['dates']) >= 2:
            date_debut = datetime.strptime(data['dates'][0], '%Y-%m-%d')
            date_fin = datetime.strptime(data['dates'][-1], '%Y-%m-%d')
            toutes_dates = []
            toutes_ventes = []
            ventes_dict = dict(zip(data['dates'], data['ventes']))
            current = date_debut
            while current <= date_fin:
                d_str = current.strftime('%Y-%m-%d')
                toutes_dates.append(d_str)
                toutes_ventes.append(ventes_dict.get(d_str, 0))
                current += timedelta(days=1)
        else:
            toutes_dates = data['dates']
            toutes_ventes = data['ventes']

        # Choisir la méthode
        use_lgbm = (methode == 'lgbm' or (methode == 'auto' and HAS_LGBM)) and len(toutes_ventes) >= 56
        use_prophet = (methode == 'prophet' or (methode == 'auto' and HAS_PROPHET and not HAS_LGBM)) and len(toutes_ventes) >= 28

        if use_lgbm:
            try:
                X, y = creer_features(toutes_dates, toutes_ventes, store, saison, prix)
                if len(X) >= 20:
                    model, metrics = entrainer_lgbm(X, y)
                    previsions = prevoir_lgbm(model, toutes_ventes[-28:], toutes_dates[-28:], store, saison, prix, horizon)
                    prev_semaine = sum(previsions[:7])

                    resultats[key] = {
                        'code_article': code,
                        'store_id': store,
                        'saison': saison,
                        'prix': prix,
                        'methode': 'lgbm',
                        'metrics': metrics,
                        'prevision_par_semaine': round(prev_semaine, 2),
                        'prevision_par_jour': round(prev_semaine / 7, 3),
                        'tendance': round(np.mean(toutes_ventes[-7:]) / max(0.01, np.mean(toutes_ventes[-28:])), 3),
                        'previsions_quotidiennes': previsions,
                        'historique_jours': len(toutes_ventes)
                    }
                    continue
            except Exception as e:
                pass  # Fallback to simple method

        # Méthode par défaut : moyenne pondérée améliorée
        result = prevision_moyenne_ponderee(toutes_ventes, horizon)
        result['code_article'] = code
        result['store_id'] = store
        result['saison'] = saison
        result['prix'] = prix
        result['historique_jours'] = len(toutes_ventes)
        resultats[key] = result

    return resultats


# ══════════════════════════════════════════════════════════════════════════
# EXPORT POUR LE SERVEUR NODE (JSON)
# ══════════════════════════════════════════════════════════════════════════
def exporter_previsions(db_path, output_path, horizon=14, top_n=200):
    """
    Génère un fichier JSON avec les prévisions pour les top articles.
    Ce fichier est lu par le serveur Node pour alimenter le scoring V2.
    """
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Top articles par volume
    top_articles = c.execute("""
        SELECT code_article, SUM(quantite) as total
        FROM ventes
        WHERE code_article IS NOT NULL AND code_article != ''
        GROUP BY code_article
        HAVING total >= 3
        ORDER BY total DESC
        LIMIT ?
    """, (top_n,)).fetchall()
    conn.close()

    print(f"Calcul des prévisions pour {len(top_articles)} articles...")
    toutes_previsions = {}

    for i, (code, total) in enumerate(top_articles):
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{len(top_articles)}...")

        try:
            result = pipeline_prevision(db_path, code_article=code, horizon=horizon)
            for key, prev in result.items():
                toutes_previsions[key] = prev
        except Exception as e:
            print(f"  ERREUR {code}: {e}")

    # Agrégation par article (toutes boutiques)
    par_article = {}
    for key, prev in toutes_previsions.items():
        code = prev['code_article']
        if code not in par_article:
            par_article[code] = {
                'code_article': code,
                'saison': prev.get('saison', ''),
                'prix': prev.get('prix', 0),
                'prevision_totale_semaine': 0,
                'tendance_moyenne': [],
                'boutiques': {}
            }
        par_article[code]['prevision_totale_semaine'] += prev.get('prevision_par_semaine', 0)
        if prev.get('tendance', 0) > 0:
            par_article[code]['tendance_moyenne'].append(prev['tendance'])
        par_article[code]['boutiques'][prev['store_id']] = {
            'prevision_par_semaine': prev.get('prevision_par_semaine', 0),
            'tendance': prev.get('tendance', 1.0),
            'methode': prev.get('methode', 'moyenne_ponderee')
        }

    # Finaliser les tendances moyennes
    for code, data in par_article.items():
        tendances = data.pop('tendance_moyenne')
        data['tendance'] = round(np.mean(tendances), 3) if tendances else 1.0
        data['prevision_totale_semaine'] = round(data['prevision_totale_semaine'], 2)

    output = {
        'generated_at': datetime.now().isoformat(),
        'horizon_jours': horizon,
        'nb_articles': len(par_article),
        'methode': 'lgbm' if HAS_LGBM else 'moyenne_ponderee',
        'previsions': par_article
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nPrévisions exportées : {output_path}")
    print(f"  Articles : {len(par_article)}")
    print(f"  Méthode  : {output['methode']}")

    return output


# ── MAIN ─────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Prévision de la demande — Mabrouk Stock')
    parser.add_argument('--db', default='../data/mabrouk.db', help='Chemin vers la base SQLite')
    parser.add_argument('--output', default='../exports/previsions.json', help='Fichier de sortie JSON')
    parser.add_argument('--article', default=None, help='Code article spécifique')
    parser.add_argument('--horizon', type=int, default=14, help='Horizon de prévision en jours')
    parser.add_argument('--top', type=int, default=200, help='Nombre d\'articles à traiter')
    parser.add_argument('--methode', default='auto', choices=['auto', 'moyenne', 'lgbm'], help='Méthode')
    args = parser.parse_args()

    if args.article:
        result = pipeline_prevision(args.db, code_article=args.article, horizon=args.horizon, methode=args.methode)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        exporter_previsions(args.db, args.output, horizon=args.horizon, top_n=args.top)
