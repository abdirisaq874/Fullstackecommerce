# Deployment & CI/CD — GCP Cloud Run

How the fullstack ecommerce stack runs on Google Cloud, and the exact steps to
bring it up using the $300 free trial.

## What gets deployed

**3 application services** (built into containers, deployed by CI):

| Service (Cloud Run) | Source dir | Public |
|---|---|---|
| `ecommerce-backend` | `ecommerce-backend/` | API, public |
| `storefront` | `storefront/` | customer site, public |
| `seller-portal` | `seller-portal-v2/` | seller dashboard, public |

**3 backing data services**:

| Service | Where | Notes |
|---|---|---|
| MongoDB | **MongoDB Atlas M0 (free)** | Replica set + transactions, off your GCP credit |
| Redis | GCE VM `ecom-data` | Bull queues + cache, password-protected |
| OpenSearch | GCE VM `ecom-data` | Smart/multilingual search, 2 GB heap |

Cloud Run reaches Redis/OpenSearch privately over a **Serverless VPC connector**;
those ports are firewalled off from the internet. Mongo Atlas is reached over
the internet with an allow-list + SRV credentials.

### Cost sketch (90-day / $300 trial)
- Cloud Run ×3 — scale to zero, ~$0 idle, a few $/mo under light load
- Artifact Registry — pennies
- VPC connector — ~$8/mo
- GCE `e2-standard-2` VM — ~$48/mo
- MongoDB Atlas M0 — **free** (separate from GCP)

≈ **$55–60/mo** → comfortably inside $300 over 90 days.

---

## Prerequisites

1. `gcloud` CLI installed and `gcloud auth login` done.
2. A GCP project on the $300 trial with **billing enabled** (the trial billing
   account is fine). Note the **project ID**.
3. A free **MongoDB Atlas** account.
4. `docker` installed locally (only if you want to do the manual first deploys
   below from your machine instead of Cloud Shell — Cloud Shell has it).

---

## Step 1 — MongoDB Atlas (free, ~5 min)

1. Create a free **M0** cluster (choose **Google Cloud** as the provider and the
   same region as `GCP_REGION`, e.g. `us-central1`).
2. **Database Access** → add a user (username + password).
3. **Network Access** → for the trial, add `0.0.0.0/0` (allow all). Tighten later
   to Cloud Run's egress range if you add Cloud NAT.
4. Copy the **SRV connection string**, e.g.
   `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/ecommerce?retryWrites=true&w=majority`
   → this is your `MONGODB_URI` secret.

## Step 2 — Run the bootstrap script

Edit the CONFIG block at the top of [`gcloud-setup.sh`](./gcloud-setup.sh)
(`PROJECT_ID`, `REGION`, `GITHUB_REPO`), then export the secret values you have
and run it. Anything you don't export gets a `PLACEHOLDER` you can fill later.

```bash
export PROJECT_ID="your-project-id"
export REGION="us-central1"

# Secrets (any you skip become PLACEHOLDER — add real values later):
export MONGODB_URI='mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/ecommerce?retryWrites=true&w=majority'
export JWT_SECRET="$(openssl rand -hex 32)"
export REDIS_PASSWORD="$(openssl rand -hex 24)"
export STRIPE_SECRET_KEY="sk_test_..."
export STRIPE_WEBHOOK_SECRET="whsec_..."
export MAIL_PASSWORD="your-sendgrid-api-key"
export COHERE_API_KEY="..."          # for vector search + rerank
export OPENROUTER_API_KEY="..."      # for translation + query understanding
export STORAGE_ACCESS_KEY="..."      # S3/R2 asset storage
export STORAGE_SECRET_KEY="..."

bash deploy/gcloud-setup.sh
```

It provisions: APIs, Artifact Registry, Secret Manager, the runtime + deployer
service accounts, Workload Identity Federation, the VPC connector, the
Redis+OpenSearch VM, and the firewall. It prints the **VM internal IP** and the
**GitHub values** you need next.

> To add/replace a secret value later:
> `printf '%s' 'the-value' | gcloud secrets versions add SECRET_NAME --data-file=-`

## Step 3 — Configure GitHub (Settings → Secrets and variables → Actions)

Use the values the script printed.

**Variables:**

| Name | Value |
|---|---|
| `GCP_PROJECT_ID` | your project id |
| `GCP_REGION` | `us-central1` |
| `AR_REPO` | `apps` |
| `BACKEND_URL` | *set in Step 5* (e.g. `https://ecommerce-backend-xxxx.a.run.app/api/v1`) |
| `SELLER_APP_URL` | *set in Step 5* (seller portal URL) |
| `NEXT_PUBLIC_SITE_NAME` | `Suuq` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |
| `NEXT_PUBLIC_SENTRY_DSN` | *(optional)* |

**Secrets:**

| Name | Value |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_DEPLOYER_SA` | `github-deployer@PROJECT.iam.gserviceaccount.com` |
| `SENTRY_AUTH_TOKEN` | *(optional)* |

## Step 4 — Push the build artifacts

The Dockerfiles, `.dockerignore`s, `output: 'standalone'` config, and the
deploy workflows are all in this repo. Commit and push to `main`:

```bash
git add -A && git commit -m "chore: add Cloud Run deploy + CI/CD" && git push
```

## Step 5 — First-time deploys (one-time)

CI redeploys are **image-only** — they reuse the env vars, secrets, and VPC
connector from the previous revision. So the backend's first revision must be
created with the full config below. Run it once (from your machine or Cloud
Shell). Set the variables to match the script's CONFIG and the printed VM IP.

```bash
PROJECT_ID="your-project-id"; REGION="us-central1"; AR_REPO="apps"
VM_IP="10.128.0.x"            # printed by gcloud-setup.sh
RUNTIME_SA="cloudrun-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/ecommerce-backend:latest"

