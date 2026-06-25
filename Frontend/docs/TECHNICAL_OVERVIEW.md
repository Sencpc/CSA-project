# Flower Beauty Salon – Technical Overview

This document describes the architecture, key modules, data flow, configuration, and operational details of the project. Use it alongside the root `README.md` and `Backend/README.md`.

## Architecture

- Frontend: React 19 (Vite 7), Tailwind CSS, React Router, Redux Toolkit.
- Backend: Express + Mongoose, Node 18+, MongoDB, Midtrans Snap integration, cron-based jobs.
- Integrations:
  - Payments: Midtrans Snap (Sandbox by default).
  - Messaging: Twilio WhatsApp reminders (optional).
  - OTP: Twilio Verify (optional).

High-level flow:

```
Browser (React/Vite) ──HTTP──> Express API ──> MongoDB
                           └─> Midtrans (Snap)
                           └─> Twilio (WhatsApp / Verify)
```

## Repository Layout

```
Backend/                     # Express API (routers, models, jobs, services)
  src/
    controllers/             # Route handlers (auth, users, coupons, bookings, transactions, services, customer, verify)
    jobs/                    # Scheduled jobs (booking reminders)
    middleware/              # Auth middleware
    models/                  # Mongoose models (User, Booking, Service, Coupon, Transaction, etc.)
    services/                # External integrations (Twilio Verify, WhatsApp)
    utils/                   # Serializers and helpers
    config/db.js             # Mongo connection
    server.js                # App entrypoint (mounts routers, starts jobs, listens)
  docker-compose.yml         # Local MongoDB service (Docker)

src/                         # React app (Vite)
  Components/FrontEnd/       # UI by area (Admin, Shared, User)
  context/                   # Global providers (auth, cart)
  store/                     # Redux Toolkit store and slices
  main.jsx, App.jsx          # App bootstrap and routes
```

## Configuration

Two `.env` files are used:

Frontend `.env` (project root):

```
VITE_API_URL=http://localhost:4000
VITE_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxxxxxx
# Optional: override the Snap script URL (defaults to Sandbox)
VITE_MIDTRANS_SNAP_URL=https://app.sandbox.midtrans.com/snap/snap.js
```

`VITE_API_URL` is mandatory—the frontend will throw at build/start time if it is missing so deployments always declare the API host explicitly.

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

