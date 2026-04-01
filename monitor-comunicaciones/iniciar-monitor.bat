@echo off
setlocal
cd /d "%~dp0"

echo ================================
echo   Monitor de Comunicaciones
echo ================================

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado o no esta en PATH.
  echo Instala Node.js LTS desde https://nodejs.org/
pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Instalando dependencias por primera vez...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Fallo la instalacion de dependencias.
    pause
    exit /b 1
  )
)

echo [INFO] Iniciando monitor...
node monitor.js

if errorlevel 1 (
  echo.
  echo [ERROR] El monitor finalizo con error.
)

echo.
echo [INFO] Proceso finalizado.
pause
endlocal