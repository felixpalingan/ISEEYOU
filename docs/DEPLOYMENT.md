# Cloud Deployment & Production Operations Guide 🚀

This guide outlines deployment strategies for running **ISEEYOU** in production across cloud providers.

---

## 🏗️ Architecture Topologies

ISEEYOU is decoupled into two independent deployable units:
1. **Frontend Web Client & Gateway**: Next.js 15 App Router (`apps/web`).
2. **Worker Engine & API**: FastAPI asynchronous worker mesh (`apps/worker-engine`).

```
┌─────────────────────────┐          HTTPS / SSE          ┌─────────────────────────┐
│   Vercel / Cloudflare   │ ────────────────────────────> │  Railway / Render / VPS │
│   (Next.js 15 Web App)  │                               │   (FastAPI Worker Mesh) │
└─────────────────────────┘                               └─────────────────────────┘
```

---

## 🌐 1. Deploying Frontend to Vercel

Vercel is the recommended platform for hosting the Next.js 15 frontend application.

### Step 1: Connect GitHub Repository
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New... > Project** and select `felixpalingan/ISEEYOU`.

### Step 2: Configure Project Settings
- **Framework Preset**: Next.js
- **Root Directory**: `apps/web`
- **Build Command**: `cd ../.. && npm install && npm run build:types && npm run build --workspace=apps/web`
- **Output Directory**: `.next`

### Step 3: Configure Environment Variables
In the Vercel dashboard, add the following environment variables:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_WORKER_ENGINE_URL` | Public HTTPS URL of the deployed FastAPI worker engine | `https://worker.yourdomain.com` |
| `GEMINI_API_KEY` | *(Optional)* Google Gemini Flash API key for AI Copilot | `AIzaSy...` |
| `NEXT_PUBLIC_APP_URL` | Canonical public URL of your web frontend | `https://iseeyou.yourdomain.com` |

---

## ⚡ 2. Deploying Worker Engine to Railway / Render

The FastAPI worker engine is container-ready and can be deployed via Dockerfile.

### Deploying to Railway
1. Log in to [Railway](https://railway.app).
2. Create a **New Project > Deploy from GitHub Repo** and select `felixpalingan/ISEEYOU`.
3. In service settings, configure:
   - **Dockerfile Path**: `docker/Dockerfile.worker`
   - **Docker Context**: `.` (Root directory)
4. Add Environment Variables:
   ```env
   PORT=8000
   ENVIRONMENT=production
   GEMINI_API_KEY=your_gemini_api_key_here
   RATE_LIMIT_PER_MINUTE=60
   ALLOWED_ORIGINS=https://iseeyou.yourdomain.com
   ```
5. Railway will automatically build the image and generate a public HTTPS domain (e.g. `https://iseeyou-worker.up.railway.app`).
6. Verify deployment at `https://iseeyou-worker.up.railway.app/api/v1/health`.

---

## 🐳 3. Self-Hosted VPS Deployment (Docker Compose + Caddy / Nginx)

For maximum data privacy and cost efficiency, ISEEYOU can be deployed to a single Ubuntu 22.04+ VPS (e.g., DigitalOcean, Hetzner, AWS EC2, Linode).

### Step 1: Install Docker & Docker Compose
```bash
# Update and install Docker
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

### Step 2: Clone and Configure
```bash
git clone https://github.com/felixpalingan/ISEEYOU.git /opt/iseeyou
cd /opt/iseeyou
cp .env.example .env
nano .env  # Add your GEMINI_API_KEY
```

### Step 3: Run Full Stack
```bash
docker compose up -d --build
```

### Step 4: Configure Reverse Proxy & Automatic SSL (Caddy)
Create `/etc/caddy/Caddyfile`:
```caddy
iseeyou.yourdomain.com {
    reverse_proxy localhost:3000
}

api-iseeyou.yourdomain.com {
    reverse_proxy localhost:8000
}
```

Reload Caddy:
```bash
sudo systemctl reload caddy
```

Caddy will automatically provision and renew Let's Encrypt TLS certificates.

---

## 🛡️ Production Security Checklist

- [ ] **Anti-SSRF Gate Active**: Verify that outbound worker requests reject loopback (`127.0.0.1`) and cloud metadata (`169.254.169.254`).
- [ ] **CORS Restricted**: Ensure `ALLOWED_ORIGINS` in the worker engine matches your frontend domain only.
- [ ] **Rate Limiting**: Confirm rate limits are active (`RATE_LIMIT_PER_MINUTE=30`).
- [ ] **API Keys Guarded**: Ensure `GEMINI_API_KEY` is set via server-side environment variables and never exposed to client-side bundles.
