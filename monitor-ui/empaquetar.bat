@echo off
setlocal
title Empaquetando Monitor Lab para distribucion...
cd /d "%~dp0"

echo.
echo  =========================================================
echo   Empaquetador — Monitor de Comunicaciones v2.0
echo   Genera carpeta lista para copiar a otra PC
echo   SIN necesitar Node.js instalado
echo  =========================================================
echo.

REM Verificar que existe el exe
if not exist "monitor-lab.exe" (
    echo  [ERROR] No se encontro monitor-lab.exe
    echo  Ejecuta primero build-exe.bat para compilar el programa.
    pause
    exit /b 1
)

REM Crear carpeta de distribucion
set DIST=monitor-lab-dist
if exist "%DIST%" rmdir /s /q "%DIST%"
mkdir "%DIST%"

echo  [1/5] Copiando ejecutable...
copy /y "monitor-lab.exe" "%DIST%\" >nul

echo  [2/5] Copiando configuracion...
copy /y "config.json" "%DIST%\" >nul
copy /y "abrir-monitor.bat" "%DIST%\" >nul

echo  [3/5] Copiando binarios nativos de serialport (necesarios para puertos COM)...
REM Crear estructura de carpetas para los binarios .node
mkdir "%DIST%\node_modules\@serialport\bindings-cpp" 2>nul

REM Copiar todos los archivos .node (binarios nativos compilados)
for /r "node_modules\@serialport" %%f in (*.node) do (
    REM Obtener la ruta relativa
    set "relpath=%%f"
    setlocal enabledelayedexpansion
    set "relpath=!relpath:%CD%\node_modules\@serialport\=!"
    echo    Copiando: %%~nxf
    REM Copiar manteniendo estructura de directorios
    xcopy /y /q "%%f" "%DIST%\node_modules\@serialport\%%~dpnxf" 2>nul
    endlocal
)

REM Metodo alternativo mas confiable - copiar toda la carpeta de bindings
xcopy /y /s /q "node_modules\@serialport\bindings-cpp\prebuilds" "%DIST%\node_modules\@serialport\bindings-cpp\prebuilds\" >nul 2>nul
xcopy /y /s /q "node_modules\@serialport\bindings-cpp\build" "%DIST%\node_modules\@serialport\bindings-cpp\build\" >nul 2>nul

echo  [4/5] Copiando modulos JS de serialport...
xcopy /y /s /q "node_modules\serialport" "%DIST%\node_modules\serialport\" >nul 2>nul
xcopy /y /s /q "node_modules\@serialport" "%DIST%\node_modules\@serialport\" >nul 2>nul

echo  [5/5] Creando instrucciones...
(
echo Monitor de Comunicaciones Lab v2.0
echo =====================================
echo.
echo INSTRUCCIONES:
echo 1. Copia TODA esta carpeta a la PC destino
echo 2. Doble clic en "abrir-monitor.bat"
echo 3. Abre tu navegador en http://localhost:3000
echo.
echo Si te pregunta sobre firewall de Windows: permite el acceso.
echo.
echo Para cambiar configuracion de equipos:
echo  - Edita config.json con el Bloc de notas
echo  - O abre la interfaz web y usa la seccion Configuracion
) > "%DIST%\INSTRUCCIONES.txt"

echo.
echo  =========================================================
echo   [OK] Carpeta generada: %DIST%\
echo  =========================================================
echo.
echo  Contenido de la carpeta a copiar:
dir /b "%DIST%"
echo.
echo  Copia la carpeta "%DIST%" completa a la otra PC y haz
echo  doble clic en "abrir-monitor.bat"
echo.
pause
endlocal
