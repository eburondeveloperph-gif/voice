<![CDATA[<p align="center">
  <img src="public/icon-eburon.svg" alt="Eburon Logo" width="120" />
</p>

<h1 align="center">Eburon Voice CSR Dashboard</h1>

<p align="center">
  <strong>Enterprise-grade Customer Service Representative agent builder powered by <a href="https://vapi.ai">Vapi AI</a></strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#vapi-integration">Vapi Integration</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#license">License</a>
</p>

---

## Overview

Eburon Voice CSR Dashboard is a multi-tenant, white-label voice agent builder that enables organizations to create, preview, and deploy AI-powered customer service agents. Built on top of **Vapi AI** as the voice intelligence engine, Eburon wraps Vapi's capabilities behind a secure, auditable gateway — giving teams a streamlined, brand-safe interface for agent management.

> **White-labeling Vapi under Eburon** — All Vapi API interactions are server-side only. End users see Eburon branding exclusively; no Vapi keys or endpoints are ever exposed to the browser.

---

## Features

| Area | What it does |
|---|---|
| **Agent Builder** | Create agents with name, first message, Skills and Description, and voice — nothing more, nothing less. Keeps the UX focused. |
| **Voice Catalog** | Curated, approved voice list synced from Vapi. Admins control which voices are available to builders. |
| **Browser Preview** | In-browser voice call test panel via `@vapi-ai/web`. Start a live conversation with your agent before deploying. |
| **One-Click Deploy** | Attach an agent to a phone number and persist the mapping for production inbound/outbound calls. |
| **Multi-Tenant** | `Org → Users → Agents → Calls → Contacts → Billing` hierarchy with full data isolation. |
| **Call Management** | Outbound calls, bulk dialing, call log sync, and real-time call status tracking. |
| **Phone Numbers** | Purchase, assign, and manage phone numbers with integrated billing ledger. |
| **Contact Book** | Centralized contact management per organization. |
| **Client CRM Portals** | Create project-specific CRM workspaces at `/<client-project-name>` with Supabase email login, lead pipeline, and file uploads. |
| **Audit Trail** | Every gateway operation is logged with action, org, resource, method, status, and timestamp. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Client)                    │
│                                                         │
│   Next.js App Router UI        @vapi-ai/web (preview)   │
│         │                            │                  │
│         │  fetch /api/ev/*           │ WebRTC           │
│         ▼                            ▼                  │
├─────────────────────────────────────────────────────────┤
│              Eburon Voice Gateway (EV)                  │
│                                                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │
│  │  CORS &  │  │   Rate    │  │    Audit Logger      │  │
│  │  Origin  │→ │  Limiter  │→ │  (per-action log)    │  │
│  │ Allowlist│  │ (user/org)│  │                      │  │
│  └──────────┘  └───────────┘  └──────────────────────┘  │
│         │                                               │
│         ▼                                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │            Server-Side Vapi Client                 │  │
│  │    (EV_PRIVATE_TOKEN — never sent to browser)      │  │
│  └────────────────────────────────────────────────────┘  │
│         │                            │                  │
│         ▼                            ▼                  │
│  ┌──────────────┐          ┌──────────────────┐         │
│  │  Prisma ORM  │          │   Vapi REST API  │         │
│  │  (SQLite)    │          │   (upstream)      │         │
│  └──────────────┘          └──────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Strict Gateway Pattern** — The browser never talks to Vapi directly (except WebRTC for preview). All CRUD operations go through `/api/ev/*` server routes.
- **Origin Allowlist** — `EV_ALLOWED_ORIGINS` controls which domains can hit the gateway.
- **Rate Limiting** — Per-user and per-org limits prevent abuse. Failed requests are tracked and auto-throttled.
- **Tenant Isolation** — Every query is scoped to the authenticated org. Cross-tenant access is impossible by design.

---

## Vapi Integration

Eburon is a **whitelisted Vapi partner application**. Here's how the integration works:

### Authentication Flow

| Token | Scope | Stored Where |
|---|---|---|
| `EV_PRIVATE_TOKEN` | Full Vapi API access (server-side) | `.env` — **never** exposed to client |
| `NEXT_PUBLIC_EV_WEB_KEY` | Browser WebRTC preview sessions only | `.env` — embedded in client bundle for preview calls |

### Whitelisted Vapi Operations

Eburon uses the following Vapi API capabilities through its gateway:

| Vapi Capability | Eburon Gateway Route | Purpose |
|---|---|---|
| Create Assistant | `POST /api/ev/voice/agents` | Build a new voice agent |
| Update Assistant | `PATCH /api/ev/voice/agents/:id` | Edit agent config |
| List Assistants | `GET /api/ev/voice/agents` | Agent inventory |
| Create Call | `POST /api/ev/voice/calls` | Outbound dialing |
| List Calls | `GET /api/ev/voice/calls` | Call log sync |
| Sync Call Logs | `POST /api/ev/voice/calls/sync` | Batch call history import |
| Outbound Call | `POST /api/ev/voice/calls/outbound` | Direct outbound call trigger |
| List Voices | `GET /api/ev/voice/voices` | Voice catalog browsing |
| Sync Voices | `POST /api/ev/voice/voices/sync` | Refresh voice catalog from Vapi |
| List Phone Numbers | `GET /api/ev/voice/phone-numbers` | Number inventory |
| Create Phone Number | `POST /api/ev/voice/phone-numbers` | Purchase new number |
| Session Config | `GET /api/ev/voice/session-config` | Public key for browser preview |
| Webhooks | `POST /api/ev/voice/webhooks` | Receive Vapi event callbacks |
| Preview Sessions | `PATCH /api/ev/voice/preview-sessions/:id` | Update live preview state |

### Browser Preview (WebRTC)

The `@vapi-ai/web` SDK connects directly to Vapi's WebRTC infrastructure using the public web key (`NEXT_PUBLIC_EV_WEB_KEY`). This is the **only** client-side Vapi interaction — it's read-only and scoped to ephemeral preview sessions.

```typescript
// Browser preview flow (simplified)
import Vapi from "@vapi-ai/web";

const vapi = new Vapi(process.env.NEXT_PUBLIC_EV_WEB_KEY);
vapi.start({ assistantId: agent.vapiAssistantId });
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js](https://nextjs.org) 16 (App Router) |
| **Language** | TypeScript 5 |
| **UI** | React 19, CSS Modules |
| **ORM** | [Prisma](https://www.prisma.io) 7 with SQLite adapter |
| **Database** | SQLite (`dev.db` for dev, swap for Turso/Postgres in prod) |
| **Voice SDK** | [`@vapi-ai/web`](https://www.npmjs.com/package/@vapi-ai/web) 2.x |
| **Validation** | [Zod](https://zod.dev) 4 |
| **Date Utils** | [date-fns](https://date-fns.org) 4 |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A [Vapi](https://vapi.ai) account with API keys

### 1. Clone the Repository

```bash
git clone https://github.com/eburondeveloperph-gif/eburon-app.git
cd eburon-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required — Vapi private API key (server-side only)
EV_PRIVATE_TOKEN="your-vapi-private-key"

# Required — Vapi public web key (for browser preview)
NEXT_PUBLIC_EV_WEB_KEY="your-vapi-web-key"

# Optional — Vapi webhook verification secret
EV_WEBHOOK_SECRET=""

# Gateway security
EV_ALLOWED_ORIGINS="http://localhost:3000,https://vapi.ai,https://dashboard.vapi.ai"

# Tenant defaults
EV_DEFAULT_ORG_SLUG="eburon-demo"
EV_DEFAULT_ORG_NAME="Eburon Demo"
EV_DEFAULT_USER_EMAIL="owner@eburon.local"

# Rate limiting
EV_RATE_LIMIT_USER_PER_MINUTE="60"
EV_RATE_LIMIT_ORG_PER_MINUTE="300"
EV_RATE_LIMIT_FAILED_PER_10_MIN="30"

# Supabase Backup (optional — data mirrors to cloud when set)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_STORAGE_BUCKET="crm-assets"

# Preview timeout (seconds)
EV_PREVIEW_TIMEOUT_SECONDS="900"

# App URL used for generated CRM portal links
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

For CRM Supabase tables, run:

```bash
psql "$SUPABASE_DB_URL" -f scripts/supabase_crm.sql
```

Also create the storage bucket configured in `SUPABASE_STORAGE_BUCKET` (default `crm-assets`).

### 4. Initialize Database

```bash
npm run db:reset
```

This creates the SQLite database, runs migrations, and seeds default org/user data.

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### 6. Verify Build

```bash
npm run lint
npm run build
```

---

## API Reference

All API routes live under `/api/ev/voice/`. Every request passes through the gateway middleware stack:

```
Request → CORS check → Origin allowlist → Rate limiter → Tenant resolver → Handler → Audit log
```

### Agents

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ev/voice/agents` | Create a new agent |
| `PATCH` | `/api/ev/voice/agents/:id` | Update agent configuration |
| `GET` | `/api/ev/voice/agents` | List all agents for the org |
| `POST` | `/api/ev/voice/agents/:id/deploy` | Deploy agent to a phone number |

### Calls

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ev/voice/calls` | Create a call |
| `GET` | `/api/ev/voice/calls` | List call logs |
| `POST` | `/api/ev/voice/calls/sync` | Sync call history from Vapi |
| `POST` | `/api/ev/voice/calls/outbound` | Trigger outbound call |

### Voices

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ev/voice/voices` | List approved voice catalog |
| `POST` | `/api/ev/voice/voices/sync` | Sync voices from Vapi |

### Phone Numbers

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ev/voice/phone-numbers` | List assigned numbers |
| `POST` | `/api/ev/voice/phone-numbers` | Purchase a new number ($15/mo) |

### Sessions & Webhooks

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/ev/voice/session-config` | Get public key for browser preview |
| `POST` | `/api/ev/voice/webhooks` | Receive Vapi event callbacks |
| `PATCH` | `/api/ev/voice/preview-sessions/:id` | Update preview session state |

### Backup

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ev/backup/sync` | Bulk sync all SQLite data to Supabase |

---

## Dashboard Sections

| Section | Route | Description |
|---|---|---|
| **Dashboard** | `/dashboard` | Overview and metrics |
| **Create** | `/create` | Agent builder wizard |
| **Agents** | `/agents` | Agent management |
| **Voices** | `/voices` | Voice catalog browser |
| **Dialer** | `/dialer` | Outbound call interface |
| **Bulk Calls** | `/calls/bulk` | Bulk call campaigns |
| **Call Logs** | `/call-logs` | Call history and analytics |
| **Contacts** | `/contacts` | Contact management |
| **Numbers** | `/numbers` | Phone number management |
| **Settings** | `/settings` | Organization settings |

---

## Data Model

```
Org
 ├── User
 │    └── Agent
 │         ├── Call
 │         ├── PreviewSession
 │         └── PhoneNumber (assignment)
 ├── Contact
 ├── VoiceCatalog
 ├── BillingLedger
 └── GatewayAuditLog
```

---

## Supabase Backup

Eburon includes an optional **cloud backup layer** powered by [Supabase](https://supabase.com). When `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured, every write operation (agents, calls, voices, contacts) is mirrored to Supabase in a **fire-and-forget** pattern — meaning primary operations are never slowed or blocked by backup failures.

### How It Works

1. **Primary write** happens via Prisma → SQLite (always)
2. **Backup write** fires asynchronously to Supabase (when configured)
3. If Supabase is down or misconfigured, a warning is logged but the operation succeeds normally

### Supabase Tables

Create these tables in your Supabase project (SQL Editor):

| Table | Key Columns |
|---|---|
| `orgs` | `id`, `name`, `slug`, `created_at`, `updated_at` |
| `agents` | `id`, `org_id`, `name`, `intro`, `system_prompt`, `voice_id`, `vapi_assistant_id`, `status` |
| `call_logs` | `id`, `org_id`, `vapi_call_id`, `from_number`, `to_number`, `status`, `direction`, `transcript` |
| `voice_catalog` | `id`, `label`, `locale`, `upstream_provider`, `upstream_voice_id`, `is_approved` |
| `contacts` | `id`, `org_id`, `full_name`, `phone_number`, `email`, `tags` |

### Bulk Sync

To populate Supabase with all existing data, trigger a one-time bulk sync:

```bash
curl -X POST http://localhost:3000/api/ev/backup/sync
```

Response:
```json
{
  "ok": true,
  "synced": { "orgs": 1, "agents": 5, "callLogs": 42, "voices": 18, "contacts": 10 },
  "timestamp": "2026-02-20T08:17:00.000Z"
}
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import into [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. For production databases, swap SQLite for [Turso](https://turso.tech) or Postgres via Prisma adapter

### Self-Hosted

```bash
npm run build
npm start
```

Ensure `EV_ALLOWED_ORIGINS` includes your production domain.

---

## Security

- **Server-side secrets** — `EV_PRIVATE_TOKEN` never leaves the server. All Vapi API calls are proxied.
- **Origin allowlist** — Only whitelisted domains can access gateway endpoints.
- **Rate limiting** — Three-tier protection: per-user, per-org, and abuse detection.
- **Audit logging** — Every gateway operation is recorded with full context.
- **Tenant isolation** — All data queries are scoped to the authenticated organization.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is proprietary software developed by **Eburon Developer PH**.  


<p align="center">
  <sub>Built with ❤️ by <strong>Eburon Developer PH
