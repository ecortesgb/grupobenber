@echo off
REM Opcional: habilita grabar y transcribir reuniones en tu laptop.
REM La primera transcripcion descarga el modelo de voz (~500 MB) una sola vez.
cd /d "%~dp0"
py -3 -m pip install --upgrade -r requirements-reuniones.txt
pause
