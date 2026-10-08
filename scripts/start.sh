#!/usr/bin/env bash
set -e

root="$(cd "$(dirname "$0")/.." && pwd)"

docker build -t pm-app "$root"
docker rm -f pm-app > /dev/null 2>&1 || true
docker run -d --name pm-app -p 8000:8000 --env-file "$root/.env" -v pm-data:/app/data pm-app

echo "Running at http://localhost:8000"
