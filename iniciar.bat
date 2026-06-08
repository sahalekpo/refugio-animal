@echo off
echo ========================================
echo  Refugio de Animales - Servidor local
echo ========================================
echo.

set MYSQL="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"

if exist C:\xampp\php\php.exe (
    set PHP=C:\xampp\php\php.exe
    echo Usando PHP de XAMPP...
) else if exist C:\laragon\bin\php\php-8.3.12-Win32-vs16-x64\php.exe (
    set PHP=C:\laragon\bin\php\php-8.3.12-Win32-vs16-x64\php.exe
    echo Usando PHP de Laragon...
) else (
    where php >nul 2>&1
    if %errorlevel%==0 (
        set PHP=php
        echo Usando PHP del sistema...
    ) else (
        echo ERROR: No se encontro PHP instalado.
        echo Instale XAMPP desde https://www.apachefriends.org/
        echo y copie este proyecto a C:\xampp\htdocs\
        pause
        exit /b 1
    )
)

echo.
echo Iniciando servidor en http://localhost:8080
echo Presione Ctrl+C para detener.
echo.

cd /d "%~dp0public"
%PHP% -S localhost:8080
