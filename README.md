# LingoAgent 🌐

> **AI-powered i18n automation** — clone a GitHub repository, extract every hardcoded string, translate it with Lingo.dev, and open a ready-to-merge Pull Request with a live Vercel preview. All in one click.

---

## Table of Contents

- [About](#about)
- [Approach](#approach)
- [Architecture — High-Level Design](#architecture--high-level-design)
- [Auth Flow](#auth-flow)
- [AI Agent Pipeline](#ai-agent-pipeline)
- [Tech Stack](#tech-stack)
- [Setup & Local Dev](#setup--local-dev)
- [Environment Variables](#environment-variables)
- [Known Limitations](#known-limitations)
- [Demo](#demo)
  - [Video Walkthrough](#-video-walkthrough)
  - [Screenshots](#-screenshots)
  - [Try It Yourself](#-try-it-yourself)
- [Author](#author)

---

## About

LingoAgent is a full-stack AI agent built **specifically for Next.js 14+ App Router landing pages and websites**. Point it at a GitHub repo, select your target languages, and it automatically extracts every hardcoded JSX string via Babel AST, translates them with Lingo.dev, wires up a runtime language switcher, commits all changes to a new branch, opens a GitHub PR, and triggers a live Vercel preview deployment — all in a single click.

**Key benefits:**
- Zero manual i18n boilerplate — no string wrapping, no config editing
- Full source code safety: all execution runs inside an isolated E2B sandbox
- Bring your own API keys to bypass free-tier limits
- Real-time progress streaming via Server-Sent Events (SSE)

> ⚠️ **Scope:** LingoAgent currently supports **Next.js 14+ App Router** projects only. Pages Router and other frameworks (Vite, Remix, etc.) are explicitly not supported at this time.

---

## Approach

**The problem isn't translation — it's orchestration.**

Going multilingual is one of the most commonly requested and most commonly abandoned features in software development. AI tools like Lingo.dev have dramatically lowered the cost of the translation step itself — but developers still need to read the docs, configure the tooling, run the CLI, manage output files, open a PR, and set up a preview. That's still hours of focused work per project.

The core problem LingoAgent solves is the **orchestration gap** — the hours of developer time between *"we want multilingual support"* and *"here is a working branch with a live preview."*

**Lingo.dev handles translation. We handle everything else.**

Lingo.dev provides five powerful tools — the Compiler (build-time AST translation), the CLI (multi-format translation runner), the CI/CD GitHub Action, the SDK (runtime translation for 7+ languages), and the MCP Server (framework-specific setup instructions for AI assistants). LingoAgent leverages the **SDK** for string translation and the **MCP Server** for correct i18n scaffolding, building an autonomous pipeline around them:

| What Lingo.dev Still Requires a Human For | What LingoAgent Does Instead |
|---|---|
| Reading and understanding the documentation | Agent queries the Lingo.dev MCP server for exact setup instructions |
| Cloning the repository locally | Agent clones into an isolated E2B sandbox |
| Detecting the framework and choosing the right setup path | Agent reads `package.json` and config files automatically |
| Modifying `next.config.ts` and `layout.tsx` correctly | Agent applies verified changes from MCP instructions |
| Writing the `i18n.json` configuration file | Agent generates it from the user's selected locales |
| Running `npm install` and the translation engine | Agent executes inside the sandbox |
| Creating a branch and opening a pull request | Agent calls the GitHub API via Octokit |
| Setting up a preview deployment | Agent triggers Vercel and polls until ready |

**Three principles drove every build decision:**

1. **Reliability over breadth.** A demo that works perfectly for Next.js App Router is worth more than a demo that claims to support five frameworks but breaks on all of them. Scope was ruthlessly controlled around the happy path.

2. **Observable beats fast.** Users can tolerate a 3-minute process. They cannot tolerate a 3-minute black box. Every meaningful action the agent takes is streamed to the user in real time via Server-Sent Events.

3. **LLM as planner, not executor.** The Groq LLM is only ever shown *one* tool schema at a time and asked for arguments — the server executes the tool deterministically. This avoids hallucination and SDK timeout pitfalls while retaining the flexibility of LLM-driven orchestration.

**Why Next.js App Router — and only that?**

Lingo.dev provides its deepest, most battle-tested support for Next.js App Router. Its MCP server, compiler integration, and SDK are all tuned against this stack. Supporting additional frameworks (Vite, Remix, Pages Router) would each require separate detection logic, different file patching strategies, different i18n scaffolding patterns, and independent end-to-end testing — multiplying the surface area several times over.

In a hackathon context, doing one thing reliably is far more valuable than doing five things poorly. A flawless demo on Next.js App Router beats a fragile multi-framework agent every time. This is a deliberate constraint, not an oversight — and it directly maps to where Lingo.dev itself shines most.

---

## Architecture — High-Level Design

The system consists of three primary layers: a **Next.js frontend** for user interaction and live log display, a **NestJS backend** for agent orchestration and job management, and a collection of **external services** (E2B, GitHub, Lingo.dev MCP, Vercel) that the agent coordinates between.

```
┌─────────────────────────────────────────────────────────┐
│                      Browser (User)                     │
│                                                         │
│  Next.js 14 App Router (Client - :3000)                 │
│  ┌────────────┬─────────────┬───────────────────────┐  │
│  │  /login    │  /dashboard │  /jobs/[jobId]         │  │
│  │  GitHub    │  New Job /  │  SSE log stream        │  │
│  │  OAuth     │  History /  │  + PR / Preview links  │  │
│  │  page      │  Settings   │                        │  │
│  └────────────┴─────────────┴───────────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ REST + SSE (HTTP/1.1)
                        ▼
┌─────────────────────────────────────────────────────────┐
│          NestJS API Server (Server - :3001)             │
│                                                         │
│  AuthGuard (Bearer token = GitHub OAuth token)          │
│  AgentController  →  AgentService                       │
│  JobsService (Prisma + Neon PostgreSQL)                 │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │          Agent Pipeline (per job)                 │  │
│  │  Groq LLM (llama-3.3-70b) — tool call planner    │  │
│  │  7 sequential tools executed in E2B sandbox       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  External Services:                                     │
│  ├── GitHub (Octokit) — clone / branch / PR            │
│  ├── E2B — isolated sandbox execution                  │
│  ├── Lingo.dev SDK + MCP — string translation          │
│  └── Vercel API — preview deployment                   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
                Neon PostgreSQL (jobs, logs)
```

**Key design decisions:**

| Decision | Rationale |
|---|---|
| Monorepo (`/client` + `/server`) | Clear separation of concerns; each can be deployed independently |
| SSE (not WebSockets) | One-way log streaming is all we need; SSE is simpler and HTTP-native |
| E2B sandbox | Complete process isolation — git, npm, node all run in a throwaway VM |
| Sequential tool forcing | Prevents the LLM from skipping steps or calling tools out of order |
| RxJS `ReplaySubject` per job | Late-joining SSE connections replay all past events from job start |

**Job lifecycle:** Each job transitions through five states: `pending` → `running` → `completed` / `failed` / `cancelled`. The frontend opens an SSE connection via `/agent/stream/:jobId` and receives real-time `log`, `progress`, `complete`, or `error` events until the job terminates.

---

## Auth Flow

LingoAgent uses GitHub OAuth exclusively — no passwords, no separate accounts.

```
User                 Next.js Client        NextAuth          GitHub OAuth
 │                        │                   │                  │
 │── clicks "Sign in" ───▶│                   │                  │
 │                        │── GET /api/auth/signin/github ──────▶│
 │                        │                   │◀── redirect ─────│
 │                        │◀── callback with code ───────────────│
 │                        │── exchange code ──▶│                  │
 │                        │◀── access_token ───│                  │
 │                        │                   │                  │
 │                   Session created           │                  │
 │                   (JWT with githubToken)    │                  │
 │                        │                   │                  │
 │── /dashboard ─────────▶│                   │                  │
 │                        │                                       │
 │ (On every API call)    │                                       │
 │                        │── POST /agent/run ──▶ NestJS Server   │
 │                        │   Authorization: Bearer <githubToken> │
 │                        │                      ▼               │
 │                        │              AuthGuard validates      │
 │                        │              token → attaches to req  │
 │                        │              AgentService uses it     │
 │                        │              to call GitHub APIs      │
```

**Why the GitHub token doubles as the API bearer token:**
The same token that authenticates the user with GitHub is forwarded to the NestJS server as a Bearer token. The server validates it's present and non-empty, then uses it directly to call GitHub APIs (creating branches, committing files, opening PRs) on behalf of the user. No separate JWT or session store is needed on the backend.

---

## AI Agent Pipeline

Each job runs a **strictly sequential 7-step pipeline**. The Groq LLM is only ever shown one tool schema at a time (`toolChoice: 'required'`), forcing it to call that exact tool and return the arguments. The server then executes the tool manually (preventing SDK timeout issues) and feeds the result back to the LLM's conversation history before the next step.

```
POST /agent/run
      │
      ▼
  1. clone_repo
     └── Clones the repo into an E2B sandbox
      │
      ▼
  2. detect_framework
     └── Identifies Next.js version, App Router vs Pages, layout path
      │
      ▼
  3. analyze_repo
     └── Checks for existing i18n libraries, counts JSX files
      │
      ▼
  4. setup_lingo
     └── Writes i18n.json, provider/switcher/translator components,
         patches layout.tsx (via Lingo.dev MCP tool)
      │
      ▼
  5. install_and_translate
     ├── npm install (for Babel AST parsing)
     ├── Babel AST extraction → finds ALL hardcoded JSX strings
     ├── Translates chunks via Lingo.dev SDK → public/locales/*.json
     └── ⚠️ Aborts with guidance if Lingo.dev quota/key is invalid
      │
      ▼
  6. commit_and_push
     └── Creates branch, commits all changes, opens GitHub PR
      │
      ▼
  7. trigger_preview
     └── Triggers Vercel deployment, polls until Ready
      │
      ▼
  SSE: { type: 'complete', data: { prUrl, previewUrl } }
```

**Tool data chain:** Each tool's return value feeds the next. The LLM manages this chain through its context window — passing the `sandboxId` from `clone_repo` into every subsequent tool, the `framework` from `detect_framework` into `setup_lingo`, and the `branchName` from `commit_and_push` into `trigger_preview`.

**Error handling:**
- **Groq rate limit / invalid key** → pipeline aborts immediately, user is guided to Settings tab to add their own key
- **Lingo.dev quota exceeded / invalid key** → same immediate abort with actionable guidance
- **LLM tool hallucination** → up to 3 retries with a correction prompt before failing
- **Manual cancel** → E2B sandbox killed instantly to stop billing

**Custom API Keys:**
Users can supply their own Lingo.dev and Groq API keys in `Dashboard → Settings`. These are stored in `localStorage` and sent with each job — overriding the server defaults, bypassing shared free-tier quotas.

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14.2 | React framework, App Router |
| NextAuth.js | 4.x | GitHub OAuth, session management |
| React | 18 | UI |
| Tailwind CSS | 3.x | Styling |
| TypeScript | 5.x | Type safety |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| NestJS | 11 | API server, dependency injection |
| Prisma | 7 | ORM, DB migrations |
| Neon PostgreSQL | — | Serverless Postgres (job + log storage) |
| RxJS | 7.x | `ReplaySubject` per-job SSE streams |
| Vercel AI SDK (`ai`) | 6.x | `generateText` + tool calling abstraction |
| `@ai-sdk/groq` | 3.x | Groq provider for the AI SDK |
| Groq (llama-3.3-70b-versatile) | — | LLM — tool argument generation |
| E2B | 2.x | Isolated sandbox VMs for code execution |
| Lingo.dev SDK | 0.131 | Translation engine (chunked API) |
| Lingo.dev MCP | — | Tool-call interface for i18n scaffolding |
| Octokit | 22.x | GitHub REST API (clone, branch, PR) |
| Vercel API | — | Preview deployments |
| Zod | 4.x | Runtime schema validation for tool inputs |
| class-validator | 0.14 | DTO validation on API endpoints |

### External Services
| Service | Role |
|---|---|
| [E2B](https://e2b.dev) | Cloud sandbox execution environment |
| [Lingo.dev](https://lingo.dev) | MCP server for setup instructions + SDK for translation |
| [GitHub API](https://github.com) | Repository operations, branch creation, PR creation |
| [Vercel API](https://vercel.com) | Preview deployment triggering and status polling |
| [Groq](https://groq.com) | Fast LLM inference (Llama 3.3 70B) |
| [Neon](https://neon.tech) | Serverless PostgreSQL |

---

## Setup & Local Dev

### Prerequisites
- Node.js 20+
- A GitHub OAuth App ([create one here](https://github.com/settings/developers))
- Free accounts for: [Groq](https://console.groq.com/keys), [E2B](https://e2b.dev), [Lingo.dev](https://lingo.dev/en/app), [Neon](https://neon.tech), [Vercel](https://vercel.com)

### 1. Clone the repo

```bash
git clone https://github.com/Kashif-Rezwi/lingo-agent.git
cd lingo-agent
```

### 2. Set up the server

```bash
cd server
cp .env.example .env
# Fill in all values in .env (see Environment Variables below)
npm install
npx prisma generate
npm run start        # Starts on :3001
```

### 3. Set up the client

```bash
cd client
cp .env.example .env
# Fill in NEXTAUTH_SECRET and GITHUB_* values
npm install
npm run dev          # Starts on :3000
```

### 4. Open the app

Navigate to [http://localhost:3000](http://localhost:3000), sign in with GitHub, and submit your first translation job.

---

## Environment Variables

### `server/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | ✓ | Server port (default: `3001`) |
| `FRONTEND_URL` | ✓ | Client origin for CORS (e.g. `http://localhost:3000`) |
| `DATABASE_URL` | ✓ | Neon PostgreSQL connection string |
| `GROQ_API_KEY` | ✓ | Groq API key — LLM calls ([get one](https://console.groq.com/keys)) |
| `DEFAULT_AI_MODEL` | — | Model name (default: `llama-3.3-70b-versatile`) |
| `E2B_API_KEY` | ✓ | E2B sandbox key ([get one](https://e2b.dev)) |
| `LINGO_API_KEY` | ✓ | Lingo.dev translation key ([get one](https://lingo.dev/en/app)) |
| `LINGO_MCP_SERVER_URL` | ✓ | Lingo.dev MCP endpoint (default: `https://mcp.lingo.dev/main`) |
| `VERCEL_API_TOKEN` | ✓ | Vercel personal token for deployments |
| `VERCEL_TEAM_ID` | — | Team ID (only needed for team accounts) |

### `client/.env`

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_URL` | ✓ | Full URL of the client app (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | ✓ | Random string for JWT signing (`openssl rand -base64 32`) |
| `GITHUB_ID` | ✓ | GitHub OAuth App Client ID |
| `GITHUB_SECRET` | ✓ | GitHub OAuth App Client Secret |
| `NEXT_PUBLIC_API_URL` | ✓ | Server URL (e.g. `http://localhost:3001`) |

> **Tip:** Users can also supply their own **Lingo.dev** and **Groq** API keys directly in `Dashboard → Settings` to bypass shared server-side quotas. Keys are stored locally in `localStorage` and never sent to any third party.

---

## Known Limitations

These are deliberate scope constraints and known edge cases, not bugs:

- **Next.js App Router only** — Pages Router, Vite, Remix, and other stacks are not supported
- **Hardcoded strings in JS logic are not translated** — Babel AST extraction targets JSX text nodes and common string attributes (`placeholder`, `title`, `alt`, `aria-label`). Strings inside variables, error messages, or API responses may not be caught
- **Large repos may time out** — E2B sandboxes have a configurable timeout (default 10 min). Repos with heavy `npm install` times or hundreds of JSX files may hit this limit
- **No monorepo support** — the agent targets single-app repositories only
- **Existing i18n setups may conflict** — if the repo already uses `next-intl`, `i18next`, or similar libraries, the agent's scaffolding may conflict with them

---

## Demo

### 🎬 Video Walkthrough

<!-- TODO: Replace with actual video link -->
[![Watch the demo](https://img.shields.io/badge/▶_Watch_Demo-Video-red?style=for-the-badge&logo=youtube)](https://your-video-link-here.com)

> A full end-to-end walkthrough showing LingoAgent translating a Next.js landing page into Japanese, French, and Arabic in under 3 minutes.

### 📸 Screenshots

<!-- TODO: Replace with actual screenshots -->

| Dashboard | Live Agent Logs | Result — PR & Preview |
|---|---|---|
| ![Dashboard](https://via.placeholder.com/400x250?text=Dashboard) | ![Live Logs](https://via.placeholder.com/400x250?text=Live+Logs) | ![Result](https://via.placeholder.com/400x250?text=PR+%26+Preview) |

### 🧪 Try It Yourself

**Demo repo:** [Kashif-Rezwi/lingo-agent-demo-app](https://github.com/Kashif-Rezwi/lingo-agent-demo-app) — a clean Next.js 14 App Router landing page, purpose-built for testing.

1. Sign into LingoAgent with your GitHub account
2. Paste `https://github.com/Kashif-Rezwi/lingo-agent-demo-app` as the repository URL
3. Select your target languages (e.g. Japanese, French, Arabic)
4. Click **Start** and watch the agent work in real time
5. Review the resulting GitHub PR and live Vercel preview

---

## Author

**Kashif Rezwi** — Built for the [Lingo.dev Hackathon 2025](https://lingo.dev)