# Build & push the backend image (Cloud Build — no local docker needed):
gcloud builds submit ./ecommerce-backend --tag "$IMAGE" --project "$PROJECT_ID"

# Create the backend service WITH full runtime config.
# Networking: Direct VPC egress (no connector) — attaches Cloud Run to the
# default subnet so it can reach the VM's private IP.
# Note: --set-env-vars uses a custom '^@^' delimiter because some values
# (SEARCH_LOCALES, FRONTEND_URL) contain commas.
gcloud run deploy ecommerce-backend \
  --image "$IMAGE" --region "$REGION" --project "$PROJECT_ID" \
  --service-account "$RUNTIME_SA" \
  --network=default --subnet=default --vpc-egress=private-ranges-only \
  --allow-unauthenticated --port 8080 \
  --cpu 1 --memory 512Mi --min-instances 0 --max-instances 4 \
  --set-secrets "MONGODB_URI=MONGODB_URI:latest,JWT_SECRET=JWT_SECRET:latest,STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest,MAIL_PASSWORD=MAIL_PASSWORD:latest,REDIS_PASSWORD=REDIS_PASSWORD:latest,COHERE_API_KEY=COHERE_API_KEY:latest,OPENROUTER_API_KEY=OPENROUTER_API_KEY:latest,STORAGE_ACCESS_KEY=STORAGE_ACCESS_KEY:latest,STORAGE_SECRET_KEY=STORAGE_SECRET_KEY:latest" \
  --set-env-vars "^@^NODE_ENV=production@API_PREFIX=api/v1@MONGODB_DB_NAME=ecommerce@REDIS_HOST=${VM_IP}@REDIS_PORT=6379@OPENSEARCH_NODE=http://${VM_IP}:9200@SEARCH_PRODUCT_INDEX=products_v1@SEARCH_DEFAULT_LOCALE=en@SEARCH_LOCALES=en,so@SEARCH_ENABLE_VECTOR=1@SEARCH_ENABLE_RERANK=1@SEARCH_ENABLE_QUERY_UNDERSTANDING=1@SEARCH_ENABLE_TRANSLATION=1@EMBEDDINGS_PROVIDER=cohere@EMBEDDINGS_DIMS=1024@COHERE_EMBED_MODEL=embed-multilingual-v3.0@RERANK_PROVIDER=cohere@COHERE_RERANK_MODEL=rerank-multilingual-v3.0@OPENROUTER_BASE_URL=https://openrouter.ai/api/v1@OPENROUTER_TRANSLATION_MODEL=google/gemini-2.0-flash-001@OPENROUTER_QU_MODEL=google/gemini-2.0-flash-001@STRIPE_CURRENCY=usd@MAIL_HOST=smtp.sendgrid.net@MAIL_PORT=587@MAIL_USER=apikey@MAIL_FROM=noreply@yourshop.com@MAIL_FROM_NAME=Suuq@FRONTEND_URL=https://placeholder.invalid@THROTTLE_TTL=60@THROTTLE_LIMIT=100"

# Grab the backend URL and set the GitHub BACKEND_URL variable to:
gcloud run services describe ecommerce-backend --region "$REGION" \
  --format='value(status.url)'      # append /api/v1
```

Now set the GitHub **`BACKEND_URL`** variable (backend URL + `/api/v1`), then
trigger the two frontend workflows — push a change under `storefront/` or
`seller-portal-v2/`, or run them manually from the **Actions** tab
(*workflow_dispatch*). They build with the baked-in API URL and create the
services as public.

Finally, wire CORS + the seller `SELLER_APP_URL`:

```bash
STORE_URL="$(gcloud run services describe storefront     --region "$REGION" --format='value(status.url)')"
SELLER_URL="$(gcloud run services describe seller-portal --region "$REGION" --format='value(status.url)')"

# Let the backend accept both frontends (FRONTEND_URL is comma-separated):
gcloud run services update ecommerce-backend --region "$REGION" \
  --update-env-vars "^@^FRONTEND_URL=${STORE_URL},${SELLER_URL}"
```
Set GitHub variable `SELLER_APP_URL=$SELLER_URL` (used as the seller portal's
`NEXT_PUBLIC_APP_URL` on its next build).

## Step 6 — Seed & index

```bash
# Point a local shell at Atlas + the VM (open the VM's firewall to your IP
# temporarily, or run these from the VM), then:
cd ecommerce-backend
MONGODB_URI='...' npm run seed
MONGODB_URI='...' OPENSEARCH_NODE='http://VM_IP:9200' npm run search:reindex
```

## From here on — CI/CD is automatic

Push to `main`:
- changes under `ecommerce-backend/**` → **Backend Deploy** builds + redeploys
- changes under `storefront/**` → **Storefront Deploy**
- changes under `seller-portal-v2/**` → **Seller Portal Deploy**

Each deploy is image-only and preserves the runtime config above.

## Troubleshooting

- **Backend 500 / Mongo errors** — check Atlas Network Access allows Cloud Run,
  and `MONGODB_URI` secret is the real SRV string (not `PLACEHOLDER`).
- **Search returns nothing** — confirm the VM is up
  (`gcloud compute ssh ecom-data --zone $ZONE -- docker ps`), the connector is
  attached to the backend, and you ran `search:reindex`.
- **CORS errors in the browser** — `FRONTEND_URL` must list both frontend URLs.
- **CI auth fails** — the WIF provider's attribute condition pins the exact
  `owner/repo`; confirm `GITHUB_REPO` matched and the two GitHub secrets are set.
