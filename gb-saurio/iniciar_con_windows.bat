@echo off
REM Opcional: hace que GB Saurio arranque solo al prender la laptop (y se actualice al arrancar).
set "DESTINO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\GB Saurio.bat"
> "%DESTINO%" echo @echo off
>> "%DESTINO%" echo start "" /min cmd /c "%~dp0iniciar.bat"
echo Listo. GB Saurio arrancara con Windows. Para quitarlo borra:
echo %DESTINO%
pause
