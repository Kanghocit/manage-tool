#!/usr/bin/env bash
# Deploy manage-tool on VPS after git push to production.
# Required env: DEPLOY_PATH, VITE_API_URL
# Optional: PM2_APP_NAME (default manage-tool-api), GIT_BRANCH (default production)

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:?DEPLOY_PATH is required}"
VITE_API_URL="${VITE_API_URL:?VITE_API_URL is required}"
PM2_APP_NAME="${PM2_APP_NAME:-manage-tool-api}"
GIT_BRANCH="${GIT_BRANCH:-production}"

echo "==> Deploy ${GIT_BRANCH} in ${DEPLOY_PATH}"

cd "${DEPLOY_PATH}"

if [[ ! -d .git ]]; then
  echo "ERROR: ${DEPLOY_PATH} is not a git repository. Clone the repo first."
  exit 1
fi

git fetch origin "${GIT_BRANCH}"
git reset --hard "origin/${GIT_BRANCH}"

echo "==> Backend"
cd be
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy

echo "==> Frontend"
cd ../fe
npm ci
VITE_API_URL="${VITE_API_URL}" npm run build

echo "==> PM2 reload"
cd ..
if pm2 describe "${PM2_APP_NAME}" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs --only "${PM2_APP_NAME}"
fi
pm2 save || true

echo "==> Deploy finished OK"
