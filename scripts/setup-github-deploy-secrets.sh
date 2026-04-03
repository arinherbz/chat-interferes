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
read -r -p "RENDER_DEPLOY_HOOK_URL: " RENDER_DEPLOY_HOOK_URL
read -r -p "DEPLOY_HEALTHCHECK_URL (https://.../health): " DEPLOY_HEALTHCHECK_URL

printf "%s" "$DATABASE_URL" | gh secret set DATABASE_URL -R "$REPO"
printf "%s" "$RENDER_DEPLOY_HOOK_URL" | gh secret set RENDER_DEPLOY_HOOK_URL -R "$REPO"
printf "%s" "$DEPLOY_HEALTHCHECK_URL" | gh secret set DEPLOY_HEALTHCHECK_URL -R "$REPO"

echo "Secrets configured for $REPO."
echo "Triggering deploy workflow..."
gh workflow run "Deploy Render" -R "$REPO"
echo "Done. Watch run: https://github.com/$REPO/actions"
