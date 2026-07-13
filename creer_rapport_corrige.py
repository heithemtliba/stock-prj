import json
import requests
import subprocess
import os
from datetime import datetime

# Récupérer les données fraîches de l'API
API_BASE = "http://localhost:3002"

def get_api_data():
    """Récupère toutes les données nécessaires pour le rapport"""
    try:
        # Récupérer les données de reassort global
        response = requests.get(f"{API_BASE}/reassort-global")
        if response.status_code == 200:
            reassort_data = response.json()
        else:
            print(f"Erreur API reassort: {response.status_code}")
            return None
            
        # Créer la structure du rapport
        rapport = {
            "periode": {"jours": 28, "label": "Soldes Hiver", "soldes": True},
            "dateGeneration": datetime.now().isoformat(),
            "resumeUrgences": {
                "nbCritique": len(reassort_data.get('critique', [])),
                "nbFaible": len(reassort_data.get('faible', [])),
                "nbOk": len(reassort_data.get('ok', [])),
                "totalTransferts": sum(len(a.get('suggestions', [])) for a in reassort_data.get('critique', []) + reassort_data.get('faible', []))
            },
            "articlesCritiques": reassort_data.get('critique', []),
            "articlesFaibles": reassort_data.get('faible', []),
            "ventesHebdo": {"cetteSemaine": 0, "semainePrec": 0, "evolution": 0, "parBoutique": []},
            "topArticles": [],
            "articlesInactifs": [],
            "scoresMagasins": [],
            "rupturesNouvelleCollection": []
        }
        
        return rapport
    except Exception as e:
        print(f"Erreur: {e}")
        return None

def main():
    print("Récupération des données fraîches...")
    data = get_api_data()
    
    if not data:
        print("Impossible de récupérer les données")
        return
    
    # Vérifier que les scores sont différenciés
    if data.get('articlesCritiques'):
        first = data['articlesCritiques'][0]
        suggestions = first.get('suggestions', [])
        if suggestions:
            s = suggestions[0]
            print(f"Vérification scores - Donneur: {s.get('scoreDonneur')}, Receveur: {s.get('scoreReceveur')}")
            print(f"Différents: {s.get('scoreDonneur') != s.get('scoreReceveur')}")
    
    # Sauvegarder les données
    output_json = "c:/Users/HeithemT/mabrouk-stock/exports/rapport_donnees_fraiches.json"
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Données sauvegardées dans: {output_json}")
    
    # Générer le fichier Excel
    output_excel = "c:/Users/HeithemT/mabrouk-stock/exports/rapport_scores_differenties.xlsx"
    script_path = "c:/Users/HeithemT/mabrouk-stock/scripts/exportRapportHebdo.py"
    
    try:
        result = subprocess.run([
            'python', script_path, output_excel, output_json
        ], capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode == 0:
            print(f"Rapport généré avec succès: {output_excel}")
            print("Ouvrir le fichier Excel pour vérifier les scores...")
            os.startfile(output_excel)
        else:
            print(f"Erreur lors de la génération: {result.stderr}")
    except Exception as e:
        print(f"Erreur: {e}")

if __name__ == "__main__":
    main()
