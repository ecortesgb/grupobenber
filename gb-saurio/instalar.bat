@echo off
REM Se corre UNA sola vez: instala lo necesario y crea config.json.
cd /d "%~dp0"
py -3 -m pip install --upgrade -r requirements.txt
if not exist config.json copy config.ejemplo.json config.json >nul
echo.
echo Abre config.json y pega tu API key de Anthropic en "api_key".
echo Despues da doble clic en iniciar.bat
notepad config.json
pause
