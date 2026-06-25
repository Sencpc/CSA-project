# Flower Beauty Salon – Full‑Stack App (React + Vite + Express + MongoDB)

This repository contains a React frontend (Vite) and an Express + Mongoose backend that power a salon booking experience with role‑based areas (Customer/Admin), coupons, cart/checkout, and Midtrans Snap payments. Optional Twilio integrations provide WhatsApp booking reminders and SMS verification.

## What’s Inside

- Frontend: React 19 + Vite 7 (Tailwind CSS), Redux Toolkit, React Router.
- Backend: Express, Mongoose, Midtrans Snap, cron jobs for reminders.
- Payments: Midtrans Snap (Sandbox by default).
- Optional: Twilio WhatsApp reminders and Twilio Verify OTP.

Folder layout (simplified):

```
Backend/                # Express API + Mongo models, jobs, and scripts
src/                    # React app (Vite)
```

## Prerequisites

- Node.js 18+
- MongoDB (local) or Docker
- Midtrans account (Sandbox for development)
- Optional: Twilio account for WhatsApp/Verify features

## Environment Variables

Create two `.env` files: one at the project root (frontend) and one in `Backend/` (backend).

Frontend `.env` (project root):

```
VITE_API_URL=http://localhost:4000
VITE_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxx
# Optional: override Snap script URL (defaults to Sandbox URL in code)
VITE_MIDTRANS_SNAP_URL=https://app.sandbox.midtrans.com/snap/snap.js
```

Backend `.env` (in `Backend/`):

```
PORT=4000
CORS_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/flower-salon
JWT_SECRET=replace-with-a-long-random-string

# Midtrans
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxx
MIDTRANS_IS_PRODUCTION=false

# Optional: Twilio (WhatsApp reminders + Verify)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
WHATSAPP_TEST_MODE=true
BOOKING_REMINDER_CRON=0 9 * * *
BOOKING_REMINDER_TZ=Asia/Jakarta
```

Notes:

- `VITE_API_URL` is required; the frontend throws an error at startup if it is missing so you always know which API host you are targeting (local, staging, prod, etc.).
- `VITE_MIDTRANS_CLIENT_KEY` enables the Snap modal in the cart (`CustomerCart.jsx`).
- Backend Midtrans keys are required to generate Snap tokens for checkout.

## Install Dependencies

Run these from the project root (PowerShell):

```powershell
npm install
npm run install:backend
```

## Start MongoDB

You can run MongoDB locally or use Docker. To use the included compose file:

```powershell
docker compose -f Backend/docker-compose.yml up -d
```

This exposes MongoDB on `localhost:27017` and persists data in a Docker volume.

## Seed Sample Data (optional)

Populate initial data for services, categories, etc.:

```powershell
npm run backend:seed
```

## Run the App (dev)

Run the backend and frontend in separate terminals so each service can point at its own environment variables:

```powershell
# Terminal 1 – Backend API
npm run backend:dev

# Terminal 2 – Frontend (Vite)
npm run dev
```

- Frontend: http://localhost:5173 (proxied API requests go to `VITE_API_URL`).
- Backend: whatever host/port you configured via `PORT`/`VITE_API_URL` (default `http://localhost:4000`).

## Payments (Midtrans Snap)

- Set the frontend `VITE_MIDTRANS_CLIENT_KEY` and backend `MIDTRANS_SERVER_KEY`/`MIDTRANS_CLIENT_KEY`.
- In the cart page, use “Bayar dengan Midtrans” to open the Snap modal.
- In Sandbox, use test payment methods from the Midtrans docs. See: https://docs.midtrans.com

The frontend falls back to embedded Snap if `window.snap.pay` isn’t available, and ultimately to a hosted `redirectUrl` if needed.

## Auth & Route Guards

- The app mounts `AuthProvider` (`src/context/AuthProvider.jsx`) and exposes `useAuth()` for token/user data.
- `ProtectedRoute` (`src/Components/FrontEnd/Shared/ProtectedRoute.jsx`) redirects unauthenticated users to `/login` and enforces role‑based access.

## Backend Details

See `Backend/README.md` for API routes, models, reminder jobs, and Twilio Verify endpoints. Key endpoints used by checkout:

- `POST /api/customer/cart/redeem-coupon` – validate a coupon for the current cart.
- `POST /api/customer/checkout/snap-token` – create a Midtrans Snap token + optional `redirectUrl`.

## Production Notes

- Use production Midtrans keys and set `MIDTRANS_IS_PRODUCTION=true` on the backend.
- Prefer HTTPS and secure cookies for auth in production.
- Configure CORS appropriately via `CORS_ORIGIN`.

## Scripts Reference (root)

- `npm run dev` – frontend (Vite dev server).
- `npm run backend:dev` – backend only (nodemon).
- `npm run backend:start` – backend only (node).
- `npm run backend:seed` – run backend seed script.
- `npm run install:backend` – install backend dependencies.

## Further Documentation

- Full technical deep-dive: `docs/TECHNICAL_OVERVIEW.md`
