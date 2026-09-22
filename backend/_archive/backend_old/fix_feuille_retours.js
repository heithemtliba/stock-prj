const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

let idxSave = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('wb.save(output_path)')) { idxSave = i; break; }
}
console.log('Sauvegarde ligne:', idxSave + 1);

const nouvelleFeuilleRetours = `
# --------------------------------------------------------------------------
# FEUILLE 9 — RETOURS & ANNULATIONS
# --------------------------------------------------------------------------
analyse_retours = data.get('analyseRetours', {})
retour_stats    = analyse_retours.get('parArticle', [])
retour_boutique = analyse_retours.get('parBoutique', [])
taux_retour     = analyse_retours.get('tauxRetour', [])
retour_total    = analyse_retours.get('total', {})

ws9 = wb.create_sheet("Retours & Annulations")
ws9.sheet_view.showGridLines = False
nb_cols9 = 8
titre_principal(ws9, f"RETOURS & ANNULATIONS   |   {today}", nb_cols9)
total_retours = retour_total.get('total', 0) if retour_total else 0
sous_titre(ws9, f"{total_retours} unites retournees sur la periode — Analyse impact et articles a risque", nb_cols9)

row = 3

# === SECTION 1 : TOP ARTICLES RETOURNES ===
ws9.merge_cells(f'A{row}:H{row}')
c = ws9.cell(row=row, column=1, value="TOP ARTICLES RETOURNES — TAUX DE RETOUR PAR ARTICLE")
c.font = Font(bold=True, color=RED_FG, size=11, name='Arial')
c.fill = PatternFill('solid', start_color=RED_BG)
c.alignment = Alignment(horizontal='center', vertical='center')
ws9.row_dimensions[row].height = 28
row += 1

hdrs_r1 = ['Code Article','Nom Article','Famille','Prix TTC','Ventes 28j','Retours','Taux retour (%)','Alerte']
for col, h in enumerate(hdrs_r1, 1):
    hdr(ws9.cell(row=row, column=col, value=h), bg=RED_FG, fg="FFFFFF")
ws9.row_dimensions[row].height = 22
row += 1

for i, w in enumerate([14,28,16,10,12,10,14,20], 1):
    ws9.column_dimensions[get_column_letter(i)].width = w

for art in taux_retour:
    code    = str(art.get('code_article',''))
    nom     = art.get('libelle','') or noms_art.get(code,'')
    famille = art.get('famille','')
    prix    = art.get('prix_detail', 0) or prix_articles.get(code, 0)
    ventes  = art.get('ventes', 0)
    retours = art.get('retours', 0)
    taux    = art.get('taux_pct', 0)
    
    if taux >= 20:
        alerte = "!! PROBLEME QUALITE/TAILLE"
        bg_row = RED_BG; fg_row = RED_FG
    elif taux >= 10:
        alerte = ">> A SURVEILLER"
        bg_row = ORANGE_BG; fg_row = ORANGE_FG
    else:
        alerte = "OK"
        bg_row = "F1F8E9"; fg_row = GREEN_FG

    vals = [code, nom, famille, prix, ventes, retours, taux, alerte]
    for col, val in enumerate(vals, 1):
        c = ws9.cell(row=row, column=col, value=val)
        if col == 7:
            taux_bg = RED_BG if taux >= 20 else (ORANGE_BG if taux >= 10 else "F1F8E9")
            taux_fg = RED_FG if taux >= 20 else (ORANGE_FG if taux >= 10 else GREEN_FG)
            sty(c, bg=taux_bg, fg=taux_fg, bold=True, center=True)
        elif col == 8:
            sty(c, bg=bg_row, fg=fg_row, bold=(taux>=10))
        else:
            sty(c, bg=bg_row, fg=fg_row, center=(col in [4,5,6]))
    ws9.row_dimensions[row].height = 22
    row += 1

row += 1

# === SECTION 2 : RETOURS PAR BOUTIQUE ===
ws9.merge_cells(f'A{row}:H{row}')
c2 = ws9.cell(row=row, column=1, value="RETOURS PAR BOUTIQUE")
c2.font = Font(bold=True, color=ORANGE_FG, size=11, name='Arial')
c2.fill = PatternFill('solid', start_color=ORANGE_BG)
c2.alignment = Alignment(horizontal='center', vertical='center')
ws9.row_dimensions[row].height = 28
row += 1

STORE_NAMES = {
    '002':'MENZAH','005':'JAMEL ABDENNACEUR','009':'SFAX A','011':'NABEUL',
    '014':'CARREFOUR','015':'ZEPHYR','016':'LAFAYETTE','019':'E-Boutique',
    '021':'TUNISIA MALL','024':'GEANT 3','029':'SOUSSE SLIM CENTER',
    '030':'AZUR CITY','031':'SOUKRA','032':'MALL OF SFAX','033':'LAC Premium'
}

hdrs_r2 = ['Store ID','Boutique','Unites retournees','Articles concernes','','','','']
for col, h in enumerate(hdrs_r2[:4], 1):
    hdr(ws9.cell(row=row, column=col, value=h), bg=ORANGE_FG, fg="FFFFFF")
ws9.row_dimensions[row].height = 22
row += 1

max_retours = max((b.get('total',0) for b in retour_boutique), default=1)
for b in retour_boutique:
    store_id = str(b.get('store_id',''))
    nom_store = STORE_NAMES.get(store_id, store_id)
    total_b   = b.get('total', 0)
    nb_art    = b.get('nb_articles', b.get('nb', 0))
    pct       = round(total_b * 100 / max_retours) if max_retours > 0 else 0
    bg_b = RED_BG if pct >= 80 else (ORANGE_BG if pct >= 50 else "FFF9C4")
    fg_b = RED_FG if pct >= 80 else (ORANGE_FG if pct >= 50 else "7B6000")
    sty(ws9.cell(row=row, column=1, value=store_id), bg=bg_b, fg=fg_b, center=True)
    sty(ws9.cell(row=row, column=2, value=nom_store), bg=bg_b, fg=fg_b, bold=True)
    sty(ws9.cell(row=row, column=3, value=total_b), bg=bg_b, fg=fg_b, bold=True, center=True)
    sty(ws9.cell(row=row, column=4, value=nb_art), bg=bg_b, fg=fg_b, center=True)
    ws9.row_dimensions[row].height = 22
    row += 1

ws9.freeze_panes = 'A4'

`;

lines.splice(idxSave, 0, ...nouvelleFeuilleRetours.split('\n'));
fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
