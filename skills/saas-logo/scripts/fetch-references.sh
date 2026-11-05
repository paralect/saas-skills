#!/usr/bin/env bash
# Pull the reference marks through Brandfetch's Logo API into a folder, then
# row them up on one sheet to look at.
#   fetch-references.sh out/references          # the 11 marks the style comes from
#   fetch-references.sh out/references figma.com stripe.com   # any brands instead
#
# Needs a Brandfetch client ID: BRANDFETCH_CLIENT_ID. Register for one free at https://developers.brandfetch.com.
# Without an ID each brand's own site icon is fetched instead, smaller and less
# tidy, so the study can still happen.
set -euo pipefail
out="${1:?usage: fetch-references.sh <out-dir> [domain…]}"; shift || true
domains=("$@")
if [ ${#domains[@]} -eq 0 ]; then
  domains=(notion.so linear.app mintlify.com vercel.com miro.com airtable.com intercom.com posthog.com webflow.com claude.ai slack.com)
fi
id="${BRANDFETCH_CLIENT_ID:-}"
mkdir -p "$out"
files=()
for domain in "${domains[@]}"; do
  name="${domain%%.*}"; file="$out/$name.png"
  if [ -n "$id" ]; then
    url="https://cdn.brandfetch.io/$domain/w/512/h/512/icon.png?c=$id"
  else
    url="https://www.google.com/s2/favicons?domain=$domain&sz=256"
  fi
  code=$(curl -sS -L -A "Mozilla/5.0" -o "$file" -w "%{http_code}" "$url")
  if [ "$code" != "200" ] || ! file "$file" | grep -qi "image"; then
    echo "  $domain: no icon ($code)" >&2; rm -f "$file"; continue
  fi
  echo "  $domain → $file"
  files+=("$file")
done
[ -z "$id" ] && echo "No Brandfetch client ID: fetched each site's own icon instead. Set BRANDFETCH_CLIENT_ID for the full-size marks." >&2
"$(dirname "$0")/sheet.sh" "$out/sheet.png" "${files[@]}"
