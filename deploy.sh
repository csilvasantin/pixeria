#!/usr/bin/env bash
# Publica pixeria.com en CLOUDFLARE PAGES (proyecto 'pixeria').
# Unificación 2026-07-11: el ORIGEN de producción pasa a Cloudflare Pages.
# El DNS de pixeria.com sigue en GoDaddy (custom domain vía CNAME → pixeria.pages.dev).
# git push queda como backup de código. Uso: ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
: "${ADMIRA_RELEASE_AGENT:?Define ADMIRA_RELEASE_AGENT con el agente responsable (ej. OraculoMBAPlata)}"
: "${ADMIRA_RELEASE_MACHINE:?Define ADMIRA_RELEASE_MACHINE con el equipo físico (ej. MacBookAirPlata)}"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "✗ No se publica desde un árbol sucio: firma y commit dejarían de corresponder." >&2
  exit 1
fi
echo "→ GitHub (push de código, backup)…"
git push origin main 2>&1 | tail -1 || echo "  (nada que pushear)"
echo "→ Cloudflare Pages (ORIGEN de producción)…"
export CLOUDFLARE_API_TOKEN="$(bash ~/Claude/admira-vault/vault-get.sh CLOUDFLARE_API_TOKEN)"
TMP="$(mktemp -d)"; git archive main | tar -x -C "$TMP"
release="$(git show main:index.html | sed -n 's/.*admiranext-version.*content="[^"]*\(v\.[^"]*\)".*/\1/p' | head -1)"
[[ -n "$release" ]] || { echo "✗ No se encontró el sello canónico en index.html" >&2; exit 1; }
git_full="$(git rev-parse main)"
jq -n \
  --arg version "$release" \
  --arg deployedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg deployer "$ADMIRA_RELEASE_AGENT" \
  --arg machine "$ADMIRA_RELEASE_MACHINE" \
  --arg signature "$ADMIRA_RELEASE_AGENT · $ADMIRA_RELEASE_MACHINE" \
  --arg git "$git_full" \
  '{version:$version,deployedAt:$deployedAt,deployer:$deployer,machine:$machine,signature:$signature,git:$git,gitShort:($git[0:7]),gitFull:$git,dirty:false}' \
  > "$TMP/version.json"
npx --yes wrangler@latest pages deploy "$TMP" --project-name pixeria --branch main
rm -rf "$TMP"
echo "✓ https://www.pixeria.com (Cloudflare Pages) · mirror https://pixeria.pages.dev"
