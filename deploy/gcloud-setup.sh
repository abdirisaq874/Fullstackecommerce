#!/usr/bin/env bash
# ============================================================================
# One-time GCP bootstrap for the fullstack ecommerce stack.
#
# Provisions: API enablement, Artifact Registry, Secret Manager secrets,
# a Cloud Run runtime service account, a GitHub deployer service account wired
# to Workload Identity Federation (keyless CI), a Serverless VPC connector, and
# a GCE VM running Redis + OpenSearch behind a private firewall.
#
# Run it on your machine (or Cloud Shell) AFTER `gcloud auth login`.
# It is safe to re-run: existing resources are skipped.
#
#   1. Edit the CONFIG block below.
#   2. Export the secret values you have (any you skip get a placeholder you
#      can fill later with: gcloud secrets versions add NAME --data-file=-).
#   3. bash deploy/gcloud-setup.sh
# ============================================================================
set -euo pipefail

# ─── CONFIG — EDIT THESE ────────────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:-CHANGE_ME}"          # e.g. suuq-ecommerce
REGION="${REGION:-us-central1}"                # Cloud Run + VM + connector region
ZONE="${ZONE:-us-central1-a}"
GITHUB_REPO="${GITHUB_REPO:-abdirisaq874/Fullstackecommerce}"  # owner/repo
AR_REPO="${AR_REPO:-apps}"                      # Artifact Registry repo name
VM_NAME="${VM_NAME:-ecom-data}"                 # Redis + OpenSearch host
VM_MACHINE="${VM_MACHINE:-e2-standard-2}"       # 2 vCPU / 8 GB (OpenSearch needs RAM)
CONNECTOR="${CONNECTOR:-ecom-connector}"        # Serverless VPC Access connector
CONNECTOR_RANGE="${CONNECTOR_RANGE:-10.8.0.0/28}"
NETWORK="${NETWORK:-default}"
# ────────────────────────────────────────────────────────────────────────────

if [[ "$PROJECT_ID" == "CHANGE_ME" ]]; then
  echo "ERROR: edit PROJECT_ID at the top of this script (or export PROJECT_ID=...)." >&2
  exit 1
fi

RUNTIME_SA="cloudrun-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOYER_SA="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
POOL="github-pool"
PROVIDER="github-provider"

# Retry wrapper for IAM calls that can hit eventual-consistency races (a freshly
# created service account isn't instantly visible to policy bindings).
retry() {
  local n=0
  until "$@"; do
    n=$((n + 1))
    if [[ $n -ge 8 ]]; then echo "   ...gave up after $n attempts" >&2; return 1; fi
    echo "   ...not ready, retry $n/8 in 8s" >&2; sleep 8
  done
}
# Block until a service account is visible to IAM before we bind roles to it.
wait_for_sa() {
  local sa="$1" i
  for i in $(seq 1 12); do
    gcloud iam service-accounts describe "$sa" >/dev/null 2>&1 && return 0
    sleep 5
  done
}

echo "==> Project: $PROJECT_ID  Region: $REGION  Repo: $GITHUB_REPO"
gcloud config set project "$PROJECT_ID" >/dev/null

# ─── 1. Enable APIs ─────────────────────────────────────────────────────────
echo "==> Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  vpcaccess.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com

# ─── 2. Artifact Registry (Docker) ──────────────────────────────────────────
echo "==> Artifact Registry repo '$AR_REPO'..."
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker --location="$REGION" \
  --description="Container images for ecommerce apps" 2>/dev/null \
  && echo "   created" || echo "   already exists"

