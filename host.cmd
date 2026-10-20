@echo off
rem Host Overrun for your friends at your fixed Tailscale Funnel link (see scripts\host.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\host.ps1"
pause
