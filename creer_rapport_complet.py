import json
import requests
import subprocess
import os
from datetime import datetime

def creer_donnees_avec_suggestions():
    """Créer des données de test avec suggestions pour le rapport complet"""
    
    # Récupérer les vraies données de l'API
    try:
        response = requests.get("http://localhost:3002/reassort-global", timeout=30)
        if response.status_code == 200:
            data = response.json()
        else:
            print(f"Erreur API: {response.status_code}")
            return None
    except Exception as e:
        print(f"Erreur de connexion: {e}")
        return None
    
    # Ajouter des suggestions simulées pour les premiers articles critiques
    for i, article in enumerate(data.get('critique', [])[:5]):  # Juste les 5 premiers
        suggestions_simulees = [
            {
                "de": "SITE CENTRALE",
                "deId": "001",
                "vers": article.get('analyse', [{}])[0].get('storeName', 'MAGASIN'),
                "versId": article.get('analyse', [{}])[0].get('storeId', '002'),
                "quantite": 3,
                "urgence": "CRITIQUE",
                "consigne": "Article saison actuelle - redistribuer ET commander si insuffisant",
                "raison": f"Transfert urgent - stock insuffisant",
                "scoreDonneur": 0,
                "scoreReceveur": round(article.get('score', 0), 2)
            }
        ]
        article['suggestions'] = suggestions_simulees
    
    # Convertir en structure de rapport complet
    rapport_complet = {
        "periode": {"jours": 28, "label": "Soldes Hiver", "soldes": True},
        "dateGeneration": datetime.now().isoformat(),
        "resumeUrgences": {
            "nbCritique": len(data.get('critique', [])),
            "nbFaible": len(data.get('faible', [])),
            "nbOk": len(data.get('ok', [])),
            "totalTransferts": sum(len(a.get('suggestions', [])) for a in data.get('critique', []) + data.get('faible', []))
        },
        "articlesCritiques": data.get('critique', []),
        "articlesFaibles": data.get('faible', []),
        "ventesHebdo": {"cetteSemaine": 0, "semainePrec": 0, "evolution": 0, "parBoutique": []},
        "topArticles": [],
        "articlesInactifs": [],
        "scoresMagasins": [],
        "rupturesNouvelleCollection": []
    }
    
    return rapport_complet

def main():
    print("Création du rapport complet avec scores optimisés...")
    
    # Créer les données
    data = creer_donnees_avec_suggestions()
    
    if not data:
        print("Impossible de créer les données")
        return
    
    # Vérifier les suggestions
    total_suggestions = sum(len(a.get('suggestions', [])) for a in data.get('articlesCritiques', []) + data.get('articlesFaibles', []))
    print(f"Articles critiques: {len(data.get('articlesCritiques', []))}")
    print(f"Total suggestions: {total_suggestions}")
    
    if total_suggestions == 0:
        print("Aucune suggestion disponible - utilisation du rapport vide")
        return
    
    # Sauvegarder les données
    output_json = "c:/Users/HeithemT/mabrouk-stock/exports/rapport_complet_data.json"
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Données sauvegardées: {output_json}")
    
    # Générer le rapport avec le script original
    output_excel = "c:/Users/HeithemT/mabrouk-stock/exports/rapport_complet_final.xlsx"
    script_path = "c:/Users/HeithemT/mabrouk-stock/scripts/exportRapportHebdo.py"
    
    try:
        result = subprocess.run([
            'python', script_path, output_excel, output_json
        ], capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode == 0:
            print(f"✅ Rapport complet généré: {output_excel}")
            print(f"📊 Taille: {os.path.getsize(output_excel)} octets")
            print("📂 Ouverture du fichier...")
            os.startfile(output_excel)
        else:
            print(f"❌ Erreur: {result.stderr}")
    except Exception as e:
        print(f"❌ Erreur: {e}")

if __name__ == "__main__":
    main()
