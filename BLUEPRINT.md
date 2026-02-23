# LingoAgent — Master Project Blueprint
> Version 1.0 | Status: Hackathon Build | Framework: Next.js App Router + NestJS

---

## Table of Contents

1. [The Problem We Are Solving](#1-the-problem-we-are-solving)
2. [The Core Idea](#2-the-core-idea)
3. [The Build Mindset](#3-the-build-mindset)
4. [What Lingo.dev Provides](#4-what-lingodev-provides)
5. [What Our App Adds On Top](#5-what-our-app-adds-on-top)
6. [Technical Architecture](#6-technical-architecture)
7. [The Agent Pipeline](#7-the-agent-pipeline)
8. [Data Flow](#8-data-flow)
9. [Technology Stack](#9-technology-stack)
10. [Complete Project Structure](#10-complete-project-structure)
11. [Environment Variables](#11-environment-variables)
12. [Known Constraints and Risks](#12-known-constraints-and-risks)
13. [Non-Negotiable Rules](#13-non-negotiable-rules)
14. [Build Order](#14-build-order)
15. [Demo Strategy](#15-demo-strategy)

---

## 1. The Problem We Are Solving

Going multilingual is one of the most commonly requested and most commonly abandoned features in software development. Companies know they need it — users demand it, global markets require it, revenue depends on it — but the implementation consistently defeats engineering teams.

The abandonment happens for several compounding reasons. String externalization is tedious and error-prone at scale. Translation file management fragments across formats and platforms. Translations drift out of sync the moment a new feature ships. The process requires coordination between developers, translators, reviewers, and product managers who rarely speak the same language about the problem. And retrofitting i18n into an existing codebase costs 3 to 10 times more than building it in from the start.

AI tools like Lingo.dev have dramatically lowered the cost of the translation step itself — but they still require a developer to sit down, read the documentation, configure the tooling, run the CLI, manage the output, open a PR, and set up a preview environment. That is still hours of focused work per project.

The core problem this application solves is not translation. Translation is solved. The problem is the **orchestration gap** — the hours of developer time between "we want multilingual support" and "here is a working branch with a live preview."

---

## 2. The Core Idea

**One input. One click. One working multilingual branch with a live preview.**

A user provides a GitHub repository URL and selects their target languages. An autonomous agent pipeline takes over completely — it clones the repository, detects the framework, configures Lingo.dev, installs dependencies, runs the translation engine, commits the changes to a new branch, opens a pull request, and generates a live preview URL — all without any human intervention.

The entire process takes minutes instead of days. The developer's only job is to review the pull request.

This is not a translation tool. It is a **multilingual adoption accelerator** — a system that removes the last friction between wanting multilingual support and having a working, reviewable implementation in hand.

---

## 3. The Build Mindset

**We are building an orchestration layer, not a translation engine.**

Lingo.dev has already solved the hard problem of accurate, context-aware AI translation. We are not competing with or replicating that. We are wrapping it in an intelligent agent pipeline that removes every remaining manual step from the developer's workflow.

This distinction matters deeply for scoping decisions throughout the build. When facing any feature choice, the question to ask is: does this reduce human intervention in the multilingual adoption process? If yes, it belongs in the product. If no, it is scope creep.

**Reliability over breadth.**

A demo that works perfectly for Next.js App Router is worth infinitely more than a demo that claims to support five frameworks but breaks on all of them. The hackathon is won on the demo. The demo is won on reliability. Reliability is won by ruthless scope control.

**Observable beats fast.**

Users can tolerate a 3-minute process. They cannot tolerate a 3-minute black box. Every meaningful action the agent takes must be visible to the user in real time through a live log stream. The experience of watching the agent work is part of the product.

**Test each tool in isolation before wiring them together.**

The agent pipeline is a chain. A broken link anywhere breaks the entire chain. Each tool — clone, detect, analyze, configure, translate, commit, preview — must be verified to work independently before being handed off to the LLM orchestrator.

---

## 4. What Lingo.dev Provides

Lingo.dev is an open-source, AI-powered i18n toolkit that provides five distinct tools. Understanding exactly what each tool does — and what it does not do — is essential to understanding what our application needs to build.

### The Compiler
A build-time system for React applications. It uses Babel AST analysis to detect translatable JSX strings and injects translations at compile time. Zero code changes required in the target repository — no translation key extraction, no `t()` function wrapping, no JSON file management. Works with Next.js App Router, Vite, React Router v7, and TanStack Start.

### The CLI
A command-line tool that reads an `i18n.json` configuration file and translates project files across 26 supported formats including JSON, YAML, Markdown, Android XML, iOS `.strings`, Flutter ARB, and XLIFF. Maintains a lockfile (`i18n.lock`) that fingerprints translated content so only new or changed strings are processed on subsequent runs.

### The CI/CD GitHub Action
A GitHub Actions integration that automates CLI execution on every push. Operates in either direct-commit mode (writes translations directly to the branch) or pull-request mode (opens a PR with translation changes). Supports a `--frozen` flag for verifying translation parity without updating files.

### The SDK
A runtime translation SDK available in seven languages including JavaScript, Python, PHP, Ruby, Go, Rust, and Deno. Handles dynamic and user-generated content that does not exist at build time. Key methods include text translation, object translation (preserves JSON structure), chat translation (preserves speaker names), HTML translation (preserves markup), batch translation, and language detection.

### The MCP Server
A Model Context Protocol server that exposes Lingo.dev's framework-specific setup knowledge to AI coding assistants such as Cursor, Claude Code, and GitHub Copilot. Instead of hallucinating configuration, an AI assistant using the MCP server receives verified, up-to-date setup instructions for each supported framework. This is the tool our agent uses to know exactly how to configure each target repository.

---

## 5. What Our App Adds On Top

Lingo.dev eliminates the translation work. Our application eliminates everything else.

| What Lingo.dev Still Requires a Human For | What Our Agent Does Instead |
|---|---|
| Reading and understanding the documentation | Agent queries MCP server for exact instructions |
| Cloning the repository locally | Agent clones into an isolated E2B sandbox |
| Detecting the framework and choosing the right setup path | Agent reads package.json and config files to detect automatically |
| Modifying next.config.ts and layout.tsx correctly | Agent applies config changes based on MCP instructions |
| Writing the i18n.json configuration file | Agent generates it based on user's selected locales |
| Running npm install for the compiler package | Agent executes inside the sandbox |
| Running npx lingo.dev@latest run | Agent executes inside the sandbox |
| Creating a branch and committing the changes | Agent does via Octokit GitHub API |
| Opening a pull request | Agent does via Octokit GitHub API |
| Setting up a preview deployment | Agent triggers via Vercel API |

---

## 6. Technical Architecture

### System Overview

The system consists of three primary layers: a Next.js frontend for user interaction and live log display, a NestJS backend for agent orchestration and job management, and a collection of external services (E2B, GitHub, Lingo.dev MCP, Vercel) that the agent coordinates between.

### Frontend Layer — Next.js App Router
Responsible for GitHub OAuth authentication, repository URL input, language selection, real-time log streaming via Server-Sent Events, and displaying the final pull request link and preview URL. No translation logic lives here.

### Backend Layer — NestJS
Responsible for receiving job requests, creating and managing job lifecycles, orchestrating the Vercel AI SDK agent pipeline, managing E2B sandbox instances, communicating with the Lingo.dev MCP server, and emitting real-time logs via SSE.

### Execution Layer — E2B Cloud Sandboxes
All repository operations — cloning, file reading and writing, npm install, CLI execution — happen inside isolated E2B cloud sandboxes. This ensures no arbitrary code runs on the application server, provides a clean filesystem per job, and eliminates security risks from untrusted repositories.

### Communication Pattern — SSE (Server-Sent Events)
The frontend opens a persistent SSE connection to the backend using a job ID returned immediately when a job is started. The agent emits log events through this connection in real time. The connection closes when the agent emits a completion or error event.

### Agent Orchestration — Vercel AI SDK
The Vercel AI SDK `generateText` function with `maxSteps` is used to orchestrate the tool-calling loop. The LLM receives a system prompt and the job parameters, and iteratively calls tools in the correct order. Each tool emits progress logs and returns structured data consumed by the next tool.

---

## 7. The Agent Pipeline

The agent executes seven tools in strict sequential order. Each tool depends on data produced by the previous tool. The LLM enforces this order based on the system prompt and the input/output structure of each tool.

### Tool 1 — clone_repo
Receives the repository URL and GitHub access token. Spins up a new E2B sandbox. Clones the repository into the sandbox at `/workspace`. Returns the sandbox ID and working directory path.

### Tool 2 — detect_framework
Receives the sandbox ID and working directory. Reads `package.json`, `next.config.ts`, `next.config.js`, `vite.config.ts`, and other indicator files. Determines the framework and router type. Returns a framework identifier. If the framework is not `nextjs-app-router`, the agent stops immediately and returns an unsupported framework error to the user.

### Tool 3 — analyze_repo
Receives the sandbox ID and working directory. Scans for existing i18n setup (presence of next-intl, i18next, react-i18next, or existing Lingo.dev configuration). Identifies the entry file (layout.tsx location), next.config path, and performs a rough count of JSX components containing hardcoded text. Returns a structured analysis object.

### Tool 4 — setup_lingo
Receives the sandbox ID, working directory, framework identifier, target locales, and entry file path. Queries the Lingo.dev MCP server for exact setup instructions for the detected framework. Writes the `i18n.json` configuration file with source and target locales. Modifies `next.config.ts` to wrap the config with `withLingo`. Injects `LingoProvider` into the root `layout.tsx`. Returns a list of modified files.

### Tool 5 — install_and_translate
Receives the sandbox ID and working directory. Runs `npm install @lingo.dev/compiler` inside the sandbox. Runs `npx lingo.dev@latest run` with the configured Lingo.dev API key. Verifies that locale files were generated for each target language. Returns word counts and generated locale list.

### Tool 6 — commit_and_push
Receives the sandbox ID, working directory, repository URL, and GitHub access token. Reads the translated and modified files from the E2B sandbox filesystem. Uses Octokit to create a new branch named `lingo/add-multilingual-support` on the remote repository. Commits all changes with a descriptive commit message. Opens a pull request with a structured description listing the changes made. Returns the branch name and pull request URL.

### Tool 7 — trigger_preview
Receives the repository URL and branch name. Calls the Vercel API to trigger a preview deployment for the new branch. Polls the deployment status until it reaches a ready state or a timeout. Returns the preview URL.

---

## 8. Data Flow

### Job Lifecycle

A job progresses through five states: `pending` (created, not yet started), `running` (agent executing), `completed` (all tools succeeded), `failed` (a tool returned an error), and `cancelled` (user or system terminated).

### Request Flow

The frontend sends a POST request to `/agent/run` with the repository URL, target locales, and the user's GitHub access token from their session. The backend creates a job record, assigns a UUID job ID, starts the agent pipeline asynchronously in the background, and immediately returns the job ID to the frontend. The frontend then opens an SSE connection to `/agent/stream/:jobId` and listens for events.

### Event Types

The SSE stream emits four event types. A `log` event carries a message string and a status of `info`, `success`, or `error`. A `progress` event carries a step name and percentage complete. A `complete` event carries the pull request URL and preview URL. An `error` event carries an error message and the step at which the failure occurred.

### Tool Data Chain

Each tool's return value is consumed by the next tool. The LLM manages this chain — it passes the `sandboxId` returned by `clone_repo` into every subsequent tool, the `framework` from `detect_framework` into `setup_lingo`, and the `branchName` from `commit_and_push` into `trigger_preview`. This is managed entirely through the LLM's context window and tool call/response pairs.

---

## 9. Technology Stack

### Frontend
- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Authentication:** NextAuth.js with GitHub OAuth provider
- **Real-time:** Native EventSource API for SSE consumption
- **HTTP Client:** Native fetch

### Backend
- **Framework:** NestJS
- **Language:** TypeScript
- **Agent Orchestration:** Vercel AI SDK (`ai` package) with `generateText` and tool calling
- **LLM Provider:** OpenAI GPT-4o via `@ai-sdk/openai`
- **Sandbox Execution:** E2B SDK (`e2b` package)
- **GitHub Integration:** Octokit REST (`@octokit/rest`)
- **MCP Client:** `@modelcontextprotocol/sdk`
- **Real-time:** NestJS SSE via RxJS `Subject` and `Observable`
- **Validation:** Zod for tool parameter schemas
- **Database:** PostgreSQL via Prisma ORM (job tracking)

### External Services
- **E2B:** Cloud sandbox execution environment
- **Lingo.dev:** MCP server for setup instructions + CLI for translation
- **GitHub API:** Repository operations, branch creation, PR creation
- **Vercel API:** Preview deployment triggering and status polling
- **OpenAI:** LLM backbone for agent reasoning

### Infrastructure (Hackathon)
- **Frontend deployment:** Vercel
- **Backend deployment:** Railway or Render
- **Database:** Neon PostgreSQL

---

## 10. Complete Project Structure

```
lingoagent/
│
├── client/                                           ← Next.js Frontend
│   ├── app/
│   │   ├── layout.tsx                                ← Root layout with auth session provider
│   │   ├── page.tsx                                  ← Landing page with repo input
│   │   ├── globals.css
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx                          ← GitHub OAuth login page
│   │   │   └── callback/
│   │   │       └── page.tsx                          ← OAuth callback handler
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx                              ← Post-login main view
│   │   │
│   │   └── jobs/
│   │       └── [jobId]/
│   │           └── page.tsx                          ← Live job view with log stream
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── badge.tsx
│   │   │   └── card.tsx
│   │   │
│   │   ├── repo-input-form.tsx                       ← URL input + locale selector
│   │   ├── language-selector.tsx                     ← Multi-select for target locales
│   │   ├── log-stream.tsx                            ← Real-time SSE log display
│   │   ├── log-entry.tsx                             ← Individual log line with status icon
│   │   ├── result-card.tsx                           ← PR link + preview URL display
│   │   └── progress-stepper.tsx                      ← Visual pipeline step progress
│   │
│   ├── lib/
│   │   ├── auth.ts                                   ← NextAuth config with GitHub provider
│   │   ├── api-client.ts                             ← Typed fetch wrapper for backend API
│   │   └── constants.ts                              ← Supported locales list, framework list
│   │
│   ├── hooks/
│   │   ├── use-job-stream.ts                         ← SSE connection hook with auto-reconnect
│   │   └── use-agent-job.ts                          ← Job start + stream lifecycle hook
│   │
│   ├── types/
│   │   ├── job.ts                                    ← Job, Log, Result type definitions
│   │   └── agent.ts                                  ← Agent event type definitions
│   │
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── server/                                           ← NestJS Backend
│   ├── src/
│   │   │
│   │   ├── main.ts                                   ← NestJS bootstrap, CORS, port config
│   │   ├── app.module.ts                             ← Root module, imports all feature modules
│   │   │
│   │   ├── agent/                                    ← Core agent feature module
│   │   │   ├── agent.module.ts                       ← Module definition and provider registration
│   │   │   ├── agent.controller.ts                   ← POST /agent/run, GET /agent/stream/:jobId
│   │   │   ├── agent.service.ts                      ← Job lifecycle, generateText orchestration
│   │   │   │
│   │   │   ├── tools/                                ← One file per agent tool
│   │   │   │   ├── index.ts                          ← Barrel export of all tools
│   │   │   │   ├── clone-repo.tool.ts
│   │   │   │   ├── detect-framework.tool.ts
│   │   │   │   ├── analyze-repo.tool.ts
│   │   │   │   ├── setup-lingo.tool.ts
│   │   │   │   ├── install-translate.tool.ts
│   │   │   │   ├── commit-push.tool.ts
│   │   │   │   └── trigger-preview.tool.ts
│   │   │   │
│   │   │   ├── prompts/
│   │   │   │   └── agent-system.prompt.ts            ← LLM system prompt
│   │   │   │
│   │   │   └── dto/
│   │   │       ├── start-job.dto.ts                  ← Request body validation
│   │   │       └── job-response.dto.ts
│   │   │
│   │   ├── sandbox/                                  ← E2B sandbox management
│   │   │   ├── sandbox.module.ts
│   │   │   └── sandbox.service.ts                    ← create, get, cleanup sandbox instances
│   │   │
│   │   ├── github/                                   ← GitHub API operations
│   │   │   ├── github.module.ts
│   │   │   └── github.service.ts                     ← Octokit wrapper: branch, commit, PR
│   │   │
│   │   ├── mcp/                                      ← Lingo.dev MCP client
│   │   │   ├── mcp.module.ts
│   │   │   └── mcp.service.ts                        ← MCP connection + tool call wrapper
│   │   │
│   │   ├── vercel/                                   ← Vercel deployment API
│   │   │   ├── vercel.module.ts
│   │   │   └── vercel.service.ts                     ← Trigger preview, poll status
│   │   │
│   │   ├── auth/                                     ← Auth guard for protected endpoints
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.guard.ts                         ← Validates session token from frontend
│   │   │   └── auth.service.ts
│   │   │
│   │   ├── jobs/                                     ← Job persistence
│   │   │   ├── jobs.module.ts
│   │   │   └── jobs.service.ts                       ← Prisma job store
│   │   │
│   │   └── common/
│   │       ├── types/
│   │       │   ├── agent.types.ts                    ← JobStatus, LogEntry, AgentResult types
│   │       │   ├── tool.types.ts                     ← EmitFn, ToolInput/Output types
│   │       │   └── events.types.ts                   ← SSE event shape definitions
│   │       │
│   │       └── utils/
│   │           ├── file-patcher.ts                   ← next.config.ts + layout.tsx modifier logic
│   │           ├── framework-detector.ts             ← package.json analysis helpers
│   │           └── url-parser.ts                     ← GitHub URL parsing utilities
│   │
│   ├── prisma/                                       ← Using neon postgres database
│   │   ├── schema.prisma
│   │   └── migrations/
│   │
│   ├── test/
│   │   ├── tools/                                    ← Individual tool unit tests
│   │   └── e2e/                                      ← End-to-end pipeline tests
│   │
│   ├── nest-cli.json
│   ├── tsconfig.json
│   └── package.json
│
├── demo-repos/                                      ← Local reference repos for testing
│   └── nextjs-demo-app/                             ← A clean Next.js App Router app for demos
│
├── BLUEPRINT.md                                     ← This file — master reference
└── .gitignore                                       ← Root gitignore
```

---

## 11. Environment Variables

### Frontend (apps/client/.env.local)

| Variable | Purpose |
|---|---|
| `NEXTAUTH_URL` | Base URL of the frontend application |
| `NEXTAUTH_SECRET` | Secret for NextAuth session signing |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `NEXT_PUBLIC_API_URL` | Backend NestJS API base URL |

### Backend (apps/server/.env)

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | GPT-4o for agent reasoning |
| `E2B_API_KEY` | E2B cloud sandbox execution |
| `LINGO_API_KEY` | Lingo.dev Engine for translation |
| `VERCEL_API_TOKEN` | Vercel preview deployment triggering |
| `VERCEL_TEAM_ID` | Vercel team scope (if applicable) |
| `LINGO_MCP_SERVER_URL` | Lingo.dev MCP server endpoint |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Backend server port |
| `FRONTEND_URL` | Allowed CORS origin |

---

## 12. Known Constraints and Risks

### Near-Certain Issues

**Framework Detection Ambiguity**
Next.js App Router and Pages Router repos can look similar in their file structure. Detection logic must check for the presence of an `app/` directory with a `layout.tsx` file, not just the presence of Next.js in package.json. A Pages Router repo must be gracefully rejected.

**Existing i18n Conflicts**
If a repository already uses next-intl, i18next, or any other i18n library, the Lingo.dev Compiler will conflict with it. The analyze step must detect these libraries and halt with a clear explanation rather than proceeding and producing a broken output.

**Hardcoded Strings Outside JSX**
The Lingo.dev Compiler only translates JSX text nodes. Strings inside JavaScript variables, constants, error messages, toast notifications, and API response handlers will not be translated. The PR description should clearly communicate this limitation to the user.

**npm Install Duration**
Running `npm install` inside an E2B sandbox on large repositories with many dependencies can take 60-90 seconds. This must be reflected in the live log stream with appropriate messaging so the user does not assume the process has stalled.

**E2B Sandbox Timeout**
E2B sandboxes have a maximum lifetime. For very large repositories or slow translation runs, the 5-minute default timeout may be insufficient. The timeout should be configurable and set conservatively high for the hackathon.

**Preview Deployment Async Delay**
Vercel preview deployments are not instant. After the push, triggering and polling the deployment status adds 1-3 minutes to the total job time. The status polling interval and maximum retry count must be set appropriately.

**GitHub Token Scope Requirements**
The GitHub OAuth token must have `repo` scope to clone private repositories and `workflow` scope if the target repo uses GitHub Actions. The OAuth app configuration must request these scopes explicitly at login.

### Edge Cases to Reject Gracefully

- Repositories larger than a practical threshold (set at 50MB for the hackathon)
- Repositories with no detectable JSX components
- Repositories that are not public or are not accessible with the user's token
- Non-GitHub URLs (GitLab, Bitbucket, etc.)
- Monorepos with multiple apps (limit to single-app repos for the hackathon)

---

## 13. Non-Negotiable Rules

These rules must be respected for the entire duration of the build. They exist to protect demo reliability and prevent scope collapse.

**Rule 1 — Next.js App Router Only**
Support exclusively Next.js App Router repositories for the hackathon. Every other framework is a post-hackathon stretch goal. This is the framework Lingo.dev supports most completely, and it is the framework most likely to produce a clean, reliable demo.

**Rule 2 — All Repo Operations Inside E2B Sandboxes**
No git clone, npm install, or CLI execution happens on the application server. Every operation against untrusted repository code runs inside an isolated E2B sandbox. This is a security requirement, not a preference.

**Rule 3 — The Agent Must Be Observable**
The user must see real-time logs of every meaningful action the agent takes. A silent progress bar is not acceptable. Every tool must emit a log entry before it begins and after it completes or fails.

**Rule 4 — Fail Early and Explicitly**
If the repository is unsupported, the user must know within 10 seconds of starting the job. If any tool fails, the agent stops immediately and emits a clear error message explaining exactly what failed and why. No silent failures, no partial completions presented as successes.

**Rule 5 — Happy Path First**
A single perfect end-to-end demo with a known good repository is the top priority. Edge case handling is secondary. If forced to choose between handling a new edge case and polishing the happy path, always polish the happy path.

**Rule 6 — Test Each Tool in Isolation**
Before wiring any tool into the `generateText` agent loop, test it independently with hardcoded inputs. Verify its output matches the expected schema. Only integrate verified tools into the agent.

**Rule 7 — Own a Demo Repository**
Maintain a small, clean, purpose-built Next.js App Router repository with 8-12 hardcoded English strings across 3-5 components. This repository is the demo safety net. Every demo uses this repository. Random user repositories are for testing only, never for live demos.

---

## 14. Build Order

The build must follow this order. Do not jump ahead. Each phase unlocks the next.

### Phase 1 — Foundation Services
Establish the sandbox service, GitHub service, and MCP client as independently testable, injectable NestJS services. Verify each can connect to its respective external API before touching any agent logic.

### Phase 2 — Individual Tool Verification
Build and test each of the seven tools in complete isolation using hardcoded test inputs. Verify the output schema of each tool. Do not proceed to Phase 3 until all seven tools produce correct output when called directly.

### Phase 3 — SSE Infrastructure
Build the job lifecycle system — job creation, the RxJS Subject-based log stream, the SSE controller endpoint, and the frontend EventSource hook. Verify that a manually emitted test event appears in the browser before wiring the agent.

### Phase 4 — Agent Integration
Wire all seven tools into the `generateText` call with the system prompt. Test with the demo repository. Iterate on the system prompt until the LLM reliably calls tools in the correct order without skipping steps.

### Phase 5 — Frontend Polish
Build the complete UI — repo input form, language selector, live log window, progress stepper, and result card. Connect it to the working backend. Ensure error states and loading states are handled gracefully.

### Phase 6 — Demo Preparation
Run the full pipeline against the demo repository a minimum of five times. Record what breaks. Fix every break that touches the happy path. Document edge cases that are out of scope. Prepare the pitch around the demo.

---

## 15. Demo Strategy

### The Demo Repository
The demo repository must be a clean, minimal Next.js App Router application with the following characteristics: 8-12 hardcoded English strings spread across at least 3 components, a simple but realistic UI (a landing page or a dashboard), no existing i18n setup, no external API calls that could fail during a demo, and a name that reads clearly on screen.

### The Demo Script
The demo follows this exact narrative sequence every time. Show the problem: a real developer's repository with hardcoded English strings and no multilingual support. Show the solution: paste the URL, select French, Arabic, and Japanese, click one button. Show the process: the live log stream doing its work transparently, step by step. Show the result: a real GitHub pull request and a live preview URL where the app renders in all three languages. Show the scale: explain that what just took 3 minutes previously took days — and now any developer can do it for any Next.js repository.

### The Target Languages for Demo
Always demo with French, Arabic, and Japanese. French demonstrates a Western European language. Arabic demonstrates RTL script and a completely different character set. Japanese demonstrates a logographic CJK language. This combination maximally demonstrates the breadth of Lingo.dev's translation capability.

### Fallback Plan
If the live demo environment is unstable, prepare a screen-recorded video of a clean run against the demo repository. The video is the absolute fallback — always have it ready.

---

*This document is the single source of truth for the project architecture. All implementation decisions must be consistent with the specifications defined here. Update this document when architectural decisions change.*
