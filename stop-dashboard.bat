@echo off
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173"') do taskkill /pid %%a /f >nul 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8787"') do taskkill /pid %%a /f >nul 2>nul
echo Dashboard services stopped.
pause

