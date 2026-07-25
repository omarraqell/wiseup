FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["sh", "-c", "if [ ! -d chroma_db_openai ] || [ -z \"$(ls -A chroma_db_openai 2>/dev/null)\" ]; then python build_index.py; fi && uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}"]
