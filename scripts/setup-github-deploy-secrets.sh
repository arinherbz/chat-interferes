#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-arinherbz/chat-interferes}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install it first."
  exit 1
fi

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "GitHub CLI is not logged in."
  echo "Run: gh auth login"
  exit 1
fi

read -r -p "DATABASE_URL: " DATABASE_URL
read -r -p "RAILWAY_TOKEN: " RAILWAY_TOKEN
read -r -p "RAILWAY_SERVICE_ID: " RAILWAY_SERVICE_ID
read -r -p "RAILWAY_ENVIRONMENT_ID: " RAILWAY_ENVIRONMENT_ID
read -r -p "DEPLOY_HEALTHCHECK_URL (https://.../health): " DEPLOY_HEALTHCHECK_URL

printf "%s" "$DATABASE_URL" | gh secret set DATABASE_URL -R "$REPO"
printf "%s" "$RAILWAY_TOKEN" | gh secret set RAILWAY_TOKEN -R "$REPO"
printf "%s" "$RAILWAY_SERVICE_ID" | gh secret set RAILWAY_SERVICE_ID -R "$REPO"
printf "%s" "$RAILWAY_ENVIRONMENT_ID" | gh secret set RAILWAY_ENVIRONMENT_ID -R "$REPO"
printf "%s" "$DEPLOY_HEALTHCHECK_URL" | gh secret set DEPLOY_HEALTHCHECK_URL -R "$REPO"

echo "Secrets configured for $REPO."
echo "Triggering deploy workflow..."
gh workflow run "Deploy Railway" -R "$REPO"
echo "Done. Watch run: https://github.com/$REPO/actions"
