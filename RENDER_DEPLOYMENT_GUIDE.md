# 🚀 Render + Neon Deployment Guide

## Overview
Deploy Ariostore to Render with Neon PostgreSQL database.

---

## Step 1: Prepare Your Repository

### 1.1 Push Code to GitHub
```bash
cd chat-interferes
git add .
git commit -m "Add Face ID authentication and fixes"
git push origin main
```

### 1.2 Copy Render Config
```bash
cp render.yaml render.yaml.backup
cp package.json package.json.backup
# package.json.render has the production dependencies
```

---

## Step 2: Set Up Neon Database

### 2.1 Create Neon Account
1. Go to https://neon.tech
2. Sign up with GitHub
3. Create a new project called "ariostore"

### 2.2 Get Connection String
1. In Neon dashboard, click "Connection Details"
2. Copy the connection string (starts with `postgresql://`)
3. Keep this safe - you'll need it for Render

### 2.3 Connection String Format
```
postgresql://username:password@hostname/database?sslmode=require
```

---

## Step 3: Deploy to Render

### 3.1 Create Web Service
1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repo (arinherbz/chat-interferes)
4. Configure:
   - **Name:** ariostore
   - **Region:** Oregon (or closest to you)
   - **Branch:** main
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Starter ($7/month recommended)

### 3.2 Add Environment Variables
In Render dashboard → Your Service → Environment:

```
NODE_ENV=production
DATABASE_URL=your-neon-connection-string-here
SESSION_SECRET=a-random-secret-key-min-32-characters-long
SESSION_COOKIE_SECURE=true
RP_ID=your-app-name.onrender.com
ORIGIN=https://your-app-name.onrender.com
PORT=10000
```

**Important:**
- Replace `your-neon-connection-string-here` with actual Neon URL
- Replace `your-app-name` with your Render app name
- SESSION_SECRET should be random (generate with: `openssl rand -base64 32`)

### 3.3 Deploy
Click "Create Web Service"

Render will:
1. Clone your repo
2. Run `npm install`
3. Run `npm run build`
4. Start the server

---

## Step 4: Database Migration

### 4.1 Install Drizzle Kit Locally
```bash
npm install -g drizzle-kit
```

### 4.2 Set Environment Variable
```bash
export DATABASE_URL="your-neon-connection-string-here"
```

### 4.3 Push Schema to Neon
```bash
cd chat-interferes
npm run db:push
```

This creates all tables:
- users
- shops
- products
- orders
- webauthn_credentials (for Face ID)
- media_assets (for images)
- And all others...

### 4.4 Verify Tables
In Neon dashboard → SQL Editor:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

Should show ~20+ tables.

---

## Step 5: Custom Domain (Optional)

### 5.1 Add Custom Domain in Render
1. Render Dashboard → Your Service → Settings → Custom Domains
2. Add your domain: `ariostore.ug`
3. Follow DNS instructions

### 5.2 Update Environment Variables
After setting custom domain, update:
```
RP_ID=ariostore.ug
ORIGIN=https://ariostore.ug
```

### 5.3 Redeploy
Click "Manual Deploy" → "Clear build cache & deploy"

---

## Step 6: Test Deployment

### 6.1 Basic Health Check
```bash
curl https://your-app.onrender.com/api/health
```
Should return: `{"status":"ok"}`

### 6.2 Create Owner Account
1. Open `https://your-app.onrender.com`
2. Create owner account
3. Login

### 6.3 Test Features
- [ ] Upload product image
- [ ] Create order
- [ ] Face ID login (on mobile)
- [ ] POS checkout

---

## Step 7: Production Checklist

### Security
- [ ] Change default admin PIN
- [ ] Enable HTTPS (Render does this automatically)
- [ ] Set strong SESSION_SECRET
- [ ] Configure CORS if needed

### Performance
- [ ] Upgrade to Render Starter ($7/mo) - removes cold starts
- [ ] Enable Cloudflare CDN for images
- [ ] Add Google Analytics

### Monitoring
- [ ] Set up Sentry for error tracking
- [ ] Configure Render alerts
- [ ] Check logs regularly

---

## Troubleshooting

### Database Connection Failed
```
Error: connect ECONNREFUSED
```
**Fix:** Check DATABASE_URL format, ensure sslmode=require

### Build Fails
```
npm ERR! missing script: build
```
**Fix:** Ensure package.json has build script:
```json
"build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist"
```

### Images Not Showing
```
404 on /uploads/...
```
**Fix:** Uploads folder not persisted on Render. Use:
- Cloudinary for images
- S3 bucket
- Or database storage (already implemented)

### Face ID Not Working
```
SecurityError: User cancellation
```
**Fix:** WebAuthn requires HTTPS. Ensure ORIGIN uses https://

---

## Render Blueprint (Alternative)

Use `render.yaml` for one-click deploy:

```bash
# In your repo root
git add render.yaml
git commit -m "Add Render deployment config"
git push origin main

# In Render dashboard:
# Blueprints → New Blueprint Instance → Select repo
```

---

## Cost Breakdown

| Service | Plan | Cost/Month |
|---------|------|------------|
| Render Web | Starter | $7 |
| Neon DB | Free Tier | $0 |
| **Total** | | **$7** |

For production with more traffic:
- Render Standard: $25/mo
- Neon Pro: $19/mo

---

## Next Steps After Deployment

1. **Add Payment Integration** (Flutterwave)
2. **Set up Africa's Talking** (SMS notifications)
3. **Add Google Analytics**
4. **Create legal pages** (TOS, Privacy, Returns)
5. **SEO optimization** (react-snap)

---

**Ready to deploy!** Follow steps 1-4 to get your app live.

**Need help?** Check Render logs in dashboard for specific errors.
