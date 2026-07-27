# 🍳 RestaurantOS — Restaurant Operating System & Payment Enclave

> A lightweight restaurant operations suite with static frontend billing plus an optional Supabase-backed Express API.

[![License-MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20ES6+-orange?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Supabase DB](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Supabase-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)

---

## Overview

RestaurantOS is a browser-first restaurant management experience that combines:

- static checkout/payment enclave UI,
- waiter-facing POS terminal,
- kitchen display workflow,
- authentication and menu APIs,
- Supabase integration for data storage and role-based access.

The frontend is built with pure HTML, CSS, and Vanilla ES6+ JavaScript. The optional backend server is implemented in Express and lives under `server/`.

---

## Key Capabilities

- Payment enclave with card visualization, brand detection, local Luhn validation, and 3DS-style OTP flow
- POS interface with table selection, order cart, tax calculation, and kitchen dispatch
- Kitchen Display System (KDS) with order status tracking and chef workflow
- Supabase-backed menu and auth service for users, roles, and protected endpoints
- Google OAuth and identity integration support
- Environment config sample in `.env.example`

---

## Repository Structure

```
RestaurantOS/
├── .env.example                # Environment configuration template
├── .gitignore                  # Git exclusion rules for node_modules & secrets
├── index.html                  # Frontend payment enclave landing page
├── package.json                # Frontend npm scripts and dependency manifest
├── README.md                   # Project documentation
├── server/                     # Express backend API server
│   ├── Dockerfile             # Optional backend container setup
│   ├── index.js               # Express server entrypoint and API routes
│   └── package.json           # Backend dependencies and scripts
└── src/
    ├── app.js                  # Main frontend application logic
    ├── controllers/            # Frontend controllers for POS and KDS
    ├── db/                     # SQL schema and seed files
    ├── services/               # Frontend service utilities and data clients
    ├── styles/                 # CSS stylesheets and token definitions
    └── views/                  # HTML view templates for app modules
```

---

## Local Setup

### Frontend only

```bash
cd RestaurantOS
npm install
npm run dev
```

Open `http://localhost:3000`.

### Full stack with backend

```bash
cd RestaurantOS/server
npm install
cd ..
cp .env.example .env
```

Update `.env` values for:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GEMINI_API_KEY`

Start the backend API:

```bash
cd server
npm run dev
```

The backend listens on `http://localhost:4000` by default.

---

## Backend API Overview

The Express server includes:

- `/api/health` — service and database health check
- `/api/auth/signup` — create an account
- `/api/auth/signin` — sign in with email/password
- `/api/auth/signout` — sign out
- `/api/auth/me` — get profile data
- `/api/auth/me/role` — manager-only role updates
- `/api/menu` — public menu fetch
- manager-only endpoints for menu item CRUD

Auth middleware enforces JWT-based Supabase authentication and role-based access control.

---

## Environment Variables

Copy `.env.example` to `.env` and configure your environment. Key settings include:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GEMINI_API_KEY`
- `PAYMENT_MODE`

---

## Notes

- The frontend can run standalone as a static site.
- The backend is optional but enables API-based auth, protected routes, and server-managed menu operations.
- Database schema files and sample seeds are available in `src/db/`.
- Please note : Codes to access different modes: Waiter(2345) Manager(1234) Kitchen(3456)

---

## License

MIT License. See `LICENSE`.
