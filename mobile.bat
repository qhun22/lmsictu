@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo  LMSICTU - MOBILE TEST LAUNCHER
echo ============================================================
echo.

REM Lấy IPv4 LAN (bỏ qua 127.0.0.1)
set "LAN_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i /c:"IPv4"') do (
    for /f "tokens=* delims= " %%i in ("%%a") do (
        set "ip=%%i"
        if not "!ip!"=="127.0.0.1" if not "!ip!"=="" if not defined LAN_IP set "LAN_IP=!ip!"
    )
)

if defined LAN_IP (
    echo [OK] IP LAN cua may: !LAN_IP!
    echo.
    echo     Mobile/Thiet bi khac truy cap:
    echo.
    echo         http://!LAN_IP!:8000/
    echo.
    echo     Hoac dung host:
    for /f "tokens=2 delims=:" %%h in ('hostname') do echo         http://%%h:8000/
    echo.
) else (
    echo [WARNING] Khong the lay IP LAN. Hay dam bao da ket noi WiFi/Ethernet.
)

echo ============================================================
echo  Dang khoi dong Django (0.0.0.0:8000)...
echo  Nhan Ctrl+C de dung server.
echo ============================================================
echo.

REM Kiem tra port 8000 co bi chiem khong
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo [WARNING] Port 8000 dang bi chiem. Co the server khac dang chay.
    echo           Hay doi port hoac tat process dang dung port 8000.
    echo.
)

"%~dp0.venv\Scripts\python.exe" manage.py runserver 0.0.0.0:8000
pause