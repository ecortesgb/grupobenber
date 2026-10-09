@echo off
REM Opcional: hace que GB Saurio arranque solo al prender la laptop.
set "DESTINO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\GB Saurio.bat"
> "%DESTINO%" echo @echo off
>> "%DESTINO%" echo cd /d "%~dp0"
>> "%DESTINO%" echo start "" pyw -3 saurio.py
echo Listo. GB Saurio arrancara con Windows. Para quitarlo borra:
echo %DESTINO%
pause
