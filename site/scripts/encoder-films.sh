#!/usr/bin/env bash
# Ré-encode les originaux Higgsfield (souvent en HEVC) pour le web :
# MP4 H.264 + WebM VP9, sans son, et une affiche JPEG pleine largeur.
# Usage : scripts/encoder-films.sh <dossier des originaux>   (ONLY="table m-table" pour n'en refaire que certains)
#
# Si <dossier>/_hd/ contient une version suréchantillonnée du même fichier, c'est elle qui sert de source :
# réduite à 1080p, elle donne une image plus fine que l'original.
# Qualité : H.264 CRF 19 et VP9 CRF 25, soit environ 3 à 5 Mbit/s. En dessous, les ombres et les
# reflets des films de nuit se bouchent.
set -euo pipefail
SRC="${1:?dossier des originaux}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public"

encode() { # nom  fichier-source  largeur  hauteur
  local name="$1" in="$SRC/$2" w="$3" h="$4"
  [ -n "${ONLY:-}" ] && [[ " $ONLY " != *" $name "* ]] && return 0
  [ -f "$SRC/_hd/$2" ] && in="$SRC/_hd/$2"
  [ -f "$in" ] || { echo "absent : $in" >&2; return 0; }
  local vf="scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h},fps=24"
  ffmpeg -v error -y -i "$in" -an -vf "$vf" -c:v libx264 -preset slower -crf 19 -pix_fmt yuv420p -movflags +faststart "$OUT/video/$name.mp4"
  ffmpeg -v error -y -i "$in" -an -vf "$vf" -c:v libvpx-vp9 -crf 25 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p "$OUT/video/$name.webm"
  ffmpeg -v error -y -i "$in" -frames:v 1 -vf "scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}" -q:v 3 "$OUT/img/$name-poster.jpg"
  printf '%-16s %-6s mp4 %5s Ko  webm %5s Ko\n' "$name" "$([ "$in" = "$SRC/$2" ] && echo 1080p || echo hd)" "$(($(stat -c%s "$OUT/video/$name.mp4") / 1024))" "$(($(stat -c%s "$OUT/video/$name.webm") / 1024))"
}

# Originaux retrouvés dans l'historique Higgsfield
encode jour-montaigne montaigne-jour__3944a419.mp4 1920 1080
encode volant         volant__e865c48c.mp4 1920 1080
encode van            van-nuit__3306d355.mp4 1920 1080
encode shopping       sacs-shopping__ea0e0782.mp4 1920 1080
encode salon          salon-toits__664da858.mp4 1920 1080
encode cour           cour-pavee__f4d315d0.mp4 1920 1080
encode arrivee        jet-tarmac__98b20ccb.mp4 1920 1080
encode cles           enveloppe-cle__677be6e5.mp4 1920 1080
encode rivoli         rivoli__4a355a64.mp4 1920 1080
encode m-chauffeur    portiere-gant-portrait__20681608.mp4 1080 1920
encode m-van          van-sieges-portrait__806e0fb3.mp4 1080 1920
encode m-clinique     clinique-salle__e06c01c6.mp4 1080 1920
# Films des services ajoutés (immobilier, tables, événements, séjour esthétique)
encode clinique       clinique.mp4 1920 1080
encode appartement    appartement.mp4 1920 1080
encode table          table.mp4 1920 1080
encode reception      reception.mp4 1920 1080
encode m-table        m-table.mp4 1080 1920
encode m-appartement  m-appartement.mp4 1080 1920
encode tournage       tournage.mp4 1920 1080
