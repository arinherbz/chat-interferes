# Deploy TechPOS to the Internet (5 minutes)

## Option 1: Railway.app ⭐ (Recommended - Easiest)

### Step 1: Sign Up
1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Sign in with GitHub

### Step 2: Connect Your GitHub Repo
1. Select "Deploy from GitHub repo"
2. Authorize Railway to access your GitHub
3. Select `arinherbz/chat-interferes`

### Step 3: Configure Environment
Railway will auto-detect Node.js. Just add:
```
NODE_ENV=production
PORT=5000
HOST=0.0.0.0
```

### Step 4: Deploy
- Click "Deploy"
- Wait ~2-3 minutes
- Get your public URL (e.g., `https://chat-interferes-prod.railway.app`)

**Cost**: ~$5-10/month with free $5 credit  
**Team Access**: Share the URL with anyone

---

## Option 2: Render.com (Free Tier Available)

### Step 1: Go to [render.com](https://render.com)
1. Sign up with GitHub
2. Click "New +"
3. Select "Web Service"

### Step 2: Select Repository
- Choose `arinherbz/chat-interferes`

### Step 3: Configure
- **Name**: `techpos`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Environment**: Add vars (same as Railway above)

### Step 4: Deploy
- Click "Create Web Service"
- Wait ~5 minutes
- Get your public URL (e.g., `https://techpos.onrender.com`)

**Cost**: Free tier (sleeps after 15 min inactivity), paid tiers start at $7/month  
**Team Access**: Share the URL

---

## Option 3: DigitalOcean (Most Control)

### Quick Setup (~10 min, $6/month)

```bash
# 1. Create droplet at digitalocean.com
# 2. SSH into your server
ssh root@YOUR_SERVER_IP

# 3. Setup
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs npm git

# 4. Clone & setup
git clone https://github.com/arinherbz/chat-interferes.git
cd chat-interferes
npm install
cp .env.example .env

# 5. Use PM2 to run forever
npm install -g pm2
pm2 start npm --name "techpos" -- run build && npm run start
pm2 save
pm2 startup

# 6. Setup Nginx reverse proxy
sudo apt install -y nginx
```

Then create `/etc/nginx/sites-available/techpos`:
```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable & restart:
```bash
sudo ln -s /etc/nginx/sites-available/techpos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Cost**: $6/month  
**Team Access**: `http://YOUR_DOMAIN.com`

---

## Option 4: Vercel (Frontend Only)

⚠️ **Note**: This deploys frontend to Vercel, but backend needs separate hosting.

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Set `VITE_API_URL` to your deployed backend URL
4. Deploy

---

## Which Option to Choose?

| Option | Ease | Cost | Speed | Best For |
|--------|------|------|-------|----------|
| **Railway** ⭐ | ⭐⭐⭐⭐⭐ | $5-10/mo | 2 min | Teams, quick deployment |
| **Render** | ⭐⭐⭐⭐ | Free/$7+ | 5 min | Low budget, testing |
| **DigitalOcean** | ⭐⭐⭐ | $6/mo | 10 min | Full control, custom domain |
| **Vercel** | ⭐⭐⭐⭐ | Free | 2 min | Frontend only (need backend elsewhere) |

### 🎯 Recommended: **Railway.app**
- Easiest setup
- One-click from GitHub
- Cheapest ($5/month)
- Professional deployment

---

## After Deployment

### Get Your Public URL
Once deployed, you'll get a URL like:
```
https://chat-interferes-prod.railway.app
```

### Share with Team
Send the URL to your team. Anyone can access it from anywhere! 🌍

### Monitor
- Railway: Check logs in dashboard
- Render: Check "Logs" tab
- DO: `pm2 logs`

### Make Changes
Just commit & push to GitHub:
```bash
git add .
git commit -m "fix: something"
git push origin main
```

Railway/Render auto-redeploys on push. ✨

---

## Setup a Custom Domain (Optional)

Once deployed, link your domain:

**Railway**: Settings → Domains → Add domain  
**Render**: Environment → Custom Domains  
**DO**: Point DNS to server IP  

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Deploy fails | Check build logs in dashboard; ensure `npm run build` works locally |
| Database error | Use Railway PostgreSQL add-on or managed database |
| Slow first load | Railway/Render free tiers sleep; upgrade plan |
| 404 errors | Ensure `VITE_API_URL` matches backend URL |

---

## Next Steps

1. **Pick a platform** (Railway recommended)
2. **Sign up with GitHub**
3. **Deploy** (1 click)
4. **Share URL** with team
5. **Monitor logs** after going live

**That's it! Your team can now access TechPOS from anywhere 🚀**
