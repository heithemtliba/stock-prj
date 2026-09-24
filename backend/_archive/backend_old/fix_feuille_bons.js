const fs = require('fs');
let lines = fs.readFileSync('../scripts/exportRapportHebdo.py', 'utf8').split('\n');

// Trouver la ligne de sauvegarde
let idxSave = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('wb.save(output_path)')) { idxSave = i; break; }
}
console.log('Sauvegarde ligne:', idxSave + 1);

const nouvelleFeuille = `
# --------------------------------------------------------------------------
# FEUILLE 8 — BONS DE TRANSFERT (detail par variante taille/couleur)
# --------------------------------------------------------------------------
bons = data.get('bonsTransfert', [])
ws8 = wb.create_sheet("Bons de transfert")
ws8.sheet_view.showGridLines = False
nb_cols8 = 10
titre_principal(ws8, f"BONS DE TRANSFERT — DETAIL PAR VARIANTE   |   {today}", nb_cols8)
sous_titre(ws8, f"{len(bons)} transfert(s) a effectuer — Detail taille et couleur par article", nb_cols8)

hdrs8 = ['N° Bon','Code Article','Nom Article','Saison','EAN','Taille','Couleur','Stock Donneur','Stock Receveur','Qte a transferer']
for col, h in enumerate(hdrs8, 1):
    hdr(ws8.cell(row=3, column=col, value=h), bg=HEADER_BG, fg=HEADER_FG)
ws8.row_dimensions[3].height = 28
for i, w in enumerate([8,14,28,10,18,10,10,14,14,16], 1):
    ws8.column_dimensions[get_column_letter(i)].width = w

row = 4
bon_num = 1
for bon in bons:
    code     = str(bon.get('codeArticle',''))
    nom      = bon.get('nomArticle','')
    saison   = bon.get('saison','')
    donneur  = bon.get('donneur','')
    receveur = bon.get('receveur','')
    lignes   = bon.get('lignes', [])
    total    = bon.get('totalUnites', 0)

    # Entete du bon
    ws8.merge_cells(f'A{row}:J{row}')
    c_bon = ws8.cell(row=row, column=1,
        value=f"BON #{bon_num:03d}  |  DE : {donneur}  ?  VERS : {receveur}  |  {code} {nom}  |  TOTAL : {total} unites")
    c_bon.font = Font(bold=True, color=HEADER_FG, size=11, name='Arial')
    c_bon.fill = PatternFill('solid', start_color=HEADER_BG)
    c_bon.alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws8.row_dimensions[row].height = 28
    row += 1

    # Lignes variantes
    for j, ligne in enumerate(lignes):
        bg = "EBF5FB" if j % 2 == 0 else "FFFFFF"
        qte = ligne.get('quantite', 0)
        stk_d = ligne.get('stockDonneur', 0)
        stk_r = ligne.get('stockReceveur', 0)
        vals = [
            f"#{bon_num:03d}", code, nom, saison,
            ligne.get('ean',''), ligne.get('taille',''), ligne.get('couleur',''),
            stk_d, stk_r, qte
        ]
        for col, val in enumerate(vals, 1):
            c = ws8.cell(row=row, column=col, value=val)
            if col == 10:
                sty(c, bg=GREEN_BG, fg=GREEN_FG, bold=True, center=True)
            elif col in [8, 9]:
                stk_bg = RED_BG if (col==9 and stk_r==0) else bg
                stk_fg = RED_FG if (col==9 and stk_r==0) else "1E293B"
                sty(c, bg=stk_bg, fg=stk_fg, bold=(col==9 and stk_r==0), center=True)
            elif col in [5, 6, 7]:
                sty(c, bg=bg, fg="1E293B", center=True)
            else:
                sty(c, bg=bg, fg="1E293B")
        ws8.row_dimensions[row].height = 22
        row += 1

    # Ligne total par bon
    ws8.merge_cells(f'A{row}:I{row}')
    ct = ws8.cell(row=row, column=1, value=f"TOTAL BON #{bon_num:03d} — {donneur} ? {receveur}")
    ct.font = Font(bold=True, color=HEADER_FG, size=10, name='Arial')
    ct.fill = PatternFill('solid', start_color=HEADER_BG)
    ct.alignment = Alignment(horizontal='right', vertical='center')
    ws8.row_dimensions[row].height = 22
    hdr(ws8.cell(row=row, column=10, value=total))
    row += 2
    bon_num += 1

if not bons:
    ws8.merge_cells('A4:J4')
    c_ok = ws8.cell(row=4, column=1, value="Aucun transfert detaille disponible")
    c_ok.font = Font(color=GREEN_FG, size=10, name='Arial', italic=True)
    c_ok.fill = PatternFill('solid', start_color=GREEN_BG)
    c_ok.alignment = Alignment(horizontal='center', vertical='center')
    ws8.row_dimensions[4].height = 30
ws8.freeze_panes = 'A4'

`;

lines.splice(idxSave, 0, ...nouvelleFeuille.split('\n'));
fs.writeFileSync('../scripts/exportRapportHebdo.py', lines.join('\n'), 'utf8');
console.log('OK lignes:', lines.length);
