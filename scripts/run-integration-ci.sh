#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "SUPABASE_SERVICE_ROLE_KEY is not set. Aborting."
  exit 1
fi

node scratch/phase2_integration_test.mjs | tee phase2_test.log
node scratch/phase2_integration_assert.mjs | tee phase2_assert.log
