#!/usr/bin/env python3
# rename_icons.py — Rinomina file Osservatorio679 in slug canonici
# Adattato per repo feniva/o679: sorgenti esterne (CONTEST) → icons/normal/ + icons/bn/

import os, shutil, sys

SLUG_MAP = {
    "Titolare del trattamento Osservatorio679 Lic CC BY.png":          "titolare-trattamento.png",
    "Finalita Autore Osservatorio679 Lic CC BY.png":                   "finalita.png",
    "Tempi di conservazione Osservatorio679 Lic CC BY.png":            "tempi-conservazione.png",
    "Trasferimento dati Osservatorio679 Lic CC BY.png":                "trasferimento-dati.png",
    "Diritti Autore Osservatorio679 Lic CC BY.png":                    "diritti.png",
    "DPO Autore Osservatorio679 Lic CC BY.png":                        "dpo.png",
    "Categoria dati  Autore Osservatorio679 Lic CC BY.png":            "categoria-dati.png",
    "Dati personali  Autore Osservatorio679 Lic CC BY.png":            "dati-personali.png",
    "Destinatari Autore Osservatorio679 Lic CC BY.png":                "destinatari.png",
    "Revoca consenso Osservatorio679 Lic CC BY.png":                   "revoca-consenso.png",
    "Reclamo Autore Osservatorio679 Lic CC BY.png":                    "reclamo.png",
    "Trattamento dati generico in corso Osservatorio679 Lic CC BY.png":"trattamento-in-corso.png",
    "Fonte del dato Autore Osservatorio679 Lic CC BY.png":             "fonte-del-dato.png",
    "Bilanciamento interessi  Autore Osservatorio679 Lic CC BY.png":   "bilanciamento-interessi.png",
    "Obbligo conferimento Autore Osservatorio679 Lic CC BY.png":       "obbligo-conferimento.png",
    "Diritto accesso ai dati Autore Osservatorio679 Lic CC BY.png":    "diritto-accesso.png",
}

if len(sys.argv) < 2:
    print("Uso: python rename_icons.py <PATH_SORGENTE_CONTEST>")
    sys.exit(1)
SRC_BASE = sys.argv[1]

JOBS = [
    (os.path.join(SRC_BASE, "icone-standard", "png"), "icons/normal"),
    (os.path.join(SRC_BASE, "icone-bn",       "png"), "icons/bn"),
]

for src_dir, dst_dir in JOBS:
    os.makedirs(dst_dir, exist_ok=True)
    for orig_name, slug_name in SLUG_MAP.items():
        src = os.path.join(src_dir, orig_name)
        dst = os.path.join(dst_dir, slug_name)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            print(f"OK  {dst_dir}/{slug_name}")
        else:
            print(f"NO  NON TROVATO: {src}")

print("\nRinomina completata.")
