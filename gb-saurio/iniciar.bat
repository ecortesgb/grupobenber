@echo off
REM Abre GB Saurio sin ventana negra de consola.
REM Antes baja la version mas nueva de GitHub (si no hay internet, abre la que ya tienes).
cd /d "%~dp0"
git pull --ff-only -q >nul 2>&1
start "" pyw -3 saurio.py
