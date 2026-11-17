#!/usr/bin/env bash
set -euo pipefail
npm test
npm run build
python3 validation/validate_model.py
echo "All simulator checks passed."