# ─── 3. Secret Manager ──────────────────────────────────────────────────────
# Creates each secret if missing. If an env var of the same name is exported,
# its value is stored; otherwise a placeholder is written (fill in later).
SECRETS=(
  MONGODB_URI JWT_SECRET STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET
  MAIL_PASSWORD REDIS_PASSWORD COHERE_API_KEY OPENROUTER_API_KEY
  STORAGE_ACCESS_KEY STORAGE_SECRET_KEY
)
echo "==> Secret Manager secrets..."
for name in "${SECRETS[@]}"; do
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic >/dev/null
    val="${!name:-PLACEHOLDER_change_me}"
    printf '%s' "$val" | gcloud secrets versions add "$name" --data-file=- >/dev/null
    echo "   $name created ($([[ -n "${!name:-}" ]] && echo 'from env' || echo 'PLACEHOLDER'))"
  else
    echo "   $name exists (skipped)"
  fi
done

# ─── 4. Cloud Run runtime service account ───────────────────────────────────
echo "==> Runtime service account..."
gcloud iam service-accounts create cloudrun-runtime \
  --display-name="Cloud Run runtime" 2>/dev/null && echo "   created" || echo "   exists"
wait_for_sa "$RUNTIME_SA"
retry gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" --condition=None >/dev/null

# ─── 5. GitHub deployer service account ─────────────────────────────────────
echo "==> Deployer service account..."
gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions deployer" 2>/dev/null && echo "   created" || echo "   exists"
wait_for_sa "$DEPLOYER_SA"
for role in roles/run.admin roles/artifactregistry.writer roles/iam.serviceAccountUser; do
  retry gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOYER_SA}" --role="$role" --condition=None >/dev/null
done
# Deployer must be able to deploy services that run AS the runtime SA.
retry gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/iam.serviceAccountUser" >/dev/null

# ─── 6. Workload Identity Federation (keyless GitHub auth) ──────────────────
echo "==> Workload Identity Federation..."
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud iam workload-identity-pools create "$POOL" \
  --location=global --display-name="GitHub pool" 2>/dev/null && echo "   pool created" || echo "   pool exists"
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
  --location=global --workload-identity-pool="$POOL" \
  --display-name="GitHub provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${GITHUB_REPO}'" \
  --issuer-uri="https://token.actions.githubusercontent.com" 2>/dev/null \
  && echo "   provider created" || echo "   provider exists"
# Let the GitHub repo impersonate the deployer SA.
retry gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}" >/dev/null

WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"

# ─── 7. Networking: Direct VPC egress (no connector) ────────────────────────
# Cloud Run reaches the VM via Direct VPC egress — the service attaches straight
# to the default subnet at deploy time (--network=default --subnet=default in
# the backend deploy, see deploy/DEPLOYMENT.md). We deliberately avoid a
# Serverless VPC Access connector: it provisions backing e2-micro VMs that fail
# to create on fresh projects ("internal error"). Direct egress has no such
# resource. Here we just capture the subnet range for the firewall rule.
echo "==> Networking (Direct VPC egress, no connector)..."
SUBNET_RANGE="$(gcloud compute networks subnets describe default --region="$REGION" \
  --format='value(ipCidrRange)' 2>/dev/null || echo '10.128.0.0/20')"
echo "   default subnet range: $SUBNET_RANGE"

# ─── 8. Data VM (Redis + OpenSearch via docker compose) ─────────────────────
echo "==> Data VM '$VM_NAME'..."
REDIS_PASSWORD_VALUE="$(gcloud secrets versions access latest --secret=REDIS_PASSWORD)"
STARTUP_FILE="$(mktemp)"
cat > "$STARTUP_FILE" <<'EOS'
#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
sysctl -w vm.max_map_count=262144
echo 'vm.max_map_count=262144' > /etc/sysctl.d/99-opensearch.conf
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
REDIS_PW="$(curl -s -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/attributes/redis-password)"
mkdir -p /opt/ecom
cat > /opt/ecom/docker-compose.yml <<COMPOSE
services:
  opensearch:
    image: opensearchproject/opensearch:2.13.0
    container_name: ecom-opensearch
    restart: unless-stopped
    environment:
      - discovery.type=single-node
      - bootstrap.memory_lock=true
      - "OPENSEARCH_JAVA_OPTS=-Xms2g -Xmx2g"
      - DISABLE_SECURITY_PLUGIN=true
      - DISABLE_INSTALL_DEMO_CONFIG=true
    ulimits:
      memlock: { soft: -1, hard: -1 }
      nofile: { soft: 65536, hard: 65536 }
    volumes:
      - opensearch-data:/usr/share/opensearch/data
    ports:
      - "9200:9200"
  redis:
    image: redis:7-alpine
    container_name: ecom-redis
    restart: unless-stopped
    command: ["redis-server","--appendonly","yes","--requirepass","${REDIS_PW}"]
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
volumes:
  opensearch-data:
  redis-data:
