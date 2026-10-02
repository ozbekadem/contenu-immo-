#!/usr/bin/env python3
"""
Conversion des fichiers Statbel en données compactes pour l'écran « Marché local ».

Usage (une fois par trimestre / par an, quand Statbel publie de nouvelles données) :
    pip install openpyxl
    python3 scripts/statbel.py <vastgoed_2010_9999.xlsx> <CPI_All_base_years.xlsx>

- vastgoed_2010_9999.xlsx : prix de l'immobilier par commune (Statbel, open data)
- CPI_All_base_years.xlsx : indice des prix à la consommation (Statbel, open data)
Écrit src/data/marche/statbel.json (zone de Charleroi et alentours + références).
"""
import json
import sys
from collections import defaultdict

import openpyxl

# Arrondissements gardés : Charleroi, Thuin, La Louvière, Mons, Soignies, Namur, Philippeville
ARRONDISSEMENTS = ('52', '56', '58', '53', '55', '92', '93')
# Références : Belgique, Région wallonne, provinces de Hainaut et de Namur
REFERENCES = ('01000', '03000', '50000', '90000')
TYPES = {
    'Maisons avec 2 ou 3 façades (type fermé + type demi-fermé)': 'm23',
    'Maisons avec 4 ou plus de façades (type ouvert)': 'm4',
    'Toutes les maisons avec 2, 3, 4 ou plus de façades (excl. appartements)': 'maisons',
    'Appartements': 'apparts',
}
PERIODES_DETAIL = {'Q1', 'Q2', 'Q3', 'Q4', 'S1', 'S2'}


def lignes(chemin):
    wb = openpyxl.load_workbook(chemin, read_only=True)
    for ws in wb.worksheets:
        it = ws.iter_rows(values_only=True)
        entete = next(it)
        for r in it:
            if r[0] is None:
                break
            yield dict(zip(entete, r))


def main(vastgoed, cpi):
    zones, brut = {}, []
    for r in lignes(vastgoed):
        code, niveau = r['CD_REFNIS'], r['CD_niveau_refnis']
        garde = code in REFERENCES or (niveau in (4, 5) and code[:2] in ARRONDISSEMENTS)
        if not garde or r['CD_CLASS_SURFACE'] != 'totaal / total':
            continue
        zones[code] = {'nom': r['CD_REFNIS_FR'], 'niveau': niveau}
        brut.append(r)
    derniere = max(int(r['CD_YEAR']) for r in brut)
    series = defaultdict(lambda: defaultdict(list))
    for r in brut:
        annee, per = int(r['CD_YEAR']), r['CD_PERIOD']
        # Toutes les années (chiffre annuel) ; le détail trimestriel pour les 3 dernières années
        if per == 'Y' or (per in PERIODES_DETAIL and annee >= derniere - 2):
            series[r['CD_REFNIS']][TYPES[r['CD_TYPE_FR']]].append(
                [annee, per, r['MS_TOTAL_TRANSACTIONS'], r['MS_P_25'], r['MS_P_50_median'], r['MS_P_75']]
            )
    for s in series.values():
        for liste in s.values():
            liste.sort(key=lambda x: (x[0], x[1]))
    # Période la plus récente publiée
    recentes = sorted({(r['CD_YEAR'], r['CD_PERIOD']) for r in brut if r['CD_PERIOD'] in ('Q1', 'Q2', 'Q3', 'Q4')})
    an, trim = recentes[-1]

    # Indice des prix : moyenne annuelle, base la plus récente disponible
    par_base = defaultdict(lambda: defaultdict(list))
    for r in lignes(cpi):
        if r['MS_CPI_IDX'] is not None and r['NM_MTH'] is not None:
            par_base[r['NM_BASE_YR']][int(r['NM_YR'])].append(float(r['MS_CPI_IDX']))
    base = max(par_base)
    indice = {a: round(sum(v) / len(v), 3) for a, v in par_base[base].items() if a >= 2010}

    sortie = {
        'source': 'Statbel – prix de l’immobilier par commune (actes de vente) ; indice des prix à la consommation',
        'derniere': f'{an} T{trim[1]}',
        'baseIndice': base,
        'indice': indice,
        'zones': zones,
        'series': series,
    }
    with open('src/data/marche/statbel.json', 'w', encoding='utf-8') as f:
        json.dump(sortie, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(zones)} zones, données jusqu’à {an} T{trim[1]}, indice base {base} ({min(indice)}–{max(indice)})')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
