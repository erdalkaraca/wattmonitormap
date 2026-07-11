#!/usr/bin/env bash
set -euo pipefail

# Rebuilds municipality boundary assets from official BKG VG250 data.
#
# Usage:
#   npm run generate:municipality-boundaries -w extension-wattmonitor-map
#
# Optional overrides:
#   SIMPLIFY=8% PRECISION=0.0001 npm run generate:municipality-boundaries -w extension-wattmonitor-map
#   VG250_URL='https://.../vg250_12-31.utm32s.shape.ebenen.zip' npm run generate:municipality-boundaries -w extension-wattmonitor-map

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${EXT_DIR}/src/municipality-boundaries"
STATE_BOUNDARIES_FILE="${EXT_DIR}/src/state-boundaries.geojson"

VG250_URL="${VG250_URL:-https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_1231/aktuell/vg250_12-31.utm32s.shape.ebenen.zip}"
SIMPLIFY="${SIMPLIFY:-5%}"
STATE_SIMPLIFY="${STATE_SIMPLIFY:-20%}"
PRECISION="${PRECISION:-0.0001}"
MAPSHAPER_VERSION="${MAPSHAPER_VERSION:-0.7.44}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

ZIP_FILE="${TMP_DIR}/vg250_shape.zip"
GEM_SHAPE_BASE="${TMP_DIR}/vg250_ebenen_1231/VG250_GEM"
LAN_SHAPE_BASE="${TMP_DIR}/vg250_ebenen_1231/VG250_LAN"

echo "[1/5] Downloading VG250 data..."
curl -L -sS -o "${ZIP_FILE}" "${VG250_URL}"

echo "[2/5] Extracting municipality/state shapefiles..."
unzip -q "${ZIP_FILE}" 'vg250_ebenen_1231/VG250_GEM.*' 'vg250_ebenen_1231/VG250_LAN.*' -d "${TMP_DIR}"

mkdir -p "${OUTPUT_DIR}"
rm -f "${OUTPUT_DIR}"/*.geojson

echo "[3/5] Building state boundaries (SN_L + GEN)..."
npx --yes "mapshaper@${MAPSHAPER_VERSION}" \
  -i "${LAN_SHAPE_BASE}.shp" encoding=utf8 \
  -filter-fields SN_L,GEN \
  -proj wgs84 \
  -simplify "${STATE_SIMPLIFY}" keep-shapes \
  -o format=geojson precision="${PRECISION}" "${STATE_BOUNDARIES_FILE}"

echo "[4/5] Building municipality boundaries split by state (AGS + GEN + SN_L)..."
for state_code in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16; do
  npx --yes "mapshaper@${MAPSHAPER_VERSION}" \
    -i "${GEM_SHAPE_BASE}.shp" encoding=utf8 \
    -filter "SN_L=='${state_code}'" \
    -filter-fields AGS,GEN,SN_L \
    -proj wgs84 \
    -simplify "${SIMPLIFY}" keep-shapes \
    -o format=geojson precision="${PRECISION}" "${OUTPUT_DIR}/${state_code}.geojson"
done

echo "[5/5] Done. Outputs:"
ls -lh "${STATE_BOUNDARIES_FILE}"
ls -lh "${OUTPUT_DIR}"/*.geojson
