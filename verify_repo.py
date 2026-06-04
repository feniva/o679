#!/usr/bin/env python3
# verify_repo.py — Verifica che tutte le icone siano presenti e referenziate nel manifest.

import os, json, sys

REQUIRED_ICONS = [
    "titolare-trattamento", "finalita", "tempi-conservazione",
    "trasferimento-dati", "diritti", "dpo", "categoria-dati",
    "dati-personali", "destinatari", "revoca-consenso", "reclamo",
    "trattamento-in-corso", "fonte-del-dato", "bilanciamento-interessi",
    "obbligo-conferimento", "diritto-accesso",
]
STATES = ["normal", "sensitive", "profiling", "bn"]

errors = []
for state in STATES:
    for icon_id in REQUIRED_ICONS:
        path = f"icons/{state}/{icon_id}.png"
        if not os.path.exists(path):
            errors.append(f"MANCANTE: {path}")
        elif os.path.getsize(path) < 100:
            errors.append(f"FILE VUOTO: {path}")

with open("icons.json", encoding="utf-8") as f:
    manifest = json.load(f)
manifest_ids = {ic["id"] for ic in manifest["icons"]}
for icon_id in REQUIRED_ICONS:
    if icon_id not in manifest_ids:
        errors.append(f"NON IN MANIFEST: {icon_id}")

if errors:
    print("ERRORI TROVATI:")
    for e in errors:
        print(f"   {e}")
    sys.exit(1)
else:
    print(f"OK Repository integro: {len(REQUIRED_ICONS)} icone x {len(STATES)} stati = {len(REQUIRED_ICONS)*len(STATES)} file")
