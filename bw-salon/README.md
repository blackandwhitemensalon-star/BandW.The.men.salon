# B&W The Men's Salon

## Local development

1. Install server dependencies with `npm ci` in `server` and client dependencies with `npm ci` in `client`.
2. Copy `server/.env.example` to `server/.env`, then set the local MongoDB URI, a unique admin username, a password of at least 16 characters, and a random JWT secret of at least 32 characters.
3. Run `npm run dev` in `client`. The development script starts the API if it is not already running and then starts Vite at `http://127.0.0.1:5173`.
4. To run the API separately, run `npm start` in `server`.

The site pages are `/` (home and its services, catalogue, about, gallery, reviews, and contact sections), `/book`, `/account`, and `/admin`. The API seeds the initial service catalogue only when the database has no services. Bookings store the selected service name and price at the time of booking.

## Production deployment

Use a Node.js host for `server` and a static frontend host for `client/dist`. Prefer serving both behind one HTTPS domain with a reverse proxy; this keeps `/api`, `/uploads`, and `/socket.io` same-origin. A separate frontend domain is also supported by setting `VITE_API_BASE_URL` to the HTTPS backend origin at frontend build time and allowing the frontend origin in `CLIENT_ORIGINS`.

### Environment variables

Set these in the backend hosting provider's secret/environment settings. Do not copy real values into source control.

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | Set to `production`. |
| `PORT` | Port provided by the hosting platform (defaults to `5000`). |
| `MONGO_URI` | MongoDB Atlas connection string for the production database. Production never falls back to local MongoDB. |
| `JWT_SECRET` | Private random value at least 32 characters long. |
| `ADMIN_USER` | Unique administrator username; do not use the development default. |
| `ADMIN_PASS` | Strong private administrator password, at least 16 characters. |
| `CLIENT_ORIGINS` | Comma-separated frontend origins, including scheme and host, with no trailing path. |
| `UPLOAD_DIR` | Writable persistent disk path for gallery, service, and offer images. |

Set `VITE_API_BASE_URL` only in the frontend build environment when the API is on a different origin, for example `https://api.example.com`. It is a public URL, not a secret. Leave it unset when `/api`, `/uploads`, and `/socket.io` are routed through the frontend origin.

### Build and start

- Frontend: run `npm ci` and `npm run build` in `client`; publish `client/dist`.
- Backend: run `npm ci --omit=dev` and `npm start` in `server`.
- Configure the static host to rewrite unknown page paths to `/index.html` so direct visits and refreshes on `/book`, `/account`, and `/admin` work.
- Route `/api/*` and `/uploads/*` to the backend. Route `/socket.io/*` to the backend with WebSocket upgrades enabled. Do not rewrite these paths to the SPA.
- Terminate TLS at the hosting provider or reverse proxy. Ensure WebSocket traffic uses `wss://` through the HTTPS origin.
- Set `CLIENT_ORIGINS` to every exact frontend origin used in production. Do not use wildcard origins.

### MongoDB Atlas

Create a dedicated database user with only the required application database permissions. Restrict Atlas network access to the backend host's egress IP where available; avoid opening access to all IP addresses. Back up the production database and verify the configured database name before starting the API. Startup creates required indexes and initializes settings/counters, but does not drop existing collections or records.

### Uploaded image persistence

The API writes uploaded images to `UPLOAD_DIR` and serves them under `/uploads`. Mount a persistent writable volume at that path before starting the backend. The default local `server/uploads` directory is suitable for development, not for an ephemeral production filesystem. Back up that volume as well as MongoDB because the database stores image paths, not image bytes.

### Pre-deployment checklist

- Replace/rotate any development admin credentials and use a new private JWT secret.
- Keep `server/.env` out of source control; `.gitignore` excludes environment files, dependencies, build output, and local uploads.
- Set and verify every production environment variable before the first start.
- Build the frontend with the correct API URL configuration.
- Verify `/api/health` reports a connected database and test customer/admin authentication, booking conflicts, notification reconnect/recovery, and upload/delete flows on a staging database.
- Verify the static-host SPA rewrites, API routes, upload URLs, and Socket.IO WebSocket upgrade over HTTPS.
- Confirm Atlas backups and persistent image-volume backups before opening the site to customers.

The backend's dependency-free image-upload tests can be run with `npm test` in `server`.
