@echo off
REM ============================================================
REM  WISEUP Catalog Assistant - launch backend + frontend
REM  Open http://127.0.0.1:8000 after it starts.
REM ============================================================

REM --- 1) Your OpenAI key (paste a fresh key here after rotating) ---
if "%OPENAI_API_KEY%"=="" set OPENAI_API_KEY=PASTE_YOUR_OPENAI_KEY_HERE

REM --- 2) Use the multilingual (Arabic + English) OpenAI index ---
set WISEUP_EMBED_BACKEND=openai

if "%OPENAI_API_KEY%"=="PASTE_YOUR_OPENAI_KEY_HERE" (
  echo.
  echo  !! Set your OpenAI key first: edit start.bat and replace PASTE_YOUR_OPENAI_KEY_HERE
  echo.
  pause
  exit /b 1
)

cd /d "%~dp0"
echo Starting WISEUP assistant on http://127.0.0.1:8000  (Ctrl+C to stop)
python -m uvicorn api:app --host 127.0.0.1 --port 8000
pause
