# Hosts Overrun for your friends, from this computer: builds the game, starts the server, and shares it on the
# internet at your fixed Tailscale Funnel link (https://<your-pc>.<your-tailnet>.ts.net). Friends just open the link.
#
# Run it with host.cmd (double-click). Stop it with Ctrl+C (or by closing the window). Only you need Tailscale:
# install it, sign in, and allow Funnel for this computer once (the first run tells you how if it isn't yet).

$ErrorActionPreference = 'Stop'
# Its own port, so it never clashes with the dev server (npm run dev uses 3000 and 5173).
$Port = 3300
Set-Location (Split-Path $PSScriptRoot -Parent)

function Stop-WithMessage([string]$Message) {
  Write-Host ''
  Write-Host $Message -ForegroundColor Red
  exit 1
}

$tailscale = Get-Command tailscale -ErrorAction SilentlyContinue
if (-not $tailscale) {
  # The Windows installer puts it here, but doesn't always add it to PATH for already-open windows.
  $default = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
  if (Test-Path $default) { $tailscale = $default } else { Stop-WithMessage 'Tailscale is not installed. Get it from https://tailscale.com/download, sign in, then run this again.' }
}
else {
  $tailscale = $tailscale.Source
}

# Signed in and connected?
$status = & $tailscale status --json 2>$null | ConvertFrom-Json
if (-not $status -or $status.BackendState -ne 'Running') {
  Stop-WithMessage 'Tailscale is not connected. Open Tailscale, sign in (or click Connect), then run this again.'
}
$url = 'https://' + $status.Self.DNSName.TrimEnd('.')

Write-Host 'Building the game (this takes a moment)...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Stop-WithMessage 'The build failed (see above), so nothing was started.' }

Write-Host ''
Write-Host "Sharing port $Port on your Tailscale Funnel link..." -ForegroundColor Cyan
& $tailscale funnel --bg $Port
if ($LASTEXITCODE -ne 0) {
  Stop-WithMessage 'Tailscale Funnel could not start. If it gave you a link above, open it to allow Funnel for this computer (once), then run this again.'
}

try { Set-Clipboard -Value $url } catch {}
Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host "  Overrun is live at:  $url" -ForegroundColor Green
Write-Host '  (copied to your clipboard - send it to your friends)' -ForegroundColor Green
Write-Host '  Keep this window open while you play. Ctrl+C to stop.' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host ''

try {
  $env:PORT = "$Port"
  npx tsx src/server/index.ts
}
finally {
  # Stop sharing (only this game's link; anything else you share with Tailscale stays as it is).
  & $tailscale funnel --https=443 off 2>$null | Out-Null
  Write-Host 'Stopped hosting. The link is offline until you host again.' -ForegroundColor Yellow
}
