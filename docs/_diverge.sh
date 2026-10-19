#!/usr/bin/env bash
# Scratch: per-page citation divergence en vs canonical. Delete after use.
cd J:/antdv/frontend/docs
for rel in $(cd guide components 2>/dev/null; true); do :; done
pages=$(cd . && find guide components -name '*.md' | sort)
extract() { grep -oE '`[A-Za-z0-9_@./:,-]+\.(ts|vue|css|json|mts|js|mjs|cjs)(:[0-9][0-9,-]*)?`' "$1" 2>/dev/null | sed 's/`//g' | sort -u; }
for p in $pages; do
  c="$p"; e="en/$p"
  [ -f "$e" ] || { echo "NO_EN  $p"; continue; }
  cs=$(extract "$c"); es=$(extract "$e")
  # canonical citations missing from en
  miss=$(comm -23 <(echo "$cs") <(echo "$es"))
  nm=$(echo "$miss" | grep -c . )
  tot=$(echo "$cs" | grep -c .)
  if [ "$nm" -gt 0 ]; then printf "%-42s canonical=%-3s missing-in-en=%s\n" "$p" "$tot" "$nm"; fi
done
