#!/usr/bin/env bash
# Publica pixeria.com en CLOUDFLARE PAGES (proyecto 'pixeria').
# Unificación 2026-07-11: el ORIGEN de producción pasa a Cloudflare Pages.
# El DNS de pixeria.com sigue en GoDaddy (custom domain vía CNAME → pixeria.pages.dev).
# git push queda como backup de código. Uso: ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
echo "→ GitHub (push de código, backup)…"
git push origin main 2>&1 | tail -1 || echo "  (nada que pushear)"
echo "→ Cloudflare Pages (ORIGEN de producción)…"
export CLOUDFLARE_API_TOKEN="$(bash ~/Claude/admira-vault/vault-get.sh CLOUDFLARE_API_TOKEN)"
TMP="$(mktemp -d)"; git archive main | tar -x -C "$TMP"
npx --yes wrangler@latest pages deploy "$TMP" --project-name pixeria --branch main
rm -rf "$TMP"
echo "✓ https://www.pixeria.com (Cloudflare Pages) · mirror https://pixeria.pages.dev"
