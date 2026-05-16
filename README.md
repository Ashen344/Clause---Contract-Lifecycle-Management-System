# CLAUSE — AI-Powered Contract Lifecycle Management

CLAUSE is a full-stack Contract Lifecycle Management (CLM) platform with AI-assisted contract drafting, approval workflows, document editing, and analytics.

---

## Architecture

```
clause-clm/
├── frontend/        React 19 + TypeScript + Tailwind (Vite)
├── backend/         FastAPI + PyMongo (Python 3.11)
├── agents/          AI microservice — Gemini + Claude + Ollama
├── ingestion/       Knowledge base ingestion worker (Elasticsearch)
├── nginx/           Reverse proxy + SSL termination
├── eval/            Evaluation suite for AI quality
└── docker-compose.yml
```

**Traffic flow:**
```
Browser → nginx (443) → FastAPI backend (8000) → MongoDB
                     ↘ AI agents service (8000 internal)
                     ↘ Collabora/WOPI (9980 internal)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, shadcn/ui, Clerk Auth |
| Backend | FastAPI, PyMongo, Pydantic v2, Python 3.11 |
| AI Agents | Gemini 2.5, Claude Sonnet, Ollama (local GPU) |
| Database | MongoDB 7 |
| Search | Elasticsearch 8.12 (vector search, 3072-dim) |
| Queue | Redis + RQ |
| Document Editing | Collabora Online (LibreOffice via WOPI) |
| Reverse Proxy | nginx 1.27 (SSL, rate limiting, gzip) |
| Auth | Clerk (JWT) |
| Containers | Docker Compose |

---

## Prerequisites

Before you begin, make sure you have the following installed:

- **WSL2** (Windows Subsystem for Linux) with Ubuntu 22.04+
- **Docker Desktop** with WSL2 backend enabled, or Docker Engine inside WSL
- **Node.js 20+** and **npm** (for building the frontend)
- **Git**
- **openssl** (for generating SSL certificates)

API accounts needed:

- [Clerk](https://clerk.com) — authentication (free tier works)
- [Google AI Studio](https://aistudio.google.com) — Gemini API key
- [Anthropic](https://console.anthropic.com) — Claude API key
- Google Cloud project with Calendar API + Gmail SMTP (optional — for calendar/email features)

---

## Setup Guide

### Step 1 — Clone the Repository

```bash
git clone https://github.com/YourUsername/clause-clm.git
cd clause-clm
```

---

### Step 2 — Fix docker-compose.yml Paths

The `docker-compose.yml` references relative paths that match the repo structure.  
Open `docker-compose.yml` and update the three `build.context` lines to match the repo:

| Service | Original context | Change to |
|---|---|---|
| nginx | `../cluasue` | `.` |
| backend | `../cluasue/Backend` | `./backend` |
| worker | `./injest` | `./ingestion` |
| agents | `./agents` | `./agents` *(no change)* |

Also update the secrets section at the bottom:

```yaml
secrets:
  gemini_api_key:
    file: ./ingestion/secrets/gemini_api_key.txt
  elastic_password:
    file: ./ingestion/secrets/elastic_password.txt
  anthropic_api_key:
    file: ./ingestion/secrets/anthropic_api_key.txt
```

Also update the nginx Dockerfile (`nginx/Dockerfile`) — change:
```dockerfile
COPY Front/dist /var/www/clause
```
to:
```dockerfile
COPY frontend/dist /var/www/clause
```

---

### Step 3 — Build the Frontend

The nginx container serves the pre-built React app, so you must build it first.

```bash
cd frontend
npm install
npm run build
cd ..
```

This creates a `frontend/dist/` folder that nginx copies during its Docker build.

---

### Step 4 — Create the Environment File

Create a `.env` file in the project root (same folder as `docker-compose.yml`):

```env
# ── Database ──────────────────────────────────────────────────────────
DATABASE_NAME=clause_db

# ── Clerk Authentication ───────────────────────────────────────────────
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
CLERK_ISSUER=https://your-clerk-domain.clerk.accounts.dev
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx

