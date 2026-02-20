# TechPOS Deployment Guide

## Overview
This guide covers local development setup, CI/CD pipeline, and team deployment for the TechPOS system.

## Prerequisites
- Node.js 20+
- Docker & Docker Compose (for containerized deployment)
- Git with GitHub access
- GitHub Actions enabled on the repository

---

## 1. Local Development Setup

### Clone and Install
```bash
git clone <your-repo-url>
cd Chat-Interface-Builder
npm install
```

### Environment Configuration
```bash
cp .env.example .env
# Edit .env with your local settings
```

### Run Locally
```bash
# Terminal 1: Start backend (port 5000)
npm run dev

# Terminal 2: Start frontend (port 5001)
npm run dev:client
```

Access the app at: **http://localhost:5001**

### Run Tests
```bash
npm test
```

---

## 2. CI/CD Pipeline (GitHub Actions)

The workflow (`.github/workflows/ci.yml`) automatically:
- ✅ Runs tests on every push and pull request
- ✅ Type-checks TypeScript code
- ✅ Builds the project
- ✅ Deploys on merge to `main` branch

**Push triggers testing:**
```bash
git add .
git commit -m "Your changes"
git push origin develop  # or your feature branch
```

Monitor CI status in GitHub **Actions** tab.

---

## 3. Team Deployment with Docker

### Using Docker Compose (Recommended for Teams)

**Start the app:**
```bash
docker-compose up -d
```

**View logs:**
```bash
docker-compose logs -f app
```

**Stop the app:**
```bash
docker-compose down
```

**Access:**
- Backend API: http://localhost:5000
- Frontend: http://localhost:5001

### Manual Docker Build

```bash
# Build image
docker build -t techpos:latest .

# Run container
docker run -d \
  -p 5000:5000 \
  -p 5001:5001 \
  --name techpos-app \
  -e NODE_ENV=production \
  techpos:latest
```

---

## 4. Production Deployment

### Option A: Deploy to Heroku (Easiest)

1. **Install Heroku CLI**
   ```bash
   brew install heroku/brew/heroku
   ```

2. **Login & Create App**
   ```bash
   heroku login
   heroku create techpos-app
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

4. **View Logs**
   ```bash
   heroku logs --tail
   ```

### Option B: Deploy to AWS EC2 / DigitalOcean

1. **SSH into server**
   ```bash
   ssh user@your-server-ip
   ```

2. **Clone repo & install**
   ```bash
   git clone <your-repo-url>
   cd Chat-Interface-Builder
   npm install
   ```

3. **Use PM2 for process management**
   ```bash
   npm install -g pm2
   pm2 start npm --name "techpos" -- run dev
   pm2 save
   pm2 startup
   ```

4. **Setup Nginx reverse proxy** (recommended)
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:5001;
       }
       
       location /api {
           proxy_pass http://localhost:5000;
       }
   }
   ```

### Option C: Deploy to Railway / Render (No-Code)

1. Connect GitHub repo to Railway.app or Render.com
2. Set environment variables
3. Deploy with one click

---

## 5. Environment Variables for Production

Create a `.env` file on your production server:

```bash
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
VITE_API_URL=https://yourdomain.com
DATABASE_URL=/var/lib/techpos/storage.db
JWT_SECRET=<strong-random-secret>
LOG_LEVEL=info
```

---

## 6. Database Backups

### SQLite (Current)
```bash
# Backup
cp storage.db storage.db.backup.$(date +%Y%m%d)

# Restore
cp storage.db.backup.20240220 storage.db
```

### For Production: Migrate to PostgreSQL
Uncomment the `postgres` service in `docker-compose.yml` and update `server/db.ts` to use `@vercel/postgres` or similar.

---

## 7. Monitoring & Logs

### Local Development
```bash
npm run dev  # See logs in terminal
```

### Production (PM2)
```bash
pm2 logs
pm2 monit
```

### Docker
```bash
docker-compose logs -f app
```

---

## 8. Troubleshooting

| Issue | Solution |
|-------|----------|
| Port already in use | Change PORT in `.env` or kill process: `lsof -i :5000` |
| Modules not found | Run `npm install` and `npm rebuild` |
| Database errors | Ensure `storage.db` exists and is writable |
| White screen | Check browser console (F12) and server logs |

---

## 9. Rolling Back

If deployment fails:

```bash
# Git rollback
git revert <commit-hash>
git push

# GitHub Actions will automatically test and deploy

# Or manually restart with previous version
docker-compose down
git checkout <previous-commit>
docker-compose up -d
```

---

## 10. Team Access & Permissions

### GitHub
1. Add team members as collaborators in repo settings
2. Create branches: `main` (production), `develop` (staging), `feature/*` (development)
3. Use pull requests for code review

### Environment Management
- Use GitHub Secrets for sensitive data (DB passwords, API keys)
- Never commit `.env` files
- Share `.env.example` for reference

---

## 11. Quick Commands Reference

```bash
# Development
npm run dev          # Backend
npm run dev:client   # Frontend
npm test             # Tests

# Building
npm run build        # Full build
npm run check        # Type check

# Docker
docker-compose up -d      # Start
docker-compose down       # Stop
docker-compose logs -f    # Logs

# Deployment
git push heroku main      # Heroku deploy
```

---

## Support
For issues, check logs, open an issue in GitHub, or contact the team lead.
