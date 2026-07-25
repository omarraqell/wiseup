# 🛠️ WiseUp — Industrial Tools Catalog & AI Assistant

> A full-stack e-commerce platform for industrial tools with an AI-powered sales assistant, bilingual support (Arabic/English), and role-based authentication.

---

## 📑 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Environment Variables](#2-environment-variables)
  - [3. Option A — Run with Docker (Recommended)](#3-option-a--run-with-docker-recommended)
  - [4. Option B — Run Locally (Manual Setup)](#4-option-b--run-locally-manual-setup)
- [Available Scripts](#available-scripts)
- [API Endpoints](#api-endpoints)
- [Running Tests](#running-tests)
- [Team](#team)

---

## Architecture Overview

WiseUp is composed of **three services**:

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│    Frontend      │ ───► │    Backend API   │ ───► │   AI Service     │
│  (Next.js 16)    │      │  (Express + TS)  │      │ (FastAPI/Python) │
│  Port 3000       │      │  Port 4000       │      │  Port 8000       │
└──────────────────┘      └──────────────────┘      └──────────────────┘
                                  │
                                  ▼
                          ┌──────────────────┐
                          │   PostgreSQL     │
                          │   (Supabase)     │
                          └──────────────────┘
```

| Service        | Description                                                                   |
| -------------- | ----------------------------------------------------------------------------- |
| **Frontend**   | Next.js 16 storefront with Tailwind CSS, RTL/LTR support, and Supabase Auth   |
| **Backend**    | Express 5 REST API with Prisma ORM, Supabase Auth middleware, and email leads  |
| **AI Service** | FastAPI microservice powered by LangGraph, OpenAI GPT-4o, and ChromaDB RAG    |

---

## Tech Stack

| Layer      | Technology                                                      |
| ---------- | --------------------------------------------------------------- |
| Frontend   | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase SSR |
| Backend    | Node.js 20, Express 5, TypeScript, Prisma 6, Zod, Nodemailer   |
| AI Service | Python 3.12, FastAPI, LangGraph, LangChain, ChromaDB, OpenAI   |
| Database   | PostgreSQL (Supabase hosted)                                    |
| Auth       | Supabase Auth (Google OAuth + Email)                            |
| Search     | Tavily (web), ChromaDB + BM25 (hybrid RAG)                     |
| DevOps     | Docker, Docker Compose                                          |

---

## Prerequisites

Make sure you have the following installed:

- **Node.js** ≥ 20 — [Download](https://nodejs.org/)
- **Python** ≥ 3.12 — [Download](https://www.python.org/)
- **Docker & Docker Compose** (if using Docker) — [Download](https://www.docker.com/)
- **Git** — [Download](https://git-scm.com/)

You will also need API keys for:

- [OpenAI](https://platform.openai.com/) — Chat + Embeddings
- [Tavily](https://tavily.com/) — Web search tool
- [Supabase](https://supabase.com/) — Database + Auth
- Gmail App Password — for lead email notifications (optional)
- [LangSmith](https://smith.langchain.com/) — Observability tracing (optional)

---

## Project Structure

```
WiseUp/
├── frontend/               # Next.js 16 storefront
│   ├── src/
│   │   ├── app/            # App router pages
│   │   ├── components/     # React components
│   │   ├── context/        # Language context (RTL/LTR)
│   │   └── lib/            # API helpers, Supabase client
│   ├── public/             # Static assets (hero image, category images)
│   ├── Dockerfile
│   └── package.json
│
├── backend/                # Express REST API
│   ├── src/
│   │   ├── index.ts        # Server entry point
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation middleware
│   │   └── utils/          # Helper utilities
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   ├── seed.ts         # Seed script (categories + products)
│   │   └── migrations/     # Migration history
│   ├── Dockerfile
│   └── package.json
│
├── ai-service/             # FastAPI AI microservice
│   ├── api.py              # FastAPI endpoints (/ask, /reset, /health)
│   ├── agent_graph.py      # LangGraph agent definition
│   ├── rag.py              # Hybrid RAG retriever (ChromaDB + BM25)
│   ├── catalog.py          # Product catalog loader
│   ├── tools.py            # Agent tools (search, email, retrieve)
│   ├── build_index.py      # ChromaDB index builder
│   ├── requirements.txt
│   └── Dockerfile
│
├── data/                   # Source data files
│   ├── categories.json     # Product categories
│   └── wiseup_prices.xlsx  # Product pricing spreadsheet
│
├── scripts/                # Data enrichment scripts
├── tests/                  # Python test suite
├── images/                 # Product images
├── products.json           # Processed product catalog
├── docker-compose.yml      # Multi-service Docker config
├── .env.example            # Environment variable template
├── start.bat               # Windows quick-start (AI service only)
└── requirements.txt        # Root-level Python dependencies
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/omarraqell/wiseup.git
cd wiseup
```

### 2. Environment Variables

Copy the example env files and fill in your credentials:

**Root `.env`** (AI Service + Docker Compose):

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
# Required
OPENAI_API_KEY=sk-proj-...
TAVILY_API_KEY=tvly-...
WISEUP_EMBED_BACKEND=openai

# Gmail (for lead emails)
GMAIL_APP_PASSWORD=...

# LangSmith (optional)
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_...
LANGSMITH_PROJECT=wiseup

# Supabase
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Backend `.env`** (`backend/.env`):

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PORT=4000
AI_SERVICE_URL=http://localhost:8000
GMAIL_APP_PASSWORD=...
```

---

### 3. Option A — Run with Docker (Recommended)

The easiest way to run the full stack:

```bash
docker compose up --build
```

This starts all three services:

| Service  | URL                       |
| -------- | ------------------------- |
| Frontend | http://localhost:3100      |
| Backend  | http://localhost:4000      |
| AI       | http://localhost:8000      |

To stop:

```bash
docker compose down
```

---

### 4. Option B — Run Locally (Manual Setup)

You need to run **three terminals** — one for each service.

#### Terminal 1 — AI Service (Python)

```bash
# Create and activate a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install -r ai-service/requirements.txt

# Build the ChromaDB search index (first time only)
cd ai-service
python build_index.py

# Start the AI service
uvicorn api:app --host 127.0.0.1 --port 8000
```

> **Windows shortcut:** You can also run `start.bat` from the project root to start just the AI service.

Verify it's running:

```bash
curl http://localhost:8000/health
# → {"status":"ok"}
```

#### Terminal 2 — Backend API (Node.js)

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database with products and categories
npm run db:seed

# Start the dev server
npm run dev
```

The backend will be running at **http://localhost:4000**.

#### Terminal 3 — Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be running at **http://localhost:3000**.

---

## Available Scripts

### Backend (`backend/`)

| Command            | Description                         |
| ------------------ | ----------------------------------- |
| `npm run dev`      | Start dev server with hot reload    |
| `npm run build`    | Compile TypeScript to `dist/`       |
| `npm run start`    | Run compiled production build       |
| `npm run test`     | Run tests with Vitest               |
| `npm run db:generate` | Regenerate Prisma Client         |
| `npm run db:migrate`  | Run Prisma migrations            |
| `npm run db:push`     | Push schema to DB (no migration) |
| `npm run db:seed`     | Seed database with JSON data     |
| `npm run db:studio`   | Open Prisma Studio (GUI)         |

### Frontend (`frontend/`)

| Command          | Description                       |
| ---------------- | --------------------------------- |
| `npm run dev`    | Start Next.js dev server          |
| `npm run build`  | Build for production              |
| `npm run start`  | Start production server           |
| `npm run lint`   | Run ESLint                        |

### AI Service (root or `ai-service/`)

| Command                          | Description                          |
| -------------------------------- | ------------------------------------ |
| `python build_index.py`         | Build/rebuild the ChromaDB index     |
| `python ingest_excel.py`        | Ingest product data from Excel       |
| `uvicorn api:app --port 8000`   | Start the FastAPI AI service         |

---

## API Endpoints

### Backend REST API (Port 4000)

| Method | Endpoint            | Description                  |
| ------ | ------------------- | ---------------------------- |
| GET    | `/api/products`     | List products (with filters) |
| GET    | `/api/categories`   | List all categories          |
| GET    | `/api/products/:id` | Get product by ID            |
| POST   | `/api/leads`        | Submit a lead/inquiry        |

### AI Service (Port 8000)

| Method | Endpoint   | Description                        |
| ------ | ---------- | ---------------------------------- |
| GET    | `/health`  | Health check                       |
| POST   | `/ask`     | Ask the AI assistant a question    |
| POST   | `/reset`   | Reset a chat session               |

**Example — Ask the AI:**

```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "I need a set of pliers for electrical work", "session_id": "test-123"}'
```

---

## Running Tests

### Python Tests (AI Service)

```bash
# From project root with venv activated
pytest tests/ -v
```

### Backend Tests (Node.js)

```bash
cd backend
npm run test
```

---

## Team

Built by the **WiseUp** team — [github.com/omarraqell/wiseup](https://github.com/omarraqell/wiseup)
