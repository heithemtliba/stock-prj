const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

// Trouver debut et fin de la feuille 5
let debut = -1, fin = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("ws5 = wb.create_sheet(\"Articles inactifs\")")) debut = i;
  if (debut > -1 && lines[i].includes("ws6 = wb.create_sheet(")) { fin = i; break; }
}
console.log('Feuille 5:', debut+1, '->', fin+1);

const newF5 = `ws5 = wb.create_sheet("Articles inactifs")
ws5.sheet_view.showGridLines = False
nb_cols5 = 9
titre_principal(ws5, f"ARTICLES SANS MOUVEMENT CETTE SEMAINE   |   {today}", nb_cols5)
sous_titre(ws5, f"{len(inactifs)} article(s) actifs sur la periode mais sans vente cette semaine", nb_cols5)
hdrs5 = ['Code Article','Nom Article','Saison','Prix TTC','Ventes/sem moy.','Jours sans vente','Stock total','Urgence','Recommandation']
for col, h in enumerate(hdrs5, 1):
    hdr(ws5.cell(row=3, column=col, value=h), bg=PURPLE_FG, fg="FFFFFF")
ws5.row_dimensions[3].height = 28
for i, w in enumerate([14,28,10,10,14,16,12,12,42], 1):
    ws5.column_dimensions[get_column_letter(i)].width = w

def recommandation_inactif(saison, stock, jours_sans_vente, ventes_sem, prix):
    actuel = saison.strip().upper() in SAISONS_ACT
    # 26E = nouvelle collection
    if '26' in saison.upper():
        return ('?? NOUVEAU', "Exposition insuffisante — laisser en rayon", "4472C4", "D6E4F7")
    if actuel:  # 25H
        if stock > 30 and jours_sans_vente > 7:
            return ('?? URGENT', "Regrouper dans boutiques fortes — verifier visibilite", RED_FG, RED_BG)
        if stock > 10:
            return ('?? SURVEILLER', "Verifier visibilite / repositionner en boutique", ORANGE_FG, ORANGE_BG)
        return ('?? OK', "Stock faible — ecoulement naturel proche", GREEN_FG, GREEN_BG)
    else:  # 24H et plus ancien
        if stock > 50:
            return ('?? DEMARQUE URGENTE', "Stock eleve ancienne saison — demarque immediate", RED_FG, RED_BG)
        if stock > 20 and jours_sans_vente > 14:
            return ('?? DEMARQUE', "Envisager demarque — article en fin de cycle", ORANGE_FG, ORANGE_BG)
        if stock > 0:
            return ('?? LIQUIDATION', "Laisser ecouler — ne pas reapprovisionner", "7B6000", "FFF9C4")
        return ('? EPUISE', "Stock nul — aucune action requise", "424242", "F5F5F5")

for i, art in enumerate(inactifs):
    row = 4 + i
    ws5.row_dimensions[row].height = 24
    code          = str(art.get('code_article',''))
    nom           = noms_art.get(code,'')
    saison        = art.get('saison','')
    ventes_sem    = art.get('ventes_semaine', 0) or 0
    jours_sv      = art.get('jours_sans_vente', 0) or 0
    stock_reel    = stock_par_article.get(str(code), {})
    stock_total   = sum(v for v in stock_reel.values() if isinstance(v,(int,float)))
    art_db        = next((a for a in data.get('nomsArticles', {}).items() if a[0] == code), None)
    prix          = 0
    try:
        import sqlite3
        pass
    except: pass
    bg = PURPLE_BG if i % 2 == 0 else "EDE7F6"
    urgence_label, reco_text, reco_fg, reco_bg = recommandation_inactif(saison, stock_total, jours_sv, ventes_sem, prix)
    sty(ws5.cell(row=row, column=1, value=code), bg=bg, fg=PURPLE_FG, bold=True)
    sty(ws5.cell(row=row, column=2, value=nom), bg=bg, fg="1E293B")
    sty(ws5.cell(row=row, column=3, value=saison), bg=bg, fg=PURPLE_FG, center=True)
    sty(ws5.cell(row=row, column=4, value=prix if prix else '—'), bg=bg, center=True)
    sty(ws5.cell(row=row, column=5, value=round(ventes_sem,2) if ventes_sem else '—'), bg=bg, fg=PURPLE_FG, center=True)
    # Jours sans vente avec couleur selon urgence
    c_jours = ws5.cell(row=row, column=6, value=jours_sv if jours_sv else '—')
    jours_bg = RED_BG if jours_sv > 14 else (ORANGE_BG if jours_sv > 7 else GREEN_BG)
    jours_fg = RED_FG if jours_sv > 14 else (ORANGE_FG if jours_sv > 7 else GREEN_FG)
    sty(c_jours, bg=jours_bg, fg=jours_fg, bold=True, center=True)
    # Stock avec couleur
    c_stock = ws5.cell(row=row, column=7, value=stock_total if stock_total > 0 else '—')
    stock_bg = RED_BG if stock_total > 50 else (ORANGE_BG if stock_total > 20 else GREEN_BG)
    stock_fg = RED_FG if stock_total > 50 else (ORANGE_FG if stock_total > 20 else GREEN_FG)
    sty(c_stock, bg=stock_bg, fg=stock_fg, bold=True, center=True)
    sty(ws5.cell(row=row, column=8, value=urgence_label), bg=reco_bg, fg=reco_fg, bold=True, center=True)
    sty(ws5.cell(row=row, column=9, value=reco_text), bg=reco_bg, fg=reco_fg)
ws5.freeze_panes = 'A4'
`;

lines.splice(debut, fin - debut, ...newF5.split('\n'));
fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
