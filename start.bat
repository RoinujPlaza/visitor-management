@echo off
title VisitorPass Launcher
set "XAMPP=C:\xampp"
set "APP=%XAMPP%\htdocs\visitor-management"

if not exist "%APP%\index.html" (
  echo Copying app into XAMPP htdocs...
  xcopy /E /I /Y "%~dp0" "%APP%" >nul
)

tasklist /FI "IMAGENAME eq httpd.exe" 2>nul | find /I "httpd.exe" >nul
if errorlevel 1 (
  echo Starting Apache...
  start "" /D "%XAMPP%\apache\bin" "%XAMPP%\apache\bin\httpd.exe"
  timeout /t 2 >nul
) else (
  echo Apache is already running.
)

echo Opening http://localhost/visitor-management/
start "" http://localhost/visitor-management/
