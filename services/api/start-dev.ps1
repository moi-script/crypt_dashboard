$deployment = "local8499"
$rootEnv    = "$PSScriptRoot\..\..\.env.local"

# 1. Start Atlas local deployment
Write-Host "Starting Atlas local deployment '$deployment'..."
atlas local start $deployment --waitForHealthy
if ($LASTEXITCODE -ne 0) {
    Write-Error "Atlas failed to start. Is Docker Engine running?"
    exit 1
}

# 2. Get connection string and swap 127.0.0.1 → host.docker.internal
$connStr = atlas local connect $deployment --connectWith connectionString 2>&1
if (-not $connStr -or $connStr -match "Failed|Error") {
    Write-Error "Could not get connection string: $connStr"
    exit 1
}
$dockerConnStr = $connStr -replace "127\.0\.0\.1", "host.docker.internal"
Write-Host "Atlas connection string (Docker): $dockerConnStr"

# 3. Update root .env.local (what docker-compose reads)
$env = Get-Content $rootEnv
$env = $env -replace '^MONGO_URL=.*', "MONGO_URL=$dockerConnStr"
$env | Set-Content $rootEnv -Encoding utf8
Write-Host "Root .env.local updated."

# 4. Restart the Docker API container so it picks up the new MONGO_URL
Write-Host "Restarting Docker containers..."
docker compose -f "$PSScriptRoot\..\..\docker-compose.yml" -f "$PSScriptRoot\..\..\docker-compose.dev.yml" --env-file "$PSScriptRoot\..\..\.env.local" up -d api
Write-Host "Done. API container restarted with new MongoDB URL."
