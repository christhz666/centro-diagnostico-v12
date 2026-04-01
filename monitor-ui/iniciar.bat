@echo off
title Monitor de Comunicaciones — Lab v2.0
color 0B
echo.
echo  =========================================================
echo   Monitor de Comunicaciones — Centro Diagnostico v2.0
echo   SOLO LECTURA - No interfiere con otros programas
echo  =========================================================
echo.

REM Verificar que Node.js este instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Node.js no esta instalado.
    echo  Descarga Node.js desde: https://nodejs.org
    echo  Necesitas la version 16 o superior (LTS recomendado).
    echo.
    pause
    exit /b 1
)

REM Ir al directorio del script
cd /d "%~dp0"

REM Instalar dependencias si no existen
if not exist "node_modules" (
    echo  [INFO] Instalando dependencias por primera vez...
    echo  (Esto puede tardar 1-2 minutos)
    echo.
    npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo  [ERROR] No se pudieron instalar las dependencias.
        echo  Verifica tu conexion a internet e intenta de nuevo.
        pause
        exit /b 1
    )
)

echo  [OK] Iniciando monitor...
echo  [OK] Interfaz web en: http://localhost:3000
echo.
echo  Abre tu navegador en: http://localhost:3000
echo  Presiona Ctrl+C para detener el monitor.
echo.

REM Iniciar el servidor
node server.js

echo.
echo  Monitor detenido.
pause