# ── Backend ────────────────────────────────────────────────────────────
SECRET_KEY=any-long-random-string-here
VITE_API_BASE_URL=https://localhost

# ── Google OAuth (Calendar + Gmail) ───────────────────────────────────
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://localhost/api/calendar/oauth2callback

# ── SMTP Email (Gmail) ─────────────────────────────────────────────────
SMTP_EMAIL=your-gmail@gmail.com
SMTP_PASSWORD=your-gmail-app-password

# ── Elasticsearch ──────────────────────────────────────────────────────
ELASTIC_PASSWORD=your_elastic_password_here
INDEX_NAME=clm_knowledge_base

# ── AI Agents — Gemini ────────────────────────────────────────────────
GEMINI_MODEL=gemini-2.5-flash-preview-05-20
GEMINI_MODEL_LITE=gemini-2.5-flash-lite-preview-06-17
GEMINI_MODEL_HEAVY=gemini-2.5-pro-preview-06-05
GEMINI_RPM=15
GEMINI_RPD=1500
CORS_ORIGINS=https://localhost

# ── AI Agents — Anthropic ─────────────────────────────────────────────
ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_ENABLED=true

# ── AI Agents — Ollama (local GPU) ────────────────────────────────────
OLLAMA_MODEL=llama3.2
LOCAL_MODEL_ENABLED=false

# ── Collabora Online ───────────────────────────────────────────────────
COLLABORA_ADMIN_PASSWORD=changeme
```

> **Where to find these values:**
> - `CLERK_SECRET_KEY` / `CLERK_ISSUER` / `VITE_CLERK_PUBLISHABLE_KEY` → Clerk Dashboard → API Keys
> - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` → Google Cloud Console → APIs & Services → Credentials
> - `SMTP_PASSWORD` → Google Account → Security → App Passwords (requires 2FA enabled)
> - `SECRET_KEY` → generate with: `openssl rand -hex 32`
> - `ELASTIC_PASSWORD` → set this to any strong password you choose

---

### Step 5 — Create the Secrets Files

The Docker Compose secrets mechanism reads API keys from plain text files.  
Create the secrets folder and files:

```bash
mkdir -p ingestion/secrets

# Gemini API key (from Google AI Studio)
echo "your-gemini-api-key-here" > ingestion/secrets/gemini_api_key.txt

# Must match ELASTIC_PASSWORD in your .env
echo "your_elastic_password_here" > ingestion/secrets/elastic_password.txt

# Anthropic API key (from console.anthropic.com)
echo "your-anthropic-api-key-here" > ingestion/secrets/anthropic_api_key.txt
```

> These files must **never** be committed to git. They are already listed in `.gitignore`.

---

### Step 6 — Generate SSL Certificates

nginx requires SSL certificates. For local deployment, generate self-signed ones:

```bash
mkdir -p nginx/certs

openssl req -x509 -newkey rsa:4096 \
  -keyout nginx/certs/server.key \
  -out nginx/certs/server.crt \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

For a production server with a real domain, use [Let's Encrypt / Certbot](https://certbot.eff.org) instead and place `fullchain.pem` → `server.crt` and `privkey.pem` → `server.key`.

---

### Step 7 — Build and Start the Application

```bash
# Build all Docker images (takes 5–10 minutes first time)
docker compose build

# Start all services in the background
docker compose up -d

# Watch the logs to confirm everything started cleanly
docker compose logs -f
```

Expected healthy services after ~2 minutes:

```
✔ mongo          healthy
✔ redis          healthy
✔ elasticsearch  healthy
✔ ollama         healthy
✔ clm_backend    healthy
✔ clm_agents     running
✔ clm_worker     running
✔ clm_code       running
✔ clm_nginx      running
```

---

## Accessing the Application

| URL | What it opens |
|---|---|
| `https://localhost` | Main application (accept the self-signed cert warning) |
| `https://localhost/api/docs` | Backend API docs (Swagger UI) |

