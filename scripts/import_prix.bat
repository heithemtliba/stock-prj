@echo off
echo ============================================================
echo   IMPORT PRIX REVIENT - Mabrouk Stock
echo ============================================================
echo.

REM Vérifier que le CSV existe
if not exist "..\data\articles_mabrouk.csv" (
    echo [ERREUR] Fichier introuvable : ..\data\articles_mabrouk.csv
    echo.
    echo Veuillez :
    echo 1. Exporter le CSV depuis Cegid BO
    echo 2. Le deposer dans : ..\data\articles_mabrouk.csv
    pause
    exit /b 1
)

echo [OK] Fichier CSV trouve
echo.

REM Appeler la route d'import
echo Envoi de la requete...
curl -X POST http://localhost:3002/import-articles-prix
echo.
echo.

echo ============================================================
echo   IMPORT TERMINE
echo ============================================================
pause