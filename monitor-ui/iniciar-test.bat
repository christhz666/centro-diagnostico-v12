@echo off
title Monitor Lab — TEST
cd /d "%~dp0"
if not exist "node_modules" npm install
echo Iniciando en MODO TEST (datos simulados)...
echo Abre http://localhost:3000 en tu navegador
echo.
node server.js --test
pause
