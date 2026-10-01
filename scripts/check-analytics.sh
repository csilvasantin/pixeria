#!/usr/bin/env bash
# Comprueba que ningún HTML vuelve a cargar Google Analytics / Tag Manager ni el
# banner de cookies. Desde el 1-oct-2026 la analítica es Cloudflare Web Analytics
# (sin cookies), inyectada automáticamente por Cloudflare en el borde: no hay
# snippet en el código ni hace falta consentimiento.
set -euo pipefail

cd "$(dirname "$0")/.."

if grep -rIlE 'googletagmanager|gtag\(|/assets/analytics\.js|/assets/consent\.js|cookie-consent' \
     --include='*.html' --include='*.js' --include='*.css' --exclude-dir=.git --exclude-dir=node_modules . ; then
  printf 'Hay restos de Google Analytics o del banner de cookies en los ficheros de arriba.\n' >&2
  exit 1
fi

printf 'OK: sin Google Analytics ni banner de cookies (analítica: Cloudflare Web Analytics, sin cookies).\n'
