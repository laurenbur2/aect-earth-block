#!/usr/bin/env bash
# Deploy the lead backend to Supabase. Run from the repo root after `supabase login` and
# `supabase link --project-ref <ref>` (run those inside backend/). See backend/README.md.
set -euo pipefail
cd "$(dirname "$0")/../backend"
mkdir -p supabase/functions/_shared
# The stage rules and email templates live in site/admin/pipeline.js so the dashboard can use them too.
cp ../site/admin/pipeline.js supabase/functions/_shared/pipeline.js
supabase db push
supabase functions deploy submit-lead --no-verify-jwt
