# IdeaSpark — Production Deployment Guide

This guide walks through deploying **IdeaSpark** to production with strong security defaults, persistent MongoDB storage, WebSocket support, and HTTPS cookies.

---

## 1. Database Setup (MongoDB Atlas)

1. Create a dedicated cluster in **MongoDB Atlas**.
2. Create a database user with **readWrite** privileges scoped only to the `ideaspark` database (never use root admin credentials in app runtime).
3. Restrict network access to your backend hosting provider's outbound IPs (or VPC peering).
4. Copy the connection string into `MONGO_URI`:
   ```text
   mongodb+srv://<db_user>:<db_password>@cluster0.example.mongodb.net/ideaspark?retryWrites=true&w=majority
   ```
5. Ensure `USE_MEMORY_DB=false` and `AUTO_SEED_DEMO=false` in production.

---

## 2. Backend Deployment (Render / Railway / Fly.io / AWS ECS)

Because IdeaSpark uses **Socket.IO** for real-time messaging and notifications, deploy the backend to a stateful container or PaaS service that supports persistent WebSocket connections (rather than serverless functions with short execution timeouts).

### Required Production Environment Variables (`backend`)

```env
NODE_ENV=production
PORT=5000
CLIENT_URL=https://app.yourdomain.com
MONGO_URI=mongodb+srv://...
USE_MEMORY_DB=false
AUTO_SEED_DEMO=false

# Generate each secret with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=<64_byte_random_hex>
JWT_EXPIRES_IN=7d
CSRF_SECRET=<64_byte_random_hex>
COOKIE_SECURE=true

# Transactional Email (SendGrid / Postmark / SES / Resend SMTP)
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=<smtp_api_key>
EMAIL_FROM="IdeaSpark Security <security@yourdomain.com>"

# Cloudinary (Required in production so uploads persist across container restarts)
CLOUDINARY_CLOUD_NAME=<cloud_name>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>

# Optional GitHub OAuth
GITHUB_CLIENT_ID=<gh_client_id>
GITHUB_CLIENT_SECRET=<gh_client_secret>
GITHUB_CALLBACK_URL=https://api.yourdomain.com/api/auth/github/callback
```

### Build & Start Commands (`backend`)
- **Install Command**: `npm ci`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`

---

## 3. Frontend Deployment (Vercel / Netlify / Cloudflare Pages)

For clean `SameSite=Strict` cookie compatibility between your frontend and backend:
- **Recommended**: Serve both under the same registrable domain (e.g. `https://ideaspark.com` and `https://ideaspark.com/api` via reverse-proxy rewrite rules), OR host on sibling subdomains (`app.ideaspark.com` + `api.ideaspark.com`).

### Example Reverse-Proxy Rewrite (`vercel.json` or Nginx)
Proxying `/api/*` to your backend origin keeps authentication cookies first-party in all browsers:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://api.yourdomain.com/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Frontend Environment Variables (`frontend`)
```env
VITE_API_URL=/api
VITE_SOCKET_URL=https://api.yourdomain.com
```

### Build Settings (`frontend`)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

---

## 4. Post-Deployment Security Checklist

- [ ] Verify HTTPS (`TLS 1.2+`) is enforced on both frontend and backend domains.
- [ ] Confirm `Set-Cookie` headers on `/api/auth/login` contain `HttpOnly; Secure; SameSite=Strict`.
- [ ] Promote your initial administrator account directly in MongoDB:
  ```js
  db.users.updateOne({ email: "founder@yourdomain.com" }, { $set: { role: "admin" } })
  ```
- [ ] Run `npm run seed` once against the empty database if you want default categories initialized (when `AUTO_SEED_DEMO=false`, `server.js` automatically seeds only the default categories without demo users).
- [ ] Verify `/api/health` returns HTTP `200`.

