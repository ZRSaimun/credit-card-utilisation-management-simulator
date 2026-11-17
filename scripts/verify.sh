#!/usr/bin/env bash
set -euo pipefail
npm test
npm run build
python3 validation/validate_model.py
g++ -std=c++17 -O2 cpp/ledger_engine.cpp -o /tmp/credit-card-ledger-engine
test "$(/tmp/credit-card-ledger-engine)" = "19773.00"
echo "PASS: C++ ledger engine accounting check"
echo "All simulator checks passed."

