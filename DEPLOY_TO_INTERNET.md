# Deploy Ariostore to the Internet

## Recommended: Render + GitHub Actions

This repo is set up to deploy Ariostore to Render.

### Platform config

Use [render.yaml](/Users/ario/ariostore-ug/Chat-Interface-Builder/render.yaml):
- runtime: Docker
- service name: `ariostore-gadgets`
- health check: `/health`

### GitHub Actions config

Production deploy automation lives in [render-deploy.yml](/Users/ario/ariostore-ug/Chat-Interface-Builder/.github/workflows/render-deploy.yml).

On push to `main`, it will:
- install dependencies
- type-check
- run tests
- run `npm run db:push` if `DATABASE_URL` is configured
- build the app
- trigger Render using `RENDER_DEPLOY_HOOK_URL`
- verify `DEPLOY_HEALTHCHECK_URL`

### Required GitHub secrets

- `DATABASE_URL`
- `RENDER_DEPLOY_HOOK_URL`
- `DEPLOY_HEALTHCHECK_URL`

You can set them with:

```bash
./scripts/setup-github-deploy-secrets.sh
```

### Render setup steps

1. Create a new Render Web Service from this repository.
2. Select Docker runtime.
3. Point Render at `render.yaml`.
4. Add production environment variables, including `DATABASE_URL`, `SESSION_SECRET`, Sentry DSNs, and any upload/storage settings.
5. Copy the Render deploy hook URL into the GitHub secret `RENDER_DEPLOY_HOOK_URL`.
6. Set `DEPLOY_HEALTHCHECK_URL` to `https://your-service.onrender.com/health`.

### Post-deploy checks

Run these after the first live deploy:

```bash
curl -I https://your-service.onrender.com/store
curl -I https://your-service.onrender.com/store/products
curl https://your-service.onrender.com/robots.txt
curl https://your-service.onrender.com/sitemap.xml
CHECKLY_PUBLIC_BASE_URL=https://your-service.onrender.com npx checkly test
```

### Notes

- Render free tiers can sleep and cause cold-start latency.
- `uploads/` should use persistent storage or external object storage in production.
- The local codebase is currently validated, but production should be re-audited after each deploy.