COMPOSE
docker compose -f /opt/ecom/docker-compose.yml up -d
EOS

# Use --metadata-from-file for the startup script: it contains commas/newlines
# that would break the comma-delimited --metadata parser.
if gcloud compute instances describe "$VM_NAME" --zone="$ZONE" >/dev/null 2>&1; then
  echo "   exists"
else
  gcloud compute instances create "$VM_NAME" \
    --zone="$ZONE" --machine-type="$VM_MACHINE" \
    --image-family=debian-12 --image-project=debian-cloud \
    --network="$NETWORK" --tags=ecom-data \
    --metadata=redis-password="$REDIS_PASSWORD_VALUE" \
    --metadata-from-file=startup-script="$STARTUP_FILE"
  echo "   created"
fi
rm -f "$STARTUP_FILE"

# ─── 9. Firewall: subnet range -> VM data ports only ────────────────────────
# Direct VPC egress gives Cloud Run instances IPs from the default subnet, so we
# allow that range to reach Redis/OpenSearch. Update in place if the rule from a
# previous run still points at an old range.
echo "==> Firewall rule..."
if gcloud compute firewall-rules describe allow-ecom-data >/dev/null 2>&1; then
  gcloud compute firewall-rules update allow-ecom-data \
    --rules=tcp:6379,tcp:9200 --source-ranges="$SUBNET_RANGE"
  echo "   updated (source: $SUBNET_RANGE)"
else
  gcloud compute firewall-rules create allow-ecom-data \
    --network="$NETWORK" --direction=INGRESS --action=ALLOW \
    --rules=tcp:6379,tcp:9200 \
    --source-ranges="$SUBNET_RANGE" --target-tags=ecom-data
  echo "   created (source: $SUBNET_RANGE)"
fi

VM_IP="$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" \
  --format='value(networkInterfaces[0].networkIP)')"

# ─── DONE — print the values you need for GitHub ────────────────────────────
cat <<SUMMARY

============================================================================
✅  Infrastructure ready.

VM internal IP (use for backend REDIS_HOST / OPENSEARCH_NODE): $VM_IP

Add these to GitHub → Settings → Secrets and variables → Actions:

  Repository VARIABLES:
    GCP_PROJECT_ID = $PROJECT_ID
    GCP_REGION     = $REGION
    AR_REPO        = $AR_REPO
    BACKEND_URL    = (set after first backend deploy, e.g. https://.../api/v1)
    SELLER_APP_URL = (the seller-portal Cloud Run URL, set after its deploy)
    NEXT_PUBLIC_SITE_NAME = Suuq
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_or_test_...
    NEXT_PUBLIC_SENTRY_DSN = (optional)

  Repository SECRETS:
    GCP_WORKLOAD_IDENTITY_PROVIDER = $WIF_PROVIDER
    GCP_DEPLOYER_SA                = $DEPLOYER_SA
    SENTRY_AUTH_TOKEN              = (optional)

Networking: Cloud Run uses Direct VPC egress on subnet 'default'
(--network=default --subnet=default --vpc-egress=private-ranges-only).
No VPC connector is used.

Next: run the first-time Cloud Run deploys in deploy/DEPLOYMENT.md (§5),
then push to main to let CI take over.
============================================================================
SUMMARY
