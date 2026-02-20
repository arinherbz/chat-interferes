# TechPOS - Full Stack Setup & Quick Start

## Quick Start (5 minutes)

### 1. Clone and Setup
```bash
git clone https://github.com/YOUR_USERNAME/Chat-Interface-Builder.git
cd Chat-Interface-Builder
npm install
cp .env.example .env
```

### 2. Start Development Servers
```bash
# Terminal 1: Backend (API on port 5000)
npm run dev

# Terminal 2: Frontend (UI on port 5001)
npm run dev:client
```

Visit: **http://localhost:5001**

### 3. Run Tests
```bash
npm test
```

---

## 📋 What's Inside

- **Backend**: Express.js API with SQLite database
- **Frontend**: React 19 + Vite + TailwindCSS
- **Database**: Better-sqlite3 with Drizzle ORM
- **UI**: Radix UI components + Shadcn
- **Testing**: Vitest

---

## 🚀 Deployment & CI/CD

**For team deployment, CI/CD setup, and production deployment:**

→ See [**DEPLOYMENT.md**](./DEPLOYMENT.md) ← for complete guide

### Quick Deployment Options:
- **Docker**: `docker-compose up -d`
- **Heroku**: `git push heroku main`
- **DigitalOcean/AWS**: Follow DEPLOYMENT.md

---

## 📦 Key Scripts

```bash
npm run dev          # Start backend (5000)
npm run dev:client   # Start frontend (5001)
npm test             # Run tests
npm run build        # Production build
npm run check        # TypeScript type check
npm run db:push      # Sync database schema
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` for local development. **Never commit `.env` files.**

---

## 🐳 Docker (Local & Team)

```bash
# Start everything
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f
```

---

## 📚 Folder Structure

```
├── client/              # React frontend
│   └── src/
│       ├── pages/       # Route pages
│       ├── components/  # Reusable components
│       └── lib/         # Utilities & hooks
├── server/              # Express backend
│   ├── routes.ts        # API routes
│   ├── db.ts            # Database setup
│   └── __tests__/       # Backend tests
├── shared/              # Shared types
├── migrations/          # Database migrations
└── script/              # Build & seed scripts
```

---

## 🛠 Troubleshooting

| Problem | Solution |
|---------|----------|
| White screen | Check console (F12) and `npm run dev` logs |
| Port in use | Change PORT in `.env` or kill: `lsof -i :5000` |
| Database error | Run `npm install && npm rebuild` |
| Module not found | `npm install --no-save` |

---

## 🔄 Git Workflow (Team)

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes & commit
git add .
git commit -m "feat: description"

# Push & create PR
git push origin feature/my-feature

# GitHub Actions will test automatically
# Merge to main after approval
```

---

## 📞 Need Help?

- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup
- Run `npm test` to verify everything works
- Check browser console (F12) for frontend errors
- Check terminal for backend errors

---

**Happy coding! 🚀**
