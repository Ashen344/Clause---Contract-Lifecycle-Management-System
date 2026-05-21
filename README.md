 # Clause — AI-Powered Contract Lifecycle Management

Clause is a full-stack Contract Lifecycle Management (CLM) platform with AI-assisted drafting, multi-stage approval workflows, in-browser document editing, risk analysis, and an admin dashboard — all deployable with a single `docker compose up`.

---

## Table of Contents

1. Architecture (#architecture)
2. Tech Stack (#tech-stack)
3. Prerequisites (#prerequisites)
4. Setup Guide (#setup-guide)
5. First Admin User (#first-admin-user)
6. Seeding Sample Data (#seeding-sample-data)
7. Common Commands (#common-commands)
8. Environment Variables Reference (#environment-variables-reference)
9. Troubleshooting (#troubleshooting)

---

## Architecture

```
clause-clm/
├── frontend/         React 19 + TypeScript + Tailwind CSS (Vite)
├── backend/          FastAPI + PyMongo (Python 3.11)
├── agents/           AI microservice — Gemini · Claude · Ollama
├── ingestion/        Knowledge-base ingestion worker (Elasticsearch)
├── nginx/            Reverse proxy + SSL termination
├── eval/             AI evaluation / quality suite
└── docker-compose.yml
```

**Traffic flow:**
```
Browser → nginx (443) → FastAPI backend (8000) → MongoDB
                     ↘ AI agents service (8000 internal)
                     ↘ Collabora/WOPI (9980 internal)
```

All internal services communicate on a private Docker network. Only nginx is exposed to the host.

---

## Tech Stack

|        Layer      |                            Technology                               |
|-------------------|---------------------------------------------------------------------|
| Frontend          | React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui, Clerk Auth     |
| Backend           | FastAPI, PyMongo, Pydantic v2, Python 3.11                          |
| AI Agents         | Gemini 2.5, Claude Sonnet (Anthropic), Ollama (optional local GPU)  |
| Database          | MongoDB 7                                                           |
| Search / RAG      | Elasticsearch 8.12 (vector search, 3072-dim embeddings)             |
| Task Queue        | Redis + RQ                                                          |
| Document Editor   | Collabora Online (LibreOffice-in-browser via WOPI)                  |
| Reverse Proxy     | nginx 1.27 (SSL, rate limiting, gzip)                               |
| Authentication    | Clerk (JWT)                                                         |
| Containers        | Docker Compose                                                      |

---

## Prerequisites

**Software:**
- Windows with WSL2 (Ubuntu distro) — or native Linux/Mac
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with WSL2 backend on Windows) or Docker Engine on Linux/Mac
- [Node.js 20+](https://nodejs.org/) and npm (for the one-time frontend build)
- `openssl` (for generating local SSL certificates)
- `git`

**API accounts you will need:**
|                     Service                            |       Purpose       |      Free tier?    |
|--------------------------------------------------------|---------------------|--------------------|
| [Clerk](https://clerk.com)                             | User authentication | Yes                |
| [Google AI Studio](https://aistudio.google.com/apikey) | Gemini API key      | Yes (rate-limited) |
| [Anthropic Console](https://console.anthropic.com)     | Claude API key      | Pay-as-you-go      |
| Google Cloud (optional) | Calendar API + Gmail OAuth   | Free quota          |                    |
---

## Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/YourUsername/clause-clm.git
cd clause-clm
```

---
### 2 .Open WSL2 Terminal (Windows only)

All commands must run inside WSL2 Ubuntu, not PowerShell or CMD.
Open PowerShell and run:
```bash
wsl -d Ubuntu
```

### 3. Install Node.js (if not installed)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
node --version   # should show v20.x.x
```


---
### 4. Create the Environment File

Copy the template and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env`. The required fields are:

DATABASE_NAME=Clause

VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=
CLERK_ISSUER=https://your-domain.clerk.accounts.dev

VITE_API_BASE_URL=https://localhost

SECRET_KEY=your_generated_secret_here
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://localhost/api/calendar/callback

SMTP_EMAIL=your@gmail.com
SMTP_PASSWORD=your_app_password

ELASTIC_PASSWORD=your_elastic_password_here
INDEX_NAME=clm_knowledge_base

GEMINI_MODEL=gemini-2.5-flash
GEMINI_MODEL_LITE=gemini-2.5-flash
GEMINI_MODEL_HEAVY=gemini-2.5-flash
GEMINI_RPM=15
GEMINI_RPD=500
GEMINI_MODEL_LIMITS=gemini-2.5-pro:0:0,gemini-2.5-flash:5:20

ANTHROPIC_MODEL=claude-sonnet-4-6
ANTHROPIC_ENABLED=true

OLLAMA_MODEL=qwen2.5:7b-instruct
LOCAL_MODEL_ENABLED=false

CORS_ORIGINS=https://localhost,http://localhost

Generate your SECRET_KEY with

```bash
openssl rand -hex 32
```
---

### 5. Frontend .env

Create a separate .env inside the frontend/ folder

VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_API_BASE_URL=https://localhost

---

### 6. Create the Secret Files

Docker Compose reads AI API keys from plain text files (not environment variables) to keep them out of the image layers.

```bash
mkdir -p ingestion/secrets

# Gemini API key — from https://aistudio.google.com/apikey
echo "your-gemini-api-key" > ingestion/secrets/gemini_api_key.txt

# Must match ELASTIC_PASSWORD in .env
echo "your_elastic_password_here" > ingestion/secrets/elastic_password.txt

# Anthropic API key — from https://console.anthropic.com
echo "your-anthropic-api-key" > ingestion/secrets/anthropic_api_key.txt
```
---

### 7. Generate SSL Certificates

nginx requires TLS certificates. For local development, generate a self-signed certificate:

```bash
mkdir -p nginx/certs

openssl req -x509 -newkey rsa:4096 \
  -keyout nginx/certs/server.key \
  -out  nginx/certs/server.crt \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

---


### 8. Build the Frontend

The nginx container serves the pre-built React app, so you must build it once before running Docker.

```bash
cd frontend
npm install
npm run build
cd ..
```

This creates `frontend/dist/` which is copied into the nginx image at build time.


---


### 9. Fix Elasticsearch Memory

This resets every time WSL2 restarts — run it each time before starting the app.

```bash
sudo sysctl -w vm.max_map_count=262144
```
To make it permanent

```bash
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
```


### 10. Fix Docker DNS (if images fail to pull)

Open Docker Desktop → Settings → Docker Engine and update the JSON

```json
{
  "builder": {
    "gc": {
      "defaultKeepStorage": "20GB",
      "enabled": true
    }
  },
  "experimental": false,
  "dns": ["8.8.8.8", "8.8.4.4"]
}
```

Click Apply & Restart. Also fix DNS inside WSL2

```bash
sudo nano /etc/resolv.conf
```

Replace contents with

nameserver 8.8.8.8
nameserver 8.8.4.4


---



### 11. Build and Start

```bash
# Build all Docker images (5–10 minutes on first run)
docker compose build

# Start all services in the background
docker compose up -d

# Watch logs to confirm everything started
docker compose logs -f
```

**Expected healthy services after ~2 minutes:**

```
✔ mongo          healthy
✔ redis_cache    healthy
✔ elasticsearch  healthy
✔ ollama         healthy
✔ clm_backend    healthy
✔ clm_agents     running
✔ clm_worker     running
✔ clm_code       running
✔ clm_nginx      running
```

**Access the app:**

|             URL              | Description      |
|------------------------------|------------------|
| `https://localhost`          | Main application |

> Your browser will warn about the self-signed certificate. Click **Advanced → Proceed to localhost**.

---

## First Admin User

After signing up through the app, promote your account to admin via MongoDB:

```bash
docker exec -it mongo mongosh

use Clause
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
)
exit
```

Then **hard-refresh** your browser (Ctrl+Shift+R). The admin panel will appear in the sidebar under **Admin Panel**, and the **Admin / Contracts** toggle will appear in the top bar.

> **Roles available:** `admin`, `manager`, `user`, `viewer`

---

## Seeding Sample Data

The `seed.py` script populates the database with sample users, contracts, workflows, approvals, and templates — useful for demos or development.

> **Warning:** Running the full seed script **clears all existing data** first.

```bash
docker exec clm_backend python seed.py
```

To seed only the premade contract templates without clearing other data:

```bash
docker exec -it mongo mongosh Clause --eval "
db.templates.insertMany([
  { name: 'Standard NDA', contract_type: 'nda', description: 'Non-disclosure agreement.', is_active: true, version: 1, created_at: new Date(), updated_at: new Date() },
  { name: 'SaaS Service Agreement', contract_type: 'service_agreement', description: 'SaaS subscription agreement.', is_active: true, version: 1, created_at: new Date(), updated_at: new Date() },
  { name: 'Employment Contract', contract_type: 'employment', description: 'Full-time employment agreement.', is_active: true, version: 1, created_at: new Date(), updated_at: new Date() },
  { name: 'Vendor Agreement', contract_type: 'vendor', description: 'Vendor/supplier agreement.', is_active: true, version: 1, created_at: new Date(), updated_at: new Date() }
])
"
```

---

## Common Commands

```bash
# Stop all services
docker compose down

# Rebuild and restart a single service after a code change
docker compose build backend && docker compose up -d backend

# Rebuild the frontend and redeploy nginx
cd frontend && npm run build && cd ..
docker compose build nginx && docker compose up -d nginx

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f agents

# Check the status of all services
docker compose ps

# Rebuild everything from scratch (data is preserved)
docker compose build --no-cache && docker compose up -d

# Destroy everything including all data volumes (IRREVERSIBLE)
docker compose down -v
```

---

## Environment Variables Reference

|              Variable        |            Used by            |               Description                      |
|------------------------------|-------------------------------|------------------------------------------------|
| `DATABASE_NAME`              | backend                       | MongoDB database name                          |
| `CLERK_SECRET_KEY`           | backend                       | Clerk server-side secret key                   |
| `CLERK_ISSUER`               | backend                       | Clerk JWT issuer URL (no trailing slash)       |
| `VITE_CLERK_PUBLISHABLE_KEY` | nginx build                   | Clerk publishable key for the browser          |
| `VITE_API_BASE_URL`          | nginx build                   | API base URL the frontend calls                |
| `SECRET_KEY`                 | backend                       | Random secret for internal token signing       |
| `GOOGLE_CLIENT_ID`           | backend                       | Google OAuth 2.0 client ID                     |
| `GOOGLE_CLIENT_SECRET`       | backend                       | Google OAuth 2.0 client secret                 |
| `GOOGLE_REDIRECT_URI`        | backend                       | OAuth callback URL                             |
| `SMTP_EMAIL`                 | backend                       | Gmail address for outbound notifications       |
| `SMTP_PASSWORD`              | backend                       | Gmail App Password (not your account password) |
| `ELASTIC_PASSWORD`           | elasticsearch, agents, worker | Elasticsearch password                         |
| `INDEX_NAME`                 | agents, worker                | Elasticsearch index name                       |
| `GEMINI_MODEL`               | agents                        | Primary Gemini model ID                        |
| `GEMINI_MODEL_LITE`          | agents                        | Fast Gemini model ID                           |
| `GEMINI_MODEL_HEAVY`         | agents                        | Most capable Gemini model ID                   |
| `GEMINI_RPM`                 | agents                        | Requests-per-minute limit                      |
| `GEMINI_RPD`                 | agents                        | Requests-per-day limit                         |
| `ANTHROPIC_MODEL`            | agents                        | Claude model ID                                |
| `ANTHROPIC_ENABLED`          | agents                        | `true` to enable Claude                        |
| `OLLAMA_MODEL`               | agents                        | Local Ollama model name                        |
| `LOCAL_MODEL_ENABLED`        | agents                        | `true` to enable Ollama (requires GPU)         |
| `COLLABORA_ADMIN_PASSWORD`   | collabora                     | Collabora Online admin password                |
| `CORS_ORIGINS`               | backend                       | Comma-separated allowed CORS origins           |

---

## Troubleshooting

**Backend keeps restarting**
```bash
docker compose logs backend --tail=50
```
Usually a missing or incorrect environment variable, or MongoDB not yet healthy.

**Elasticsearch fails to start (exit code 137 or mmap error)**
```bash
# Elasticsearch needs a higher virtual memory limit
sudo sysctl -w vm.max_map_count=262144

# Make it permanent across reboots
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
```

**Browser shows a certificate warning**
Expected for self-signed certs. Click **Advanced → Proceed to localhost (unsafe)**.

**Frontend shows a blank page after deployment**
The `frontend/dist/` folder must exist before running `docker compose build`. Run `npm install && npm run build` inside `frontend/` first.

**Clerk auth not working / 401 errors**
- Confirm `CLERK_ISSUER` has no trailing slash and matches your Clerk Dashboard exactly.
- Confirm `VITE_CLERK_PUBLISHABLE_KEY` starts with `pk_` and is the key for the correct Clerk app.
- After changing these values, rebuild nginx: `docker compose build nginx && docker compose up -d nginx`

**Admin panel shows "Admin access required"**
Your user's role in MongoDB is not yet `admin`. Follow the [First Admin User](#first-admin-user) steps and hard-refresh your browser.

**Ollama GPU not detected**
The `ollama` service requires an NVIDIA GPU and the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html). If you don't have a GPU, set `LOCAL_MODEL_ENABLED=false` — the platform will use Gemini and Claude instead.

---


