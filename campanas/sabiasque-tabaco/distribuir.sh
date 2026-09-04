#!/usr/bin/env bash
# Distribuye la serie "¿Sabías que?" del tabaco a la pantalla del Xtanco vía el
# Worker pixer-eleven. Empuja el BUCLE (loop de los 5 contenidos) como item web.
#
# Uso:  ./distribuir.sh [canal] [loc]
#   canal : canal de pantalla (por defecto: escaparate)
#   loc   : ciudad para personalizar ("TU XTANCO · <LOC>"), por defecto Barcelona
#
# Reversible: para quitarlo, empuja __idle__ al mismo canal (ver final del script).
set -euo pipefail

# dominio propio: LaLiga bloquea workers.dev en horas de fútbol, FLT-1633
WORKER="https://api.admira.store"
CANAL="${1:-escaparate}"
LOC="${2:-Barcelona}"
BUCLE="https://www.pixeria.com/campanas/sabiasque-tabaco/bucle?loc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$LOC")"
TS="$(date +%s)000"
TITLE="[scr:${CANAL}] ¿Sabías que? · tabaco · #sabiasqueXtanco"

echo "→ Canal:  $CANAL"
echo "→ Bucle:  $BUCLE"

echo "→ /signage/now (puntero limpio por pantalla)…"
curl -s -m 15 -X POST "$WORKER/signage/now?screen=$CANAL" \
  -H "Content-Type: application/json" \
  -d "{\"screen\":\"$CANAL\",\"item\":{\"kind\":\"web\",\"src\":\"$BUCLE\",\"name\":\"¿Sabías que? · tabaco\",\"ts\":$TS}}" ; echo

echo "→ /signage/push (feed compartido, fallback)…"
curl -s -m 15 -X POST "$WORKER/signage/push" \
  -H "Content-Type: application/json" \
  -d "{\"kind\":\"web\",\"src\":\"$BUCLE\",\"title\":\"$TITLE\",\"meta\":{\"campaign\":\"sabiasque-tabaco\",\"tags\":[\"sabiasqueXtanco\"],\"target\":\"xtanco\"}}" ; echo

echo "✓ Distribuido a '$CANAL'. Para retirar:"
echo "  curl -s -X POST '$WORKER/signage/push' -H 'Content-Type: application/json' -d '{\"kind\":\"text\",\"src\":\"about:blank\",\"title\":\"[scr:${CANAL}] __idle__\"}'"
