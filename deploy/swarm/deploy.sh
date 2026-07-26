#!/bin/bash
# Runs ON the Swarm manager VM. Pulls secrets from Secret Manager (the VM's
# service account has secretAccessor), then deploys/updates the stack.
# Images are pulled from Artifact Registry via the gcloud docker cred helper.
set -euo pipefail
cd "$(dirname "$0")"

sec() { gcloud secrets versions access latest --secret="$1" --project=suuq-ecommerce; }

export MONGODB_URI="$(sec MONGODB_URI)"
export JWT_SECRET="$(sec JWT_SECRET)"
export REDIS_PASSWORD="$(sec REDIS_PASSWORD)"
export STRIPE_SECRET_KEY="$(sec STRIPE_SECRET_KEY)"
export STRIPE_WEBHOOK_SECRET="$(sec STRIPE_WEBHOOK_SECRET)"
export MAIL_PASSWORD="$(sec MAIL_PASSWORD)"
export COHERE_API_KEY="$(sec COHERE_API_KEY)"
export OPENROUTER_API_KEY="$(sec OPENROUTER_API_KEY)"
export GEMINI_API_KEY="$(sec GEMINI_API_KEY)"
export STORAGE_ACCESS_KEY="$(sec STORAGE_ACCESS_KEY)"
export STORAGE_SECRET_KEY="$(sec STORAGE_SECRET_KEY)"
export RESEND_API_KEY="$(sec RESEND_API_KEY)"
# Optional until the Resend webhook is registered — empty ⇒ webhook skips signature check.
export RESEND_WEBHOOK_SECRET="$(sec RESEND_WEBHOOK_SECRET 2>/dev/null || echo '')"
# Meta Conversions API token — optional; empty ⇒ server-side CAPI no-ops (the
# browser pixel still fires). Add the secret then redeploy to activate CAPI.
export META_CAPI_ACCESS_TOKEN="$(sec META_CAPI_ACCESS_TOKEN 2>/dev/null || echo '')"
# OpenSearch Dashboards basic-auth (Caddy fronts search.gaarsiiglobal.com).
# HASH is REQUIRED: this `sec` call aborts the deploy (set -e) if the secret is
# absent, so we never ship the dashboard without a password. Generate the hash
# with:  docker run --rm caddy:2-alpine caddy hash-password --plaintext 'PASS'
export SEARCH_ADMIN_USER="$(sec SEARCH_ADMIN_USER 2>/dev/null || echo 'admin')"
export SEARCH_ADMIN_HASH="$(sec SEARCH_ADMIN_HASH)"

# Refresh Artifact Registry auth (token via the VM's metadata SA) and deploy.
gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
docker stack deploy -c stack.yml suuq --with-registry-auth --prune --resolve-image=always

echo "Deployed. Services:"
docker stack services suuq
