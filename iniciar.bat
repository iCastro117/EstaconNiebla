@echo off
chcp 65001 >nul
title Estación de Niebla - Dashboard
cd /d "%~dp0"

echo.
echo ESTACIÓN DE NIEBLA - DASHBOARD
echo ========================================
echo.

python servidor.py
pause
