# LingoAgent

> Autonomous AI agent pipeline that clones Next.js repositories, extracts hardcoded JSX strings via Babel AST, translates them with Lingo.dev, and opens a pull request with a live Vercel preview.

**🌍 Live Application:** [lingo-agent.vercel.app](https://lingo-agent.vercel.app) &nbsp;|&nbsp; **⚙️ API Docs (Swagger):** [lingo-agent.onrender.com/docs](https://lingo-agent.onrender.com/docs) &nbsp;|&nbsp; **🩺 API Health:** [lingo-agent.onrender.com/api/health](https://lingo-agent.onrender.com/api/health)

---

## Table of Contents

- [Overview](#overview)
- [The Orchestration Gap](#the-orchestration-gap)
- [Architecture](#architecture)
  - [System Architecture](#system-architecture)
  - [Data & Event Flow](#data--event-flow)
- [Authentication Flow](#authentication-flow)
- [AI Agent Pipeline](#ai-agent-pipeline)
  - [The 7-Step Tool Sequence](#the-7-step-tool-sequence)
  - [Runtime Translation Strategy](#runtime-translation-strategy)
  - [Resilience and Error Handling](#resilience-and-error-handling)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Server Setup](#2-server-setup)
  - [3. Client Setup](#3-client-setup)
- [Environment Variables](#environment-variables)
  - [Server (`server/.env`)](#server-serverenv)
  - [Client (`client/.env`)](#client-clientenv)
- [Known Limitations](#known-limitations)
- [Demo](#demo)
  - [Video Walkthrough](#video-walkthrough)
  - [Demo Repository](#demo-repository)
- [Author & License](#author--license)

---

## Overview

LingoAgent is a full-stack AI agent built specifically for **Next.js 14+ App Router** landing pages and web applications. Given a GitHub repository URL and a list of target languages, LingoAgent executes an automated localization pipeline:

1. Clones the target repository into an isolated cloud sandbox (E2B).
2. Inspects project structure, routing conventions, and dependencies.
3. Extracts translatable JSX text nodes and attribute strings (`placeholder`, `title`, `alt`, `aria-label`, `label`) using a Babel AST parser.
4. Translates extracted strings across selected locales using the Lingo.dev SDK.
5. Injects a self-contained runtime language switcher and context provider into the root layout (`layout.tsx`).
6. Commits changes atomically to a dedicated Git branch and opens a GitHub Pull Request via the Octokit REST API.
7. Triggers and monitors a Vercel preview deployment, streaming real-time logs back to the user via Server-Sent Events (SSE).

---

## The Orchestration Gap

AI translation services have lowered the friction of language translation. However, integrating internationalization into an existing codebase remains an orchestration bottleneck requiring multiple manual steps:

- Reading library documentation and configuring locale routing.
- Finding and extracting hardcoded text across dozens of UI components.
- Maintaining separate dictionary and translation resource files.
- Modifying root layouts and injecting context providers.
- Creating branches, pushing changes, opening pull requests, and validating builds.

LingoAgent closes this gap by combining an LLM planner with deterministic tools running inside an isolated sandbox environment.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          The Orchestration Gap                         │
│                                                                        │
│   "We want multilingual support" ──▶ [ Manual Work: 3-5 hours ]        │
│                                      - Babel AST string extraction     │
│                                      - Locale dictionary scaffolding   │
│                                      - Root layout & context injection │
│                                      - Git branching & PR creation     │
│                                      - Vercel preview deployment       │
│                                                                        │
│   With LingoAgent ───────────────▶ [ Automated Run: ~3 minutes ]       │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Design Principles

1. **Deterministic Execution over Free-form Agent Actions:** The LLM acts as a planner selecting parameters; tool execution is strictly orchestrated by the NestJS backend.
2. **Process Isolation:** All repository inspection, npm installation, AST extraction, and file modifications execute within a throwaway E2B cloud micro-VM.
3. **Full Visibility:** Every step emits structured log events streamed over HTTP Server-Sent Events (SSE) to the frontend dashboard.
4. **Resilient Fallbacks:** If Babel AST dynamic loading fails inside a repository, the pipeline falls back to a regex text scanner to ensure translation continuity.

---

## Architecture

The system is structured as a decoupled monorepo containing a Next.js 14 frontend (`/client`) and a NestJS 11 backend (`/server`).

### System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                          Browser (User)                         │
│                                                                 │
│   Next.js 14 App Router Client (:3000 / Vercel)                 │
│   ├── /login           (GitHub OAuth via NextAuth.js)           │
│   ├── /dashboard       (Job submission, history, API keys)      │
│   └── /jobs/[jobId]    (Real-time log stream & result card)     │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 │ HTTP REST (JSON) + SSE (text/event-stream)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NestJS API Server (:3001 / Render)           │
│                                                                 │
│   ├── Global Prefix: /api                                       │
│   ├── Swagger OpenAPI: /docs                                    │
│   ├── AuthGuard: Bearer token validation (GitHub OAuth token)   │
│   ├── AgentController & AgentService                            │
│   ├── JobsService (Prisma ORM 7)                                │
│   └── Per-Job SSE Broker (RxJS ReplaySubject)                   │
└───────┬────────────────┬────────────────┬────────────────┬──────┘
        │                │                │                │
        ▼                ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Neon Cloud  │ │  E2B Cloud   │ │  Groq Cloud  │ │  External    │
│  PostgreSQL  │ │  Sandbox     │ │  LLM Engine  │ │  Services    │
│              │ │              │ │              │ │              │
│  - Job state │ │  - git clone │ │  - Llama 3.3 │ │  - Lingo.dev │
│  - Log cache │ │  - Babel AST │ │    70B tool  │ │    SDK & MCP │
│  - Run URLs  │ │  - i18n run  │ │    planner   │ │  - GitHub API│
│              │ │  - Isolated  │ │              │ │  - Vercel API│
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Data & Event Flow

```text
User Submits Job (Repo URL + Target Locales)
  │
  ├── 1. POST /api/agent/run ──▶ Backend creates Job record in PostgreSQL (status: 'pending')
  │                               Returns jobId immediately to client
  │
  ├── 2. Frontend opens GET /api/agent/stream/:jobId (SSE connection)
  │      Backend subscribes client to an RxJS ReplaySubject (replays prior logs if reconnected)
  │
  ├── 3. Backend triggers AgentService.runPipeline() asynchronously:
  │      - Prompts Groq (Llama 3.3 70B) with tool schemas sequentially
  │      - Manually executes selected tools against E2B Sandbox, GitHub, or Vercel
  │      - Streams progress and log entries to SSE subject
  │
  └── 4. Pipeline completes:
         - Backend persists final status ('completed' or 'failed') and logs to PostgreSQL
         - SSE emits { type: 'complete', data: { prUrl, previewUrl } }
         - Frontend renders live Pull Request and Vercel preview links with confetti feedback
```

---

## Authentication Flow

Authentication relies on GitHub OAuth via NextAuth.js. The issued GitHub access token serves a dual purpose: client session authentication and backend GitHub API authorization.

```text
User                  Next.js Client             NextAuth.js              GitHub OAuth
 │                          │                         │                         │
 ├── 1. Clicks "Sign in" ──▶│                         │                         │
 │                          ├── 2. GET /api/auth ────▶│                         │
 │                          │      /signin/github     ├── 3. OAuth redirect ───▶│
 │                          │                         │                         │
 │                          │                         │◀── 4. Callback w/ code ─┤
 │                          │                         ├── 5. Exchange code ────▶│
 │                          │                         │◀── 6. Access token ─────┤
 │                          │◀── 7. Session created ──┤                         │
 │                          │   (JWT stores token)    ┴                         ┴
 │                          │
 ├── 8. Submits Job ───────▶│
 │                          │
 │                          ├── 9. POST /api/agent/run ─────────────────────────┐
 │                          │      Headers: Bearer <githubToken>                │
 │                          │                                                   ▼
 │                          │                                       ┌───────────────────────┐
 │                          │                                       │   NestJS AuthGuard    │
 │                          │                                       │   - Validates token   │
 │                          │                                       │   - Passes to Octokit │
 │                          │                                       │     for PR creation   │
 ┴                          ┴                                       └───────────────────────┘
```

No separate user database or custom credentials store is required on the backend.

---

## AI Agent Pipeline

### The 7-Step Tool Sequence

The pipeline executes a strictly sequential 7-tool progression. To avoid hallucination, tool misordering, and LLM HTTP timeouts during long operations, the Groq LLM is presented with only **one tool schema at a time** (`toolChoice: 'required'`). The server receives the tool call parameters and executes the underlying service call outside the LLM request loop.

```text
  1. clone_repo
     │ Clones repository via git inside a fresh E2B micro-VM sandbox.
     ▼
  2. detect_framework
     │ Inspects package.json, directory structure, App Router paths, and layout.tsx location.
     ▼
  3. analyze_repo
     │ Checks for existing i18n configurations and inventories .tsx / .jsx files.
     ▼
  4. setup_lingo
     │ Queries Lingo.dev MCP server for scaffolding instructions.
     │ Writes i18n.json configuration.
     │ Generates zero-dependency runtime: provider.tsx, switcher.tsx, text-translator.tsx.
     │ Injects LanguageProvider and LanguageSwitcher into root layout.tsx.
     ▼
  5. install_and_translate
     │ Runs npm install --legacy-peer-deps inside sandbox.
     │ Executes Babel AST script traversing JSX elements and attributes.
     │ Batches text strings and sends to Lingo.dev SDK (batchTranslate).
     │ Writes translated bundles to public/locales/<locale>.json.
     ▼
  6. commit_and_push
     │ Reads modified files from sandbox.
     │ Creates Git branch (lingo/add-multilingual-<timestamp>).
     │ Creates Git blobs, tree, and commit atomically via GitHub Git Data API.
     │ Opens ready-to-merge Pull Request with change summary and word count metrics.
     ▼
  7. trigger_preview
     │ Calls Vercel Deployments API for the newly created branch.
     │ Polls deployment status every 10 seconds until ready.
     ▼
  Complete (Emits PR URL and live Vercel Preview URL via SSE)
```

### Runtime Translation Strategy

Earlier builds evaluated `@lingo.dev/compiler` at build time. However, due to packaging constraints in downstream compiler plugins, LingoAgent implements a self-contained runtime architecture:

1. **Extraction (Build Step):** AST parsing locates JSX text nodes and translatable attributes (`placeholder`, `title`, `alt`, `aria-label`, `label`, `aria-placeholder`, `aria-description`, `content`).
2. **Translation Storage:** Translations are stored as static JSON files in `public/locales/<locale>.json`.
3. **Runtime Switching:** A lightweight `LanguageProvider` React Context and `TextTranslator` DOM mutation observer update the page content dynamically without requiring full page reloads or third-party runtime dependencies.

### Resilience and Error Handling

- **Rate Limits & API Keys:** If the default Groq or Lingo.dev API keys exceed rate limits, the pipeline halts gracefully and instructs the user to configure custom keys in `Dashboard → Settings`. Custom keys are stored in browser `localStorage` and sent per-job.
- **AST Fallback:** If `@babel/parser` cannot be imported dynamically from the target project's `node_modules`, the extractor falls back to a regex scanner.
- **Sandbox Termination:** When a job completes, fails, or is cancelled via `POST /api/agent/cancel/:jobId`, the backend immediately terminates the E2B sandbox instance to prevent dangling compute resources.

---

## Tech Stack

### Frontend (`/client`)

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14.2.14 | React framework (App Router architecture) |
| React | 18.2.0 | User interface library |
| TypeScript | 5.5.4 | Static type safety |
| Tailwind CSS | 3.4.13 | Utility-first styling with custom glassmorphism effects |
| NextAuth.js | 4.24.13 | GitHub OAuth authentication and session management |

### Backend (`/server`)

| Technology | Version | Purpose |
|---|---|---|
| NestJS | 11.0.1 | Modular TypeScript API server |
| Prisma ORM | 7.4.1 | Schema modeling, migrations, and database access |
| PostgreSQL (Neon) | Serverless | Persistent storage for jobs, logs, and deployment URLs |
| Vercel AI SDK (`ai`) | 6.0.96 | Unified interface for LLM tool calling and text generation |
| `@ai-sdk/groq` | 3.0.24 | Groq provider integration for Llama 3.3 70B inference |
| E2B Sandbox SDK | 2.12.1 | Isolated cloud VM execution environment |
| Lingo.dev SDK | 0.131.7 | Batch translation engine |
| Model Context Protocol (`@modelcontextprotocol/sdk`) | 1.26.0 | Client for Lingo.dev MCP setup instruction server |
| Octokit (`@octokit/rest`) | 22.0.1 | GitHub REST API client for branch, commit, and PR management |
| RxJS | 7.8.1 | Event streaming via `ReplaySubject` for SSE connections |
| Swagger (`@nestjs/swagger`) | 11.2.6 | OpenAPI specification and interactive documentation |
| Zod & class-validator | 4.x / 0.14 | Schema definitions and runtime HTTP DTO validation |

---

## Project Structure

```text
lingo-agent/
├── client/                              # Next.js 14 Frontend
│   ├── app/
│   │   ├── api/auth/[...nextauth]/      # NextAuth GitHub provider route
│   │   ├── dashboard/                   # Main dashboard (forms, history, settings)
│   │   ├── jobs/[jobId]/                # Live log stream & result view
│   │   ├── login/                       # GitHub OAuth login page
│   │   ├── globals.css                  # Tailwind styles & custom animations
│   │   ├── layout.tsx                   # Root client layout
│   │   └── page.tsx                     # Route guard & redirect
│   ├── components/                      # UI components (stepper, forms, cards)
│   ├── hooks/                           # Custom hooks (useJobStream, useSettings)
│   ├── lib/                             # API clients, constants, authOptions
│   └── types/                           # TypeScript declarations
│
├── server/                              # NestJS 11 API Backend
│   ├── prisma/
│   │   ├── migrations/                  # SQL migration history
│   │   └── schema.prisma                # Job data model & JobStatus enum
│   ├── src/
│   │   ├── agent/                       # Core orchestration engine
│   │   │   ├── dto/                     # StartJobDto, JobResponseDto
│   │   │   ├── prompts/                 # System prompt definitions
│   │   │   ├── tools/                   # 7 sequential tool implementations
│   │   │   ├── agent.controller.ts      # REST & SSE endpoints (/api/agent/*)
│   │   │   └── agent.service.ts         # Pipeline execution loop
│   │   ├── auth/                        # Bearer token AuthGuard
│   │   ├── common/                      # Exception filters, utils, types
│   │   ├── github/                      # Octokit integration service
│   │   ├── jobs/                        # Prisma jobs repository service
│   │   ├── mcp/                         # Lingo.dev MCP client service
│   │   ├── sandbox/                     # E2B cloud sandbox manager
│   │   ├── vercel/                      # Vercel deployment trigger & polling
│   │   ├── health.controller.ts         # GET /api/health endpoint
│   │   ├── app.module.ts                # Root application module
│   │   └── main.ts                      # NestJS bootstrap, CORS, validation, Swagger
│   ├── prisma.config.ts                 # Prisma configuration file
│   └── package.json                     # Server dependencies and scripts
│
└── README.md
```

---

## API Reference

The server exposes a REST API with global prefix `/api` and an interactive Swagger UI at `/docs`.

### Authentication
Protected endpoints require a GitHub personal access token passed in the `Authorization` header:
```text
Authorization: Bearer <github_personal_access_token>
```

### Endpoints

#### 1. Start Job
```http
POST /api/agent/run
Content-Type: application/json
Authorization: Bearer <githubToken>

{
  "repoUrl": "https://github.com/owner/repo",
  "locales": ["ja", "fr", "ar"],
  "githubToken": "ghp_...",
  "lingoApiKey": "optional_custom_key",
  "groqApiKey": "optional_custom_key"
}
```
**Response (`201 Created`):**
```json
{
  "jobId": "f2a89342-83b1-4c17-9104-e3c79a4de54a"
}
```

#### 2. Stream Job Events (SSE)
```http
GET /api/agent/stream/:jobId
Accept: text/event-stream
```
Emits real-time SSE events:
- `log`: Raw execution and step progress logs.
- `complete`: Final job payload containing `prUrl` and `previewUrl`.
- `error`: Failure details with contextual step identifier.

#### 3. Get Job Status
```http
GET /api/agent/job/:jobId
Authorization: Bearer <githubToken>
```
**Response (`200 OK`):**
```json
{
  "id": "f2a89342-83b1-4c17-9104-e3c79a4de54a",
  "repoUrl": "https://github.com/owner/repo",
  "locales": ["ja", "fr", "ar"],
  "status": "completed",
  "prUrl": "https://github.com/owner/repo/pull/1",
  "previewUrl": "https://repo-preview.vercel.app",
  "error": null,
  "createdAt": "2026-09-12T12:00:00.000Z",
  "updatedAt": "2026-09-12T12:02:45.000Z"
}
```

#### 4. Cancel Running Job
```http
POST /api/agent/cancel/:jobId
Authorization: Bearer <githubToken>
```
**Response (`200 OK`):**
```json
{
  "message": "Job cancelled"
}
```

#### 5. Health Check
```http
GET /api/health
```
**Response (`200 OK`):**
```json
{
  "status": "ok",
  "timestamp": "2026-09-12T17:08:22.000Z",
  "uptime": 1842.12
}
```

---

## Database Schema

Database management is handled by Prisma ORM connecting to a Neon PostgreSQL database.

```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}

enum JobStatus {
  pending
  running
  completed
  failed
  cancelled
}

model Job {
  id         String    @id @default(uuid())
  repoUrl    String
  locales    String[]
  status     JobStatus @default(pending)
  prUrl      String?
  previewUrl String?
  error      String?
  logs       Json      @default("[]")
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **PostgreSQL**: Neon serverless connection string or local PostgreSQL instance
- **API Accounts**:
  - [GitHub OAuth App](https://github.com/settings/developers)
  - [Groq Cloud Console](https://console.groq.com/keys) (Llama 3.3 70B)
  - [E2B](https://e2b.dev) (Micro-VM sandbox)
  - [Lingo.dev](https://lingo.dev/en/app) (Translation SDK key)
  - [Vercel](https://vercel.com/account/tokens) (Personal Access Token)

---

### 1. Clone Repository

```bash
git clone https://github.com/Kashif-Rezwi/lingo-agent.git
cd lingo-agent
```

---

### 2. Server Setup

```bash
cd server

# Copy environment configuration
cp .env.example .env
# Edit server/.env with your API credentials

# Install dependencies
npm install

# Push Prisma schema to database and generate client
npx prisma db push
npx prisma generate

# Start server in watch mode (:3001)
npm run start:dev
```

---

### 3. Client Setup

In a separate terminal window:

```bash
cd client

# Copy environment configuration
cp .env.example .env
# Edit client/.env with GitHub OAuth credentials

# Install dependencies
npm install

# Start Next.js development server (:3000)
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | Optional | Port for the NestJS HTTP server (default: `3001`). |
| `FRONTEND_URL` | Required | Allowed CORS origin (e.g. `http://localhost:3000` or production URL). |
| `DATABASE_URL` | Required | PostgreSQL connection string (supports Neon pooling connections). |
| `GROQ_API_KEY` | Required | Groq API key used for Llama 3.3 70B inference. |
| `DEFAULT_AI_MODEL` | Optional | Model identifier (defaults to `llama-3.3-70b-versatile`). |
| `E2B_API_KEY` | Required | E2B API key for provisioning cloud sandbox micro-VMs. |
| `LINGO_API_KEY` | Required | Lingo.dev API key for string translation. |
| `LINGO_MCP_SERVER_URL`| Required | Lingo.dev Model Context Protocol server endpoint (`https://mcp.lingo.dev/main`). |
| `VERCEL_API_TOKEN` | Required | Vercel Personal Access Token for triggering preview deployments. |
| `VERCEL_TEAM_ID` | Optional | Vercel team identifier (only needed when deploying to a team scope). |

### Client (`client/.env`)

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_URL` | Required | Canonical URL of the Next.js app (`http://localhost:3000` in dev). |
| `NEXTAUTH_SECRET` | Required | Cryptographic secret for signing JWTs (`openssl rand -base64 32`). |
| `GITHUB_CLIENT_ID` | Required | GitHub OAuth Application Client ID. |
| `GITHUB_CLIENT_SECRET`| Required | GitHub OAuth Application Client Secret. |
| `NEXT_PUBLIC_API_URL` | Required | Full backend API base URL with `/api` prefix (default: `http://localhost:3001/api`). |

> **Note on Client API URL:** `NEXT_PUBLIC_API_URL` must include the `/api` prefix to align with NestJS global routing prefix rules.

---

## Known Limitations

- **Framework Target:** Exclusively designed for Next.js 14+ App Router projects. Next.js Pages Router, Vite, Remix, or Astro projects are not supported.
- **Translatable String Scope:** Babel AST extraction targets JSX text nodes and common string attributes (`placeholder`, `title`, `alt`, `aria-label`, `label`, `aria-placeholder`, `aria-description`, `content`). Complex string concatenations or dynamic variables computed inside functions are skipped.
- **Repository Architecture:** Configured for single-app repositories. Monorepo setups (`nx`, `turborepo` workspaces) are out of scope.
- **Execution Timeout:** E2B sandboxes enforce a 10-minute upper execution threshold. Repositories with substantial dependency installation overhead may encounter sandbox timeouts.

---

## Demo

### Video Walkthrough

[![Watch the demo](https://img.shields.io/badge/▶_Watch_Demo-Google_Drive-blue?style=for-the-badge&logo=googledrive)](https://drive.google.com/drive/folders/1GW-W05pXK-dTD6qWeqy38LuvGFD2R1sI?usp=sharing)

Full end-to-end recording demonstrating repository cloning, Babel AST string extraction, Lingo.dev translation, automated GitHub Pull Request creation, and live Vercel preview deployment.

### Demo Repository

Test the pipeline using the official companion demo project:
- **Repository:** [Kashif-Rezwi/lingo-agent-demo-app](https://github.com/Kashif-Rezwi/lingo-agent-demo-app)
- **Description:** A clean Next.js 14 App Router landing page pre-configured for i18n pipeline validation.

---

## Author & License

- **Author:** [Kashif Rezwi](https://github.com/Kashif-Rezwi)
- **Context:** Built for the [Lingo.dev Hackathon 2025](https://lingo.dev)
- **License:** No license file currently committed (all rights reserved; maintainer confirmation required).
