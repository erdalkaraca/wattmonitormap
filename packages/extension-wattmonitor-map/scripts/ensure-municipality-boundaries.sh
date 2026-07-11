#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

STATE_FILE="${EXT_DIR}/src/state-boundaries.geojson"
BOUNDARY_DIR="${EXT_DIR}/src/municipality-boundaries"

missing=0

if [[ ! -s "${STATE_FILE}" ]]; then
  missing=1
fi

for state_code in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16; do
  if [[ ! -s "${BOUNDARY_DIR}/${state_code}.geojson" ]]; then
    missing=1
    break
  fi
done

if [[ "${missing}" -eq 1 ]]; then
  echo "Municipality boundary assets missing. Regenerating..."
  bash "${SCRIPT_DIR}/generate-municipality-boundaries.sh"
else
  echo "Municipality boundary assets present."
fi
