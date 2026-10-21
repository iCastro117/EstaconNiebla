@echo off
title Monitor de Datos - Panel 3D
:loop
cls
echo ====== DATOS ACTUALIZADOS ======
echo.
type panel_data.json
echo.
echo ====== Proxima revision en 5 segundos...
timeout /t 5 /nobreak
goto loop
