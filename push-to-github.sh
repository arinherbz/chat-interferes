#!/bin/bash
# Push Ariostore code to GitHub
# Run this script to deploy

echo "🚀 Pushing Ariostore to GitHub"
echo "=============================="
echo ""

cd chat-interferes

# Check if we have a token in environment
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN not set"
    echo ""
    echo "Please set your GitHub token first:"
    echo "export GITHUB_TOKEN='ghp_xxxxxxxxxxxxxxxxxxxx'"
    echo ""
    echo "To get a token:"
    echo "1. Go to https://github.com/settings/tokens"
    echo "2. Click 'Generate new token (classic)'"
    echo "3. Select 'repo' scope"
    echo "4. Copy the token"
    echo ""
    exit 1
fi

# Set the remote URL with token
git remote set-url origin "https://arinherbz:${GITHUB_TOKEN}@github.com/arinherbz/chat-interferes.git"

# Push to GitHub
echo "📤 Pushing code..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Code pushed to GitHub"
    echo ""
    echo "Render will auto-deploy shortly."
    echo "Check: https://dashboard.render.com"
else
    echo ""
    echo "❌ Push failed"
    echo "Check your token has 'repo' permissions"
fi
