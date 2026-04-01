@echo off
cd /d "%~dp0"

if not exist "monitor-comunicaciones.exe" (
  echo [ERROR] No existe monitor-comunicaciones.exe en esta carpeta.
  echo Ejecuta primero build-exe.bat en una PC de build que tenga Node.js.
  echo Luego copia monitor-comunicaciones.exe y config.json aqui.
  pause
  exit /b 1
)

echo Iniciando monitor de comunicaciones...
start "" "monitor-comunicaciones.exe"
