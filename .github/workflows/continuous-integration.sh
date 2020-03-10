#!/usr/bin/env bash
set -euo pipefail

# Install deps
npm install

# Build
npm run build

# Lint
npm rm tslint

# Test
npm install "$matrix_typescript"
npm run test-cov

# Generate coverage report
npm run lcov
