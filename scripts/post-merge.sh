#!/bin/bash
set -euo pipefail

npm install --no-audit --no-fund

# Do not run drizzle-kit push automatically here. It prompts to infer table
# renames and its --force flag can approve data-loss operations. Schema changes
# must be applied through reviewed migrations or an explicit database task.
npm run build
