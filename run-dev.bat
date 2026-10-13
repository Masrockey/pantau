@echo off
title Dev Runner (Laravel Dev + GBP Scraper)
echo ========================================================
echo   Menjalankan Laravel Dev dan GBP Scraper berbarengan...
echo ========================================================
echo.

start "Laravel Dev (composer run dev)" cmd /k "composer run dev"
start "GBP Scraper" cmd /k "node gbpscrap/dist/index.js"

echo Kedua proses telah dijalankan di jendela terminal terpisah.
echo Anda dapat menutup jendela masing-masing untuk menghentikan proses.
