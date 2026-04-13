@echo off
REM If 0per8r was removed but WinHTTP still points at 127.0.0.1:3128, run this.
REM Right-click -> Run as administrator if the commands fail.
echo Resetting WinHTTP proxy...
netsh winhttp reset proxy
if errorlevel 1 (
  echo.
  echo Failed. Try: right-click this file -^> Run as administrator.
  pause
  exit /b 1
)
ipconfig /flushdns
echo Done. Close this window and try your browser again.
pause
