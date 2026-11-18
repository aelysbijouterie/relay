@echo off
rem RELAYS - cree un raccourci "application" sur le Bureau (fenetre sans barre d'adresse).
rem Option : lance RELAYS automatiquement a l'ouverture de la session Windows (repondre O).
rem Utilise Chrome, sinon Edge. Aucun droit administrateur necessaire.
setlocal
set "URL=https://aelys-relays.vercel.app/kanban"
set "NAVIGATEUR="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAVIGATEUR=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAVIGATEUR if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "NAVIGATEUR=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined NAVIGATEUR if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "NAVIGATEUR=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined NAVIGATEUR if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAVIGATEUR=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined NAVIGATEUR if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "NAVIGATEUR=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined NAVIGATEUR (
  echo Ni Chrome ni Edge n'ont ete trouves sur cet ordinateur.
  pause
  exit /b 1
)
set /p AUTO=Ouvrir RELAYS automatiquement au demarrage de l'ordinateur ? (O/N) :
powershell -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell; $b='%NAVIGATEUR%'; $a='--app=%URL%'; $d=[Environment]::GetFolderPath('Desktop'); $s=$w.CreateShortcut($d+'\RELAYS.lnk'); $s.TargetPath=$b; $s.Arguments=$a; $s.IconLocation=$b+',0'; $s.Save(); if ('%AUTO%' -match '^[oOyY]') { $st=[Environment]::GetFolderPath('Startup'); $t=$w.CreateShortcut($st+'\RELAYS.lnk'); $t.TargetPath=$b; $t.Arguments=$a; $t.IconLocation=$b+',0'; $t.Save() }"
echo.
echo Raccourci RELAYS cree sur le Bureau.
if /i "%AUTO%"=="O" echo RELAYS s'ouvrira aussi tout seul au demarrage de l'ordinateur.
if /i "%AUTO%"=="Y" echo RELAYS s'ouvrira aussi tout seul au demarrage de l'ordinateur.
pause
