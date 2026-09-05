#!/usr/bin/env bash
# ==============================================================================
# AIRA Local CI Pipeline Runner
# ==============================================================================
# Runs the full deterministic offline CI pipeline locally.
# Requires NO Gemini API key and enforces all 7 verification requirements.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"
echo "Executing AIRA local CI verification pipeline..."
npm run ci
