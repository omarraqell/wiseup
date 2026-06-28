@echo off
cd /d "%~dp0"
for /f "usebackq tokens=1,* delims==" %%a in (".env") do set %%a=%%b
set WISEUP_EMBED_BACKEND=openai
echo Starting WISEUP agentic assistant on http://127.0.0.1:8000
python -m uvicorn api:app --host 127.0.0.1 --port 8000
pause
