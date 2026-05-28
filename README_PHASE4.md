Phase 4: Integration & Staging

Overview
- This phase runs integration tests that exercise payments↔costs workflows against a Supabase staging instance, then deploys to staging and runs smoke checks.

Required repo secrets (GitHub):
- SUPABASE_URL — Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (required for tests)
- STAGING_SSH_HOST — staging server host (for deploy job)
- STAGING_SSH_USER — SSH user
- STAGING_SSH_KEY — SSH private key (add as "Secret" with newlines escaped)
- STAGING_DEPLOY_CMD — remote deploy command to run on staging (e.g., "cd /srv/app && docker-compose pull && docker-compose up -d")

How to run locally

1. Set env vars in your shell (example PowerShell):

```powershell
$env:SUPABASE_URL = "https://xyz.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
node scratch/phase2_integration_test.mjs
node scratch/phase2_integration_assert.mjs
```

2. Or use the helper script (Linux/macOS/WSL/Git Bash):

```bash
export SUPABASE_URL="https://xyz.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
./scripts/run-integration-ci.sh
```

Triggering CI
- Push to `feature/phase2-ci` or `main`, or run the workflow manually (`Actions` → `Phase2 Integration + Staging` → `Run workflow`).

Notes
- Integration tests will fail if the Supabase key is missing or insufficiently privileged. Use a service-role key for CI.
- Do not commit secrets to the repo. Add them in GitHub Settings → Secrets.
