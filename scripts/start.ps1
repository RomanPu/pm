$root = Split-Path $PSScriptRoot -Parent

docker build -t pm-app $root
if (-not $?) { exit 1 }
docker rm -f pm-app *> $null
docker run -d --name pm-app -p 8000:8000 --env-file "$root\.env" -v pm-data:/app/data pm-app
if (-not $?) { exit 1 }

Write-Host "Running at http://localhost:8000"
