#!/usr/bin/env bash
set -euo pipefail

# Simple helper to install deps and run tests locally
echo "Installing dependencies..."
npm install

echo "Running tests..."
npm test

echo "Tests finished with exit code $?"
