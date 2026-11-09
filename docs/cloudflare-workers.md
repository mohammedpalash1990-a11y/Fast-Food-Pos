# Cloudflare Workers API deployment

The existing Express API is exposed through Cloudflare's Node.js HTTP server adapter. PostgreSQL connections use Cloudflare Hyperdrive, which connects to the existing Neon production database. The API does not copy or reset database rows.

## One-time Cloudflare setup

1. Install dependencies with `npm ci`.
2. In Neon, create a dedicated database role for Hyperdrive and copy its **direct / unpooled** PostgreSQL connection string. Do not use the Neon pooled connection string.
3. Create the Hyperdrive configuration:

   ```sh
   npx wrangler hyperdrive create musafir-fast-food-neon --connection-string="YOUR_DIRECT_NEON_CONNECTION_STRING"
   ```

4. Copy the returned Hyperdrive ID into `wrangler.jsonc`, replacing `REPLACE_WITH_CLOUDFLARE_HYPERDRIVE_ID`.
5. Authenticate Wrangler with the Cloudflare account:

   ```sh
   npx wrangler login
   ```

6. Add the JWT signing secret. Use a cryptographically random value of at least 32 characters:

   ```sh
   npx wrangler secret put JWT_SECRET
   ```

7. Set `CORS_ORIGIN` as a Worker variable to the exact frontend origin (scheme + hostname only), then deploy:

   ```sh
   npx wrangler deploy
   ```

The Worker is published on its `workers.dev` hostname. The API health check is `/api/health`.

## Create the production owner

The production seed path creates only the first owner and branch; it does not create demo sales or sample products. Run it once from a trusted local terminal using the **direct Neon connection string** (not the Hyperdrive URL), and choose a unique owner email and password:

PowerShell:

```powershell
$env:NODE_ENV = "production"
$env:NEON_DATABASE_URL = "YOUR_DIRECT_NEON_CONNECTION_STRING"
$env:BOOTSTRAP_ADMIN_EMAIL = "YOUR_OWNER_EMAIL"
$env:BOOTSTRAP_ADMIN_PASSWORD = "YOUR_UNIQUE_PASSWORD_AT_LEAST_12_CHARACTERS"
npm run db:seed
Remove-Item Env:NODE_ENV, Env:NEON_DATABASE_URL, Env:BOOTSTRAP_ADMIN_EMAIL, Env:BOOTSTRAP_ADMIN_PASSWORD
```

The seed is idempotent and does not reset an existing owner's password. Do not commit credentials or paste them into chat.

## Local checks

```sh
npm run build
npm run typecheck:server
npx wrangler deploy --dry-run
```

A successful build is not a production verification. Confirm `GET /api/health` returns `{ "status": "ok", "database": "connected" }`, then test owner login and Cash/Mada checkout against the deployed API before using it for live sales.
