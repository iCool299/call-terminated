@echo off
cd /d "%~dp0.."
powershell -ExecutionPolicy Bypass -File tools\release.ps1 -Message "Smoother enemy walk cycles: natural leg swing, stabilised frames" > tools\publish-walk.log 2>&1
type tools\publish-walk.log
