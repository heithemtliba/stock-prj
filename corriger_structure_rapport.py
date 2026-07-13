import json
import requests
import subprocess
import os
from datetime import datetime

def corriger_structure():
    """Corriger la structure des données pour le rapport"""
    
    # Récupérer les données de l'API
    try:
        response = requests.get("http://localhost:3002/reassort-global", timeout=30)
        if response.status_code == 200:
            data = response.json()
        else:
            print(f"Erreur API: {response.status_code}")
            return None
    except Exception as e:
        print(f"Erreur: {e}")
        return None
    
    # Convertir à la structure attendue
    rapport_corrige = {
        "periode": {"jours": 28, "label": "Soldes Hiver", "soldes": True},
        "dateGeneration": datetime.now().isoformat(),
        "resumeUrgences": {
            "nbCritique": len(data.get('critique', [])),
            "nbFaible": len(data.get('faible', [])),
            "nbOk": len(data.get('ok', [])),
            "totalTransferts": 0  # Pas de suggestions actuellement
        },
        "articlesCritiques": data.get('critique', []),
        "articlesFaibles": data.get('faible', []),
        "ventesHebdo": {"cetteSemaine": 0, "semainePrec": 0, "evolution": 0, "parBoutique": []},
        "topArticles": [],
        "articlesInactifs": [],
        "scoresMagasins": [],
        "rupturesNouvelleCollection": []
    }
    
    return rapport_corrige

def main():
    print("Correction de la structure du rapport...")
    
    # Corriger la structure
    data = corriger_structure()
    
    if not data:
        print("Impossible de corriger les données")
        return
    
    # Statistiques
    print(f"Articles critiques: {len(data.get('articlesCritiques', []))}")
    print(f"Articles faibles: {len(data.get('articlesFaibles', []))}")
    
    # Vérifier si les articles critiques ont des données
    if data.get('articlesCritiques'):
        first = data['articlesCritiques'][0]
        print(f"Premier article critique: {first.get('reference', 'N/A')}")
        print(f"Stock total: {first.get('stockTotal', 0)}")
        print(f"Score: {first.get('score', 0)}")
    
    # Sauvegarder les données corrigées
    output_json = "c:/Users/HeithemT/mabrouk-stock/exports/rapport_structure_corrige.json"
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Données corrigées: {output_json}")
    
    # Générer le rapport
    output_excel = "c:/Users/HeithemT/mabrouk-stock/exports/rapport_articles_critiques.xlsx"
    script_path = "c:/Users/HeithemT/mabrouk-stock/scripts/exportRapportHebdo.py"
    
    try:
        result = subprocess.run([
            'python', script_path, output_excel, output_json
        ], capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode == 0:
            print(f"✅ Rapport généré: {output_excel}")
            print(f"📊 Taille: {os.path.getsize(output_excel)} octets")
            print("📂 Ouverture du fichier...")
            os.startfile(output_excel)
        else:
            print(f"❌ Erreur: {result.stderr}")
    except Exception as e:
        print(f"❌ Erreur: {e}")

if __name__ == "__main__":
    main()