# Twilio (optional)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
WHATSAPP_TEST_MODE=true
BOOKING_REMINDER_CRON=0 9 * * *
BOOKING_REMINDER_TZ=Asia/Jakarta
```

## Frontend

- Routing: React Router defines public pages (e.g., Home, Book, Blog) and protected areas (Customer Dashboard, Admin Dashboard).
- Auth: `src/context/AuthProvider.jsx` + `src/context/AuthContext.js` expose `useAuth()` with `token`, `user`, and helpers. Tokens are persisted in `localStorage` for development simplicity.
- Guards: `Components/FrontEnd/Shared/ProtectedRoute.jsx` redirects unauthenticated users to `/login` and enforces role-based access.
- State: Redux Toolkit store in `src/store`. The cart slice tracks items, coupon, and totals with selectors like `selectCartItems`, `selectCartTotals`, `selectCartCoupon`.

### Cart & Payments (Midtrans)

The customer cart (`Components/FrontEnd/User/CustomerCart.jsx`) handles:

- Displaying cart items, derived duration and totals.
- Applying coupons (`POST /api/customer/cart/redeem-coupon`).
- Starting checkout by fetching a Midtrans Snap token (`POST /api/customer/checkout/snap-token`).
- Loading the Snap script on demand using `VITE_MIDTRANS_CLIENT_KEY`.
- Payment UI flow:
  1. Try `window.snap.pay(token, callbacks)` if available.
  2. Fallback to embedded mode `snap.embed()` if pay is unavailable but embed is.
  3. Final fallback to server-provided `redirectUrl` (hosted payment page).
- Callbacks (`onSuccess`, `onPending`, `onError`, `onClose`) normalize UI feedback and navigate to:
  - `/customer/history?payment=success|pending`
  - `/customer/cart?payment=error|cancelled`

This layered strategy ensures a resilient checkout experience even if Snap script capabilities differ.

## Backend

### Server Entry

- `Backend/src/server.js` mounts routers under:
  - `/api/auth`, `/api/users`, `/api/coupons`, `/api/bookings`, `/api/transactions`, `/api/services`, `/api/customer`, `/api/verify`
- Connects to MongoDB via `config/db.js`.
- Starts booking reminder job and triggers an initial reminder scan on boot.

### Key Routers (Purpose)

- `auth.js`: registration and login.
- `users.js`: user management (admin scope).
- `coupons.js`: manage coupons and rules.
- `services.js`: services, categories, pricing.
- `bookings.js`: booking lifecycle.
- `transactions.js`: transaction records and reconciliation helpers.
- `customer.js`: customer-facing endpoints: cart coupon redeem, checkout token, availability helpers.
- `verify.js`: Twilio Verify (send/check) endpoints.

### Payments (Midtrans)

- The backend builds a Snap transaction and returns a `token` (and optionally `redirectUrl`) from `POST /api/customer/checkout/snap-token`.
- It validates cart totals and applied coupon rules before creating a transaction.
- Transaction details are stored with a `midtransResponse` snapshot in `Transaction` documents.

### Booking Reminders (WhatsApp)

- `jobs/bookingReminderJob.js` sets up a daily cron (default 09:00 Asia/Jakarta) to send WhatsApp reminders for bookings 3 days ahead.
- Integration is handled via Twilio (sandbox or live), guarded by `WHATSAPP_TEST_MODE` for safe local runs.

### OTP (Twilio Verify)

Endpoints (see also Backend README):

- `POST /api/verify/service` – ensure Verify Service exists and return its SID.
- `POST /api/verify/send` – start an SMS verification `{ phone, locale? }`.
- `POST /api/verify/check` – verify code `{ phone, code }`.

## Data Models (overview)

Mongoose models include (fields simplified):

- `User`: profile, roles, auth hash, contact info.
- `Service`, `Category`: catalog and pricing.
- `Booking`: customer, services chosen, schedule, status.
- `Coupon`: code, active window, discount rules, eligible services.
- `Transaction`: amount, method (Midtrans), status, reference, booked services snapshot, `midtransResponse`.
- `Settings`, `Notification`, `Review`, `BlogPost`, `GalleryItem` for site features.

Refer to files under `Backend/src/models/` for exact schemas.

## Local Development

Common scripts (run from project root):

```powershell
npm install
npm run install:backend

# Start local Mongo with Docker (optional)
docker compose -f Backend/docker-compose.yml up -d

# Seed sample data (optional)
npm run backend:seed

# Run dev servers (separate terminals)
npm run backend:dev   # terminal 1
npm run dev           # terminal 2
```

## Deployment Notes

- Use production Midtrans keys and set `MIDTRANS_IS_PRODUCTION=true`.
- Serve the frontend over HTTPS and set strict CORS via `CORS_ORIGIN`.
- Prefer HTTP-only secure cookies for auth in production deployments.
- Ensure environment variables are set in the target environment.

## Troubleshooting

- Snap not loading: confirm `VITE_MIDTRANS_CLIENT_KEY` and internet access to `app.sandbox.midtrans.com`.
- Checkout token errors: verify backend Midtrans keys and `MONGODB_URI` connectivity.
- CORS blocked: set `CORS_ORIGIN` to your frontend origin (e.g., `http://localhost:5173`).
- WhatsApp/Verify failures: check Twilio credentials or set `WHATSAPP_TEST_MODE=true` locally.

## Future Improvements

- Move auth tokens to HTTP-only cookies with CSRF protection.
- Add e2e tests (e.g., Playwright) for critical flows.
- Add rate limiting and request validation middleware.
- Introduce role/permission management UI.
