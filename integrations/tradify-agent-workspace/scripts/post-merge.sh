#!/bin/bash
set -e
pnpm install --frozen-lockfile --prefer-offline
pnpm --filter @workspace/db run push-force
