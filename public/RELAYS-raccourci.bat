@echo off
rem RELAYS - cree le raccourci "application" sur le Bureau ET l'ouverture automatique au demarrage de Windows.
rem RELAYS s'ouvre dans sa propre fenetre, sans barre d'adresse. Chrome est utilise, sinon Edge.
rem Aucun droit administrateur necessaire. Pour annuler : supprimer RELAYS.lnk du Bureau et du dossier Demarrage (touche Windows + R, taper shell:startup).
setlocal
set "URL=https://aelys-relays.vercel.app/"
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
powershell -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell; $b='%NAVIGATEUR%'; $a='--app=%URL%'; foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Startup'))) { $s=$w.CreateShortcut($d+'\RELAYS.lnk'); $s.TargetPath=$b; $s.Arguments=$a; $s.IconLocation=$b+',0'; $s.Save() }"
echo.
echo RELAYS est installe :
echo  - un raccourci RELAYS est sur le Bureau
echo  - RELAYS s'ouvrira tout seul au demarrage de l'ordinateur
echo Lancement de RELAYS...
start "" "%NAVIGATEUR%" --app=%URL%
timeout /t 4 >nul
