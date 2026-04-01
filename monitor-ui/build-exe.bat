@echo off
setlocal
title Compilando Monitor Lab EXE...
cd /d "%~dp0"

echo.
echo  =========================================================
echo   Compilador — Monitor de Comunicaciones v2.0
echo   Genera un EXE standalone para Windows (sin Node.js)
echo  =========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo  [ERROR] Node.js no esta instalado en esta PC de build.
    echo  Instala Node.js LTS desde https://nodejs.org/ y vuelve a ejecutar.
    echo  (Solo necesitas Node.js en esta PC para compilar, no en la PC destino)
    pause
    exit /b 1
)

echo  [1/3] Instalando dependencias...
call npm install
if errorlevel 1 (
    echo  [ERROR] Fallo npm install.
    pause
    exit /b 1
)

echo.
echo  [2/3] Instalando compilador pkg...
call npm install -g pkg
if errorlevel 1 (
    REM Intentar con npx si falla el global
    echo  (Usando npx pkg en su lugar...)
)

echo.
echo  [3/3] Compilando EXE... (puede tardar 2-5 minutos)
call npx pkg server.js --targets node18-win-x64 --output monitor-lab.exe --compress GZip
if errorlevel 1 (
    echo.
    echo  [ERROR] No se pudo compilar el EXE.
    echo  Intentando sin compresion...
    call npx pkg server.js --targets node18-win-x64 --output monitor-lab.exe
    if errorlevel 1 (
        echo  [ERROR] Fallo la compilacion. Revisa los mensajes de error arriba.
        pause
        exit /b 1
    )
)

echo.
echo  =========================================================
echo   [OK] EXE generado: monitor-lab.exe
echo  =========================================================
echo.
echo  Para usar en otra PC, copia estos archivos:
echo    - monitor-lab.exe
echo    - config.json
echo    - abrir-monitor.bat   (script de inicio)
echo.
echo  La carpeta "logs" se creara sola cuando el monitor corra.
echo.
pause
endlocal
