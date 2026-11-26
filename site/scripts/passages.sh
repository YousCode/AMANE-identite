#!/usr/bin/env bash
# Découpe les passages (plans de caméra entre deux films) en images fixes pour le défilement.
# Usage : scripts/passages.sh <dossier contenant p01.mp4 … p12.mp4>   (ONLY="p03 p07" pour n'en refaire que certains)
#   public/passages/pNN-d.bin   40 images 1280×720, plein cadre
#   public/passages/pNN-m.bin   40 images 608×1080, recadrage central 9:16 pour les écrans en hauteur
# Les 40 images sont réparties régulièrement sur toute la durée : la première et la dernière image
# du plan sont toujours gardées, puisque ce sont elles qui raccordent avec les films.
# Elles sont réunies en un fichier par passage et par format (scripts/paquet-passage.mjs).
set -euo pipefail
SRC="${1:?dossier des passages}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../public/passages"
N=40
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for in in "$SRC"/p[0-9][0-9].mp4; do
  id="$(basename "$in" .mp4)"
  [ -n "${ONLY:-}" ] && [[ " $ONLY " != *" $id "* ]] && continue
  rm -rf "$TMP"/*
  mkdir -p "$TMP/all" "$TMP/web" "$OUT"
  ffmpeg -v error -i "$in" -vf "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080" "$TMP/all/%04d.png"
  total=$(ls "$TMP/all" | wc -l)
  for ((k = 0; k < N; k++)); do
    i=$(((k * (total - 1) + (N - 1) / 2) / (N - 1) + 1))
    src="$TMP/all/$(printf %04d "$i").png"
    kk=$(printf %02d "$k")
    ffmpeg -v error -y -i "$src" -vf "scale=1280:720:flags=lanczos" -c:v libwebp -quality 64 "$TMP/web/d-$kk.webp"
    ffmpeg -v error -y -i "$src" -vf "crop=608:1080,scale=608:1080" -c:v libwebp -quality 64 "$TMP/web/m-$kk.webp"
  done
  node "$HERE/paquet-passage.mjs" "$TMP/web" d "$OUT/$id-d.bin"
  node "$HERE/paquet-passage.mjs" "$TMP/web" m "$OUT/$id-m.bin"
  echo "$id : $total images → $N ($(du -h "$OUT/$id-d.bin" | cut -f1) + $(du -h "$OUT/$id-m.bin" | cut -f1))"
done
