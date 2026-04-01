@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado en esta PC de build.
  echo Instala Node.js LTS desde https://nodejs.org/ y vuelve a ejecutar.
  pause
  exit /b 1
)

echo [1/2] Instalando dependencias (incluye pkg)...
call npm install
if errorlevel 1 (
  echo [ERROR] Fallo npm install.
  pause
  exit /b 1
)

echo [2/2] Generando EXE...
call npx pkg monitor.js --targets node18-win-x64 --output monitor-comunicaciones.exe
if errorlevel 1 (
  echo [ERROR] No se pudo generar el EXE.
  pause
  exit /b 1
)

echo.
echo [OK] EXE generado: monitor-comunicaciones.exe
echo Copia ese archivo junto a config.json en la PC destino y ejecuta iniciar-monitor-exe.bat
pause
endlocal
