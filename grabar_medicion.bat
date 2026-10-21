@echo off
title Estacion de niebla - grabando medicion
cd /d "%~dp0"
echo Conecta el Arduino y cierra el Monitor Serie del Arduino IDE.
echo Para terminar: desconecta el USB (el Excel se guarda solo en excel\)
python registro_estacion.py
pause
