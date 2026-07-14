#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

missing=0
while IFS= read -r file; do
  if ! grep -q '/assets/analytics.js' "$file"; then
    printf 'Falta Analytics: %s\n' "$file" >&2
    missing=1
  fi
done < <(find . -type f -name '*.html' -not -path './.git/*' | sort)

if (( missing )); then
  exit 1
fi

printf 'OK: Analytics presente en todos los HTML.\n'