> Your browser will warn about the self-signed certificate. Click **Advanced → Proceed to localhost** to continue.

---

## Common Commands

```bash
# Stop the entire application
docker compose down

# Restart a single service after code changes
docker compose build backend && docker compose up -d backend

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f agents

# Check status of all services
docker compose ps

# Rebuild everything from scratch (wipes nothing)
docker compose build --no-cache
docker compose up -d

# Wipe all data volumes (DESTRUCTIVE — deletes all contracts and database)
docker compose down -v
```

---

## Ingesting Knowledge Base Documents

The ingestion worker loads contract documents into Elasticsearch for AI-powered search.

```bash
# Ingest a single document
docker exec clm_worker python ingest.py --file /path/to/contract.pdf --doc-type SLA --customer Acme

# Supported doc types: SLA, NDA, MSA, SOW, employment, vendor, licensing, partnership
# Supported formats: PDF, DOCX, TXT, CSV, XLSX
```

---

## Seeding Initial Data (Optional)

The backend includes seed scripts to populate sample workflows and templates:

```bash
# Seed workflow templates
docker exec clm_backend python seed_templates.py

# Or run directly
docker exec -it clm_backend python seed.py
```

---

## Setting Up the First Admin User

1. Open `https://localhost` and sign up for an account through Clerk
2. Connect to MongoDB and update your user's role:

```bash
docker exec -it mongo mongosh
use clause_db
db.users.updateOne({ email: "your-email@example.com" }, { $set: { role: "admin" } })
exit
```

---

## Environment Variables Reference

| Variable | Service | Description |
|---|---|---|
| `DATABASE_NAME` | backend | MongoDB database name |
| `CLERK_SECRET_KEY` | backend | Clerk server-side secret key |
| `CLERK_ISSUER` | backend | Clerk JWT issuer URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | nginx/frontend | Clerk public key for the browser |
| `VITE_API_BASE_URL` | nginx/frontend | Base URL the frontend calls (e.g. `https://localhost`) |
| `SECRET_KEY` | backend | Random secret for internal signing |
| `GOOGLE_CLIENT_ID` | backend | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | backend | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | backend | OAuth callback URL |
| `SMTP_EMAIL` | backend | Gmail address for notifications |
| `SMTP_PASSWORD` | backend | Gmail app password |
| `ELASTIC_PASSWORD` | elasticsearch / agents / worker | Elasticsearch password |
| `INDEX_NAME` | agents / worker | Elasticsearch index name |
| `GEMINI_MODEL` | agents | Primary Gemini model ID |
| `GEMINI_MODEL_LITE` | agents | Fast/cheap Gemini model ID |
| `GEMINI_MODEL_HEAVY` | agents | Most capable Gemini model ID |
| `ANTHROPIC_MODEL` | agents | Claude model ID |
| `ANTHROPIC_ENABLED` | agents | Set `true` to enable Claude |
| `OLLAMA_MODEL` | agents | Local Ollama model name |
| `LOCAL_MODEL_ENABLED` | agents | Set `true` to enable Ollama |
| `COLLABORA_ADMIN_PASSWORD` | collabora | Admin password for Collabora |

---

## Troubleshooting

**Backend keeps restarting**
```bash
docker compose logs backend --tail=50
```
Usually a missing environment variable or MongoDB connection issue.

**Elasticsearch fails to start**
```bash
# Elasticsearch needs enough virtual memory
sudo sysctl -w vm.max_map_count=262144
# Make permanent:
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
```

**SSL certificate error in browser**
The self-signed cert triggers a browser warning. Click **Advanced → Proceed to localhost**. This is expected for local development.

**Clerk auth not working**
Make sure `CLERK_ISSUER` ends with no trailing slash and matches exactly what's shown in your Clerk Dashboard under **API Keys → Advanced**.

**Frontend shows blank page**
The `frontend/dist/` folder must exist before running `docker compose build`. Run `npm install && npm run build` inside the `frontend/` directory first.

---

## License

This project was developed as a university final-year project.
