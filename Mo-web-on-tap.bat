@echo off
rem Renix: build the Astro site if needed, start the local server and open it in Microsoft Edge
rem (Edge has the best Japanese text-to-speech voice). Progress is saved for http://localhost:4321.
setlocal
cd /d "%~dp0"
set "URL=http://localhost:4321/"

where node >nul 2>nul
if errorlevel 1 (
  echo Can cai Node.js ^(https://nodejs.org^) de chay trang web.
  pause
  exit /b 1
)

rem server already running? just open the browser
netstat -ano | findstr /r /c:":4321 .*LISTENING" >nul
if not errorlevel 1 goto open

if not exist "node_modules\astro" (
  echo Dang cai thu vien lan dau...
  call npm install || goto fail
)
if not exist "dist\index.html" (
  echo Dang dung trang web...
  call npm run build || goto fail
)

start "Renix server" /min cmd /c "npm run preview"
rem wait until the server answers (max ~40 s)
for /l %%i in (1,1,40) do (
  netstat -ano | findstr /r /c:":4321 .*LISTENING" >nul && goto open
  ping -n 2 127.0.0.1 >nul
)

:open
where msedge >nul 2>nul
if %errorlevel%==0 (
  start "" msedge "%URL%"
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%URL%"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%URL%"
) else (
  start "" "%URL%"
)
exit /b 0

:fail
echo Co loi khi chuan bi trang web.
pause
exit /b 1
