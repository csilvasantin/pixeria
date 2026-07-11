#!/usr/bin/env bash
# Reabre el escape ?gate=off (revierte el endurecimiento de la verja) y redespliega.
set -euo pipefail; cd "$(dirname "$0")"
while IFS= read -r f; do perl -pi -e "s/\Qif(q==='on') on = q;\E/if(q==='on'||q==='off') on = q;/g" "$f"; done < <(grep -rlF "if(q==='on') on = q;" . --include="*.html")
git add -A && git commit -m "rollback(gate): reabrir escape ?gate=off" || true
bash deploy.sh
echo "✓ escape ?gate=off reactivado y desplegado"
