# 🍳 RestaurantOS — Restaurant Operating System & Payment Enclave

> A modern restaurant operations platform with customer ordering, POS workflow, kitchen dispatch, authentication, and manager analytics.

[![License-MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Vanilla JS](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20ES6+-orange?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Supabase DB](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Supabase-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)

---

## Project Summary

- Team Name: **Team RestaurantOS**
- Hosted Application Link: **https://restaurant-os-woad.vercel.app**
- Tech Stack:
  - Frontend: HTML5, CSS3, Vanilla ES6 JavaScript
  - Backend: Node.js, Express
  - Database/Auth: Supabase / PostgreSQL
  - Authentication: Email OTP verification, Google OAuth, role-based access
  - Deployment: Render / Vercel-compatible static frontend

---

## User Stories Completed

### Bronze Level – User Experience
- User Story 1: Designed a modern, intuitive interface for customers and restaurant staff.
- Customer-facing views include menu browsing, checkout, queue status, and payment.
- Restaurant staff views include POS, kitchen display, queue management, and management analytics.
- The solution clearly demonstrates how technology improves the dining experience with live order updates, table assignments, and checkout guidance.

### Silver Level – Authentication & Digital Operations
- User Story 2: Implemented secure authentication with email/password OTP and Google OAuth.
- Role-based access is enforced for Customer, Waiter, Kitchen, and Manager workflows.
- User Story 3: Digitized core restaurant workflows including digital menu, live availability state, order management, queue handling, billing, and customer notifications.
- The app supports menu browsing, order dispatch, payment sessions, kitchen ticketing, and waiter task tracking.

### Gold Level – Restaurant Management
- User Story 4: Built a management dashboard for staff to manage daily operations.
- Dashboard capabilities include orders, tables, inventory, staff presence, customers, revenue, and analytics insights.
- The management view reduces manual effort through digital order routing, inventory state, and role-specific pages.

> Platinum Level – User Story 5 was intentionally excluded as intelligent features were not implemented for this version.

---

## AI Usage

- The codebase includes a `GeminiService` module for smart menu pairing recommendations and revenue insight messaging.
- This implementation currently provides simulated AI-style suggestions and executive insight samples.
- No live demand forecasting or advanced AI-powered decision-making features are included in the shipped product.

---

## Overview

RestaurantOS is a browser-first restaurant management experience that combines:

- customer ordering and payment enclave,
- waiter-facing POS terminal,
- kitchen display workflow,
- authentication and Supabase-backed menu/auth APIs,
- manager analytics and role-based access.

The frontend uses pure HTML, CSS, and Vanilla ES6 JavaScript. The optional backend server is implemented in Express and lives under `server/`.

---

## Key Capabilities

- Payment enclave with card visualization, brand detection, local Luhn validation, and OTP flow
- POS interface with table selection, order cart, tax calculation, and kitchen dispatch
- Kitchen Display System (KDS) with order status tracking and chef workflow
- Supabase-backed menu and auth service for users, roles, and protected endpoints
- Google OAuth and email OTP authentication support
- Simulated AI recommendations for food pairings and revenue insights
- Live queue and session management for waiter and kitchen staff

---

## Repository Structure

```
RestaurantOS/
├── .env.example                # Environment configuration template
├── .gitignore                  # Git exclusion rules for node_modules & secrets
├── index.html                  # Frontend payment enclave landing page
├── package.json                # Frontend npm scripts and dependency manifest
├── README.md                   # Project documentation
├── render.yaml                 # Render deployment configuration
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
- `SUPABASE_ANON_KEY` (client safe ONLY IF RLS is enforced)
- `SUPABASE_SERVICE_ROLE_KEY` (SERVER SIDE ONLY)
- `STRIPE_PUBLISHABLE_KEY` & `STRIPE_SECRET_KEY` (SERVER SIDE ONLY for secret key)
- `GOOGLE_CLIENT_ID`
- `GEMINI_API_KEY`
- `PAYMENT_MODE`

> [!WARNING]
> **SECURITY & SECRET ROTATION NOTICE**
> If any API keys, Supabase credentials, or OAuth IDs were previously hardcoded in earlier repository commits, those values remain visible in Git commit history.
> **Mandatory Action**: Immediately rotate any previously committed Supabase API keys, Service Role Keys, Google OAuth Client IDs, and third-party API credentials in your respective provider dashboards. Always keep `.env` in `.gitignore` and consume secrets exclusively through environment variables.


---

## Notes

- The frontend can run standalone as a static site.
- The backend is optional but enables API-based auth, protected routes, and server-managed menu operations.
- Database schema files and sample seeds are available in `src/db/`.
- Please note : Codes to access different modes: Waiter(2345) Manager(1234) Kitchen(3456)

---

## License

MIT License. See `LICENSE`.

---

## Team Attribution

- Team members: Amritanshu Shaw, Ritam Karmakar, Saptak Sarathi Chakraborty
- Team lead: Shrinivas Ghosh
- Made by HexCore
