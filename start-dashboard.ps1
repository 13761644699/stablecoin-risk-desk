$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Stop-Listeners {
  param([int]$Port)

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    $processId = [int]$connection.OwningProcess
    if ($processId -le 0) {
      continue
    }

    try {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    } catch {
      # The listener may already be gone.
    }
  }
}

function Wait-Http {
  param(
    [string]$Url,
    [int]$Seconds
  )

  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 | Out-Null
      return $true
    } catch {
      Start-Sleep -Milliseconds 700
    }
  }

  return $false
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Start-Process 'https://nodejs.org/'
  throw 'Node.js is not installed.'
}

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  npm install
}

Stop-Listeners -Port 8787
Stop-Listeners -Port 5173
Start-Sleep -Milliseconds 600

Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $root -WindowStyle Hidden
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm run client -- --port 5173' -WorkingDirectory $root -WindowStyle Hidden

$apiReady = Wait-Http -Url 'http://localhost:8787/api/health' -Seconds 45
$webReady = Wait-Http -Url 'http://localhost:5173/' -Seconds 45

Start-Process 'http://localhost:5173/'

if (-not ($apiReady -and $webReady)) {
  Write-Host 'Dashboard is still starting. If the page is blank, wait a few seconds and refresh.'
  Start-Sleep -Seconds 5
}
