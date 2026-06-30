# Hena — Project Overview & Architecture Specification

> Status: **Draft v0.1** (design agreed via interview; no core code written yet)
> Scope: whole-project architecture and the decisions that constrain it.
> Source of truth language: English (`docs/en/`); translations may follow.

---

## 1. Vision

Hena is a **highly customizable, extensible, open-source agent harness**. Its
organizing principle is:

> **The core is tiny and provides only the basics. Everything else is an
> extension.**

The core is _just the agentic loop_: take messages → call the model → execute
tool calls → repeat until stop. Context assembly, prompts, persistence, tools,
compaction, skills, approvals, even the session store — all of it is an
extension composed on top of that loop.

Two systems were studied as prior art and are referenced throughout:

- **pi** (`@earendil-works/pi-*`) — a self-extensible coding agent. Source of
  the lifecycle-hook + capability-registration extension model, the
  append-only session log with a tree (fork / branch summaries), and the
  "no built-in permission system; run with the user's permissions" stance.
  pi is **not** Effect-based (plain factories + mutable registries); Hena
  diverges here.
- **opencode** (`@opencode-ai/*`) — Effect-based. Source of the **Models.dev
  capability catalog** (cost/limits/modalities cached on disk with TTL +
  cross-process lock), the Effect-`Schema` tool shape
  (`execute: Effect<Success, ToolFailure>` + `toModelOutput`), and heavy use of
  Effect tracing. opencode _reimplemented_ provider protocols; Hena does **not**
  — it delegates protocol/streaming to AI SDK v7.

---

## 2. Core stack & conventions

- **AI SDK v7** — provider abstraction, streaming, tool/message schema, and the
  experimental `Agent` primitive (used for inference only — see §6).
- **Effect v4** (`effect@4.0.0-beta`) — effectful code, DI via `Layer`/`Context`,
  `Stream`, `Scope`, structured concurrency, typed errors, tracing.
- **Bun** — package manager and runtime (runs TypeScript directly).
- **drizzle-orm + SQLite** — persistence, accessed through `@effect/sql`.
- **React + Vite** — UI. **Electron** — desktop shell.
- Conventions (from `AGENTS.md` / `.patterns/effect.md`): prefer
  `Effect.fnUntraced` over functions that only return `Effect.gen`; class syntax
  for `Context.Service`; no `async`/`await`/`try`/`catch`; no `Date.now`/`new
  Date` (use `Clock`/`TestClock`); small functions; functional style; avoid
  meaningless barrel files.

---

## 3. Goals & non-goals

### v1 goals

- A **tiny, correct agentic loop** with a first-class extension model.
- **Multi-user / hosted from the start**, while a **single binary/local**
  posture remains a trivial configuration of the same codebase.
- **Server-authoritative** execution: agents keep running when clients
  disconnect; multiple clients can watch/drive one session.
- A great **extension authoring** experience built on Effect `Layer`s.
- Embeddable: the agent is usable as a **library** without the server or UI.

### v1 non-goals (explicit)

- **True cross-tenant isolation / sandboxing** — deferred (see §20, §22). v1 is
  _logically_ multi-user; hardening (per-user workers/containers) comes later.
- OS-level extension sandboxing or a permission system.
- Mobile apps.
- Non-coding verticals as a product focus (the harness stays general, the
  product target is a coding agent).

---

## 4. Monorepo topology

Packages are published under the **`@hena-dev/*`** scope. `/agent` is the
**embeddable composition root**; everything else is an optional layer on top.

| Package      | Role |
|--------------|------|
| `loop`       | The core loop runtime (`ToolLoopAgent`). Very small. Owns only model→tool→repeat iteration. |
| `ai`         | Model/provider layer over AI SDK v7: capability **catalog** + `ModelRegistry` service + tool shape. No bespoke protocols. |
| `db`         | Persistence: append-only entry log + session tree, via `@effect/sql` + drizzle. |
| `agent`      | **Composition root.** Wires `loop` + `ai` + `db` + the internal extension bundle into a runnable, embeddable agent. |
| `extensions/internal` | First-party, **default-on** extensions (the "standard library"). |
| `extensions/external` | First-party, **default-off** extensions (opt-in). |
| `extension-api` | The stable, versioned facade extension authors import (see §9.6). |
| `server`     | Exposes `agent` over Effect Platform **HttpApi** + **SSE**. |
| `client`     | TypeScript SDK, **derived** from the HttpApi definition (+ OpenAPI emitted). |
| `app`        | Shared **React** UI implementation. |
| `web`        | Browser host embedding `app` + `client`. |
| `desktop`    | Electron shell wrapping `app`. |
| `cli`        | Entry point; `hena serve` starts the server. |

> Current scaffolding (`core`, `extensions`, `hena`, `client`, `web-ui`) is a
> placeholder. This spec defines the **target** topology; packages may be split
> in as the implementation lands.

A degenerate single-package/single-binary build (Bun compile) remains possible
for local distribution.

---

## 5. Architecture at a glance

```
            ┌──────────────────────────────────────────────┐
 clients →  │  server (HttpApi + SSE)   auth Layer (none|OAuth)
 (web,      │   • per-session fiber/Scope on a runtime
  desktop,  │   • per-session Hub → fan-out to N subscribers
  cli, sdk) │   • cursor resume (durable log + live tail)
            │   • elicitation request/response channel
            └───────────────┬──────────────────────────────┘
                            │ drives
            ┌───────────────▼──────────────┐
            │  agent (composition root)     │
            │   loop + ai + db + internal   │
            └───────┬───────────────┬───────┘
                    │               │
        ┌───────────▼──┐     ┌──────▼─────────────┐
        │ loop          │     │ extension set       │
        │ ToolLoopAgent │◄────┤ (composed Layer     │
        │  Stream<Event>│ hooks│  graph, per session)│
        └──────┬────────┘     └─────────────────────┘
               │ single-step inference
        ┌──────▼─────────┐
        │ ai → AI SDK v7  │  (catalog + ModelRegistry)
        └────────────────┘
```

The unit of observation everywhere is a typed **`AgentEvent`** stream
(`Effect Stream<AgentEvent, AgentError, R>`).

---

## 6. The core loop (`loop` / `ToolLoopAgent`)

**Owns only** the iteration `messages → model → tool calls → repeat until stop`.
It owns **no session state**, no prompt, no persistence.

- **Own the loop; AI SDK is the inference engine.** Hena drives AI SDK v7's
  experimental `Agent` **one step at a time** (single-step stop). Between steps,
  Hena runs interceptors (context reducer, `tool_call` Decisions), executes tools
  itself, appends results, and decides whether to continue. The turn boundary
  belongs to Hena — this is what makes the hook/Decision model possible.
- **Public surface = `Stream<AgentEvent, AgentError, R>`.** Consumers (server,
  UI, persistence) fold the stream. Events are a normalized superset:
  `text-delta`, `reasoning-delta`, `tool-input-delta`, `tool-call`,
  `tool-result`, `step`, `finish`, `error`, plus elicitation and custom entries.
- **Cancellation: Effect interruption is the source of truth.** A Scope-bound
  `AbortController` bridges to the SDK/provider fetch. Interrupting the fiber
  aborts the request and runs finalizers (flush partial output, persist). Used
  for stop and mid-stream steering.
- **Intra-step tool concurrency:** parallel by default with **bounded
  concurrency**; a tool may declare `sequential` (e.g. edits to one file).
  Results gathered deterministically in call order. (Mirrors pi's
  `executionMode`.)

---

## 7. Provider / model layer (`ai`)

- **Catalog only; protocols stay with AI SDK v7.** `/ai` adds a capability/cost
  catalog (modalities, context/limits, reasoning, tool-call support, cost,
  alpha/beta/deprecated status) and a `ModelRegistry` Effect service. It does
  **not** reimplement wire protocols.
- **Catalog source: hybrid.** A bundled snapshot (instant/offline) plus an
  optional background refresh from **models.dev** (cached to disk, TTL,
  cross-process lock), mirroring opencode.
- **Providers/models are contributed by extensions** through `ModelRegistry`,
  keeping core provider-agnostic.

### Tool definition shape

Adopt opencode's Effect-native pattern (each tool is its own extension, see §8):

```
parameters : Schema      // drives validation + JSON schema sent to the model
success    : Schema      // internal result type
execute    : (params) => Effect<Success, ToolFailure>   // typed errors
toModelOutput : (success) => ModelContent[]              // model-facing view
```

Errors are expressed as `ToolFailure`; unmapped errors/defects fail the stream.
`toModelOutput` decouples the internal success value from what the model sees.

---

## 8. The extension model

### 8.1 What an extension is

- **An extension is an Effect `Layer` bundle.** It provides services and
  registers contributions into registry services. Native Effect DI, scoped
  lifecycle, fully testable.
- **Granularity: one tool = one extension.** Each tool is independently
  installable/toggleable (marketplace-friendly). This diverges from pi (where
  one extension exposes many tools).
- **Shared state across sibling tools** (read/write/edit; ls/grep/glob) lives in
  a **shared capability service `Layer`** that the tool-extensions depend on
  (e.g. `FileSystemAccess`). Tools stay separate; the Layer dependency graph
  wires the shared service in once (memoized).

### 8.2 How extensions influence the loop

Primary mechanism: **typed lifecycle hooks + declarative capability
registration.** Hooks are split by intent:

- **Interceptors** — run **sequentially** in Layer-graph order; return a typed
  **`Decision`** (`Continue | Replace(x) | Deny(reason) | Halt`); the loop folds
  decisions deterministically. Used for context building, `tool_call` gating,
  message/result rewriting.
- **Observers** — run **concurrently**, fire-and-forget, cannot affect control
  flow. Used for telemetry, UI, notifications.

Representative lifecycle points (informed by pi's event set): `session_start`,
context build, `before_model_call`, `tool_call` (block/transform),
`tool_result` (modify), `step`, `turn_start/end`, message start/update/end,
`model_select`, `finish`, plus resource discovery and input transform.

### 8.3 Context assembly

Because the core owns no prompt, the system prompt + history + injected context
are built **by extensions** via an **ordered reducer pipeline**: each contributor
is an `(ctx) => ctx` Effect step, ordered by the Layer graph; the final immutable
structure is rendered to AI SDK messages. (History is just a contributor backed
by the session store — see §10.)

### 8.4 Dependency & ordering

Resolved by the **Effect `Layer` dependency graph** (topological build +
memoization). No manual priority numbers.

### 8.5 Failure isolation

Hooks are **supervised and isolated by default**: a misbehaving extension cannot
crash the agent; its failure becomes a typed, surfaced event and the loop
continues. An interceptor may opt into `critical` (fail the loop).

### 8.6 API stability & shared dependencies

- Extensions import a thin, versioned **`@hena-dev/extension-api`** facade.
- The host owns **single instances** of `effect`, the AI SDK, and the Hena
  runtime, injected via the import map (treated as **peer dependencies**). This
  prevents dual-instance bugs (two `Effect` runtimes in one process).
- Compatibility via **semver + runtime capability detection**.

---

## 9. Dynamic extension lifecycle

### 9.1 Enablement scope

Layered: **global defaults → per-workspace override → per-session ephemeral**,
resolved at session start and hot-togglable live.

### 9.2 Loading code

**Native dynamic `import()`** of installed packages (Bun runs TS directly).
Host-owned deps are satisfied via an **import map / alias** so every extension
shares one instance. No bespoke transpiler (unlike pi's jiti).

### 9.3 The dynamic-Layer mechanism

> Tension: Effect `Layer`s are normally composed once at boot and memoized; we
> want add/remove without restart.

**Mechanism: rebuild the whole enabled set into a fresh `Scope` at the turn
boundary.** On any toggle, compose the new enabled set as one Layer graph, build
it into a new `Scope` (shared capability services auto-dedup via memoization),
drain in-flight tool calls, then **close the old `Scope`** (finalizers run).

Rationale (after studying pi): pi's "no restart" is a full `reload()` that
rebuilds the entire extension set — robust precisely because it avoids
partial-graph surgery. Per-extension child scopes would fight Layer memoization
and force ref-counting of shared capability services. Whole-set rebuild lets
memoization handle shared services for free and honors "disable closes its
Scope; finalizers run; in-flight finishes then detaches."

This rebuild is **per session** (the "base runtime" is shared; the composed
extension Scope is per session — see §12).

### 9.4 When changes take effect

At the **next loop turn boundary** (a quiescent point) — never mid-step. The
model sees a new tool on its next turn.

### 9.5 Stale-handle safety

**No long-lived capture.** Hooks/tools resolve their dependencies **per
invocation** from the live registry; effects from a closed Scope are interrupted
by Scope closure. Staleness is prevented structurally rather than detected
(contrast pi's `invalidate()`/stale-throw guard).

### 9.6 Distribution & install UX

- **npm packages by convention** (e.g. `hena-ext-*`); **no central index** in
  v1. Install = the package is present + listed in the (layered) config.
- Enabling/disabling from the UI rewrites the config layer and triggers the
  turn-boundary rebuild.
- In **hosted** mode, server-side extensions are **operator/org-admin curated**;
  users enable/configure from an allowlist (see §20).

---

## 10. Persistence, sessions & events (`db`)

- **Source of truth: an append-only entry log.** Every semantic entry (user
  message, assistant message, tool call, tool result, compaction, custom) is
  appended immutably; queryable views are materialized from the log.
- **Durable granularity: semantic entries only.** Token/tool-arg **deltas are
  ephemeral** (streamed in-memory, dropped after the entry commits). Resume =
  replay entries by cursor + reattach to the live delta tail.
- **Session shape: a tree.** Entries carry parent pointers; **fork**, alternate
  **branches**, and **compaction** are nodes. Enables fork-from-point and
  replay. (Mirrors pi.)
- **Conversation state lives in a session-store extension**, not the core: it
  feeds history via the context reducer (§8.3) and persists via an observer
  hook. The core loop stays stateless.
- **Access: `@effect/sql` `SqlClient` + drizzle query builder**, behind a single
  `Storage` Context.Service. **WAL** mode + a **single serialized writer fiber**
  (Queue/Semaphore) respects SQLite's single-writer nature.
- **IDs:** time-ordered/sortable (ULID-style) for a naturally ordered log.

### Compaction

An internal extension. **Threshold- and overflow-triggered summarization** writes
a **compaction node** into the tree; the history contributor serves messages from
the latest checkpoint forward; raw history is retained for fork/replay; overflow
recovery retries the turn post-compaction.

---

## 11. Server (`server`)

- **API: Effect Platform `HttpApi`** (typed, Schema-defined) for commands;
  **SSE** for the per-session event stream. REST to send, SSE to observe;
  OpenAPI emitted for non-TS consumers.
- **Server-authoritative execution.** Each session runs in-process as a
  **fiber/`Scope`** with its **own composed extension Scope**, on a shared
  **base runtime** (catalog/db/providers). The loop keeps running if clients
  disconnect; clients are commanders/observers.
- **Fan-out & resume.** A per-session **Hub/PubSub** broadcasts events to N
  subscribers. On (re)connect a client passes a cursor (`Last-Event-ID`); the
  server replays entries since the cursor from the durable log, then attaches to
  the live tail.
- **Elicitation channel.** A typed `Elicitation` service lets server-side
  extensions ask the user mid-run: the request rides the event stream
  (`confirm | select | input | custom-schema`), the loop suspends, the UI renders
  it, and the answer is **POSTed back by request id**. Works for any client, with
  headless timeout.

### Auth & tenancy

- **Posture by config (one codebase).**
  - **Local / single-user:** **no authentication**; one implicit owner;
    localhost; sqlite file.
  - **Hosted / multi-user:** **OAuth/OIDC** + org/user RBAC; identity carried on
    the HttpApi; storage scoped by tenant.
- **Auth is a `Layer`** with `local` and `hosted` implementations.
- **Data tenancy:** every entity is scoped by **org + owner** (enforced in the
  `Storage` service on every query). Sessions are **shareable within an org**;
  the existing per-session Hub gives **live multi-user collaboration** on one
  session for free.

> ⚠️ v1 ships **logical** multi-user only. Real cross-tenant isolation is
> **deferred** (see §20, §22).

---

## 12. Execution & runtime model (summary)

- One **base runtime** (Effect `Layer`s for catalog, providers, storage, auth).
- Per **session**: a fiber + a **composed extension Scope** (rebuilt at turn
  boundaries, §9.3).
- **Sub-agents** (§16) spawn **child sessions** as scoped fibers on the same base
  runtime, with nested event streams and cascading cancel/budget.
- (Hosted, future) the base runtime becomes **per-user**, isolated by an OS
  process/container boundary — the point at which the no-sandbox/in-process model
  becomes safe across tenants.

---

## 13. Client SDK (`client`)

- **Derived from the HttpApi definition** (Effect `HttpApiClient`): zero drift,
  typed errors, typed event schemas.
- **OpenAPI emitted** alongside for other languages.
- Consumed by `app`; usable standalone.

---

## 14. UI (`app`, `web`, `desktop`)

- `app` is the shared **React** implementation; `web` (browser) and `desktop`
  (Electron) are thin hosts embedding it; `client` is the SDK.
- **Event-sourced client store:** hydrate from the durable log by cursor, then
  reduce the live SSE event stream (mirroring server entries) into view state.
- **No TUI** in scope.

### Extension UI contributions (the remote-extension problem)

Extensions are server-side `Layer`s, but the UI is a remote React app. Solution:
**dual-entry extensions** — a package may ship a **server entry** (the Layer)
**and an optional browser UI module** that registers React components (tool
renderers, panels, widgets) into the app's renderer registry (dynamically
imported; "config-listed = trusted"). A **declarative UI-spec fallback** covers
common cases so most extensions need no browser code.

- **Default rendering:** a **schema-driven generic renderer** derived from each
  tool's Effect `Schema`, plus built-in special-cases (diffs for edits, terminal
  output for bash, file previews).
- **Approvals UX:** a **default-on `approvals` interceptor extension** that gates
  risky tool calls via the elicitation channel (allowlist / auto-approve /
  patterns). **Core has no permission system**; approvals are removable/replaceable.

---

## 15. Default extension bundle (tiers)

- **Internal (default-on) "standard library"** — all are **ordinary, removable
  extensions**, just shipped on by default. Removing them yields a barebones
  loop:
  `read`, `write`, `edit`, `ls`, `grep`, `glob`, `bash`, `compaction`, `skills`,
  `todo`, `approvals`, and the infrastructure extensions `session-store` /
  `history` / `persistence`.
- **External (default-off)** — opt-in (e.g. **MCP client**, web/fetch, git
  helpers, notifications).

This preserves the "everything is an extension" purity: even persistence is opt-out.

---

## 16. Interop & multi-agent

- **MCP (Model Context Protocol):** an **external (default-off) extension** that
  connects to MCP servers and bridges their tools/prompts/resources into the
  registry dynamically. No core coupling.
- **Skills:** an internal extension (discovery + injection + a `skill` tool),
  consistent with this repo's own `.agents/skills` system.
- **Sub-agents:** a **`task`/subagent tool-extension** spawns a **child session**
  on the shared runtime; child events nest under the parent tool call;
  interrupting/limiting the parent cascades. Reuses sessions/loop/streaming — no
  new core concept.

---

## 17. Configuration

- **Effect `Schema`-validated JSONC**, comments allowed, decoded into typed
  config; **env-var interpolation**; deep-merged across **global → workspace →
  session** layers (§9.1).
- JSON-schema/OpenAPI export for editor support. An executable TS config may be
  offered later (unsafe to load untrusted, so not the default).

---

## 18. Observability

- **Effect-native OpenTelemetry.** Spans per turn/step/tool; metrics for
  tokens/cost/latency; structured logs. Exporters are configured or added by
  extensions. (opencode-style, via Effect tracing.)

---

## 19. Testing & determinism

- **In-memory Layers** (memory storage + a **fake `LanguageModel`**) + **`TestClock`**
  + **golden session replays** (assert against golden event/entry transcripts)
  via `@effect/vitest`.
- HTTP **record/replay** for occasional real-provider smoke tests.
- Tests co-located as `*.test.ts`; run per package with `bun --bun vitest run`.

---

## 20. Security & trust model

- **Trust by configuration.** Listing an extension in the (appropriate) config
  layer **is** the act of trust. There is **no sandbox and no extension
  permission system**.
- **Local / single-user:** the user trusts what they list; runs with the user's
  own OS permissions (pi's stance). No auth.
- **Hosted / multi-user:** the **operator / org admin** controls which
  server-side extensions exist; end-users enable/configure from that allowlist.
  Arbitrary **user-supplied code** is only acceptable **inside per-user
  isolation** (a worker/container) — which v1 **defers** (§22). OAuth/OIDC + RBAC
  gate access; storage is org/owner-scoped.
- **Supply chain:** pin exact versions, prefer release-age delays, treat
  dependency changes as reviewed code (pi-style hardening) as the project matures.

---

## 21. Deployment postures

| | Local / single-user | Hosted / multi-user |
|--|--|--|
| Auth | none (implicit owner) | OAuth/OIDC + RBAC |
| Isolation | process = the user | **logical only in v1** (deferred OS isolation) |
| Storage | sqlite file | tenant-scoped (sqlite-per-user or shared DB) |
| Extensions | user-listed (full freedom) | admin-curated allowlist |
| Code path | identical | identical (Layers differ) |

One codebase; posture is selected by swapping the auth Layer, the isolation
strategy, and storage scoping.

---

## 22. Accepted tradeoffs & risks

1. **Effect learning curve narrows the extension-author pool** — *the primary
   consciously-accepted cost.* Layer-based, Effect-native extensions are more
   correct/composable but harder to write than pi's plain factories. **Mitigation:**
   the stable `@hena-dev/extension-api` facade, templates, codegen, and examples.
2. **Deferred cross-tenant isolation.** v1 is multi-user **logically** but runs
   tenants' agents/extensions in a shared process without OS isolation — a
   recorded **security debt**. **Mitigation/roadmap:** per-user worker/container
   boundary (§12); admin-curated server extensions until then (§20).
3. **Building on AI SDK v7's experimental `Agent`** risks upstream churn.
   **Mitigation:** isolate it behind `/ai` + the loop so swaps are contained.
4. **Whole-set Scope rebuild on every toggle** costs latency/complexity vs
   surgical swaps. **Mitigation:** rebuild off the hot path, at quiescent turn
   boundaries, with memoized shared Layers.
5. **In-process / in-browser extension code with no sandbox.** Convenience and
   power over isolation. **Mitigation:** trust-by-config, curation, supply-chain
   hardening, optional containerization.

---

## 23. Decision log (quick reference)

| # | Decision |
|---|----------|
| Core boundary | Core owns only model→tool→repeat iteration; everything else is an extension. |
| Extension unit | Effect `Layer` bundle; **one tool = one extension**. |
| Shared tool state | Shared capability service `Layer` (e.g. `FileSystemAccess`). |
| Influence | Typed lifecycle hooks + declarative capability registration. |
| Hook split | Sequential **interceptors** (return `Decision`) vs concurrent **observers**. |
| Hook failure | Supervised/isolated by default; opt-in `critical`. |
| Ordering | Effect `Layer` dependency graph (topological + memoized). |
| Context | Ordered reducer pipeline over a structured context value. |
| Dynamic loading | Rebuild whole enabled set into a fresh `Scope` at the turn boundary. |
| Apply timing | Next loop turn boundary. |
| Disable | Close the extension's Scope; finalizers run; drain in-flight then detach. |
| Code loading | Native dynamic `import()` + import-map for host-owned singletons. |
| Stale safety | No long-lived capture; resolve per-invocation from the live registry. |
| Enablement scope | global → workspace → session (hot-togglable). |
| Trust | No sandbox/permissions; config-listing = trust. |
| Loop | Own loop driving AI SDK v7 experimental `Agent` one step at a time. |
| Turn surface | `Effect Stream<AgentEvent, AgentError, R>`. |
| Cancellation | Effect interruption is source of truth; Scope-bound `AbortController`. |
| Tool concurrency | Parallel bounded; per-tool `sequential` opt-out. |
| `/ai` | Catalog only (models.dev hybrid snapshot+refresh); protocols via AI SDK. |
| Tool shape | Effect `Schema` params/success + `Effect<Success, ToolFailure>` + `toModelOutput`. |
| Storage | Append-only entry log = truth; views derived. |
| Durability | Semantic entries only; deltas ephemeral. |
| Session shape | Tree with parent pointers; fork/branch/compaction = nodes. |
| Session state | Lives in a session-store extension; core is stateless. |
| DB access | `@effect/sql` + drizzle; `Storage` service; WAL + single writer. |
| Compaction | Threshold+overflow summarization → compaction node; history from latest checkpoint. |
| API | Effect Platform `HttpApi` + SSE; OpenAPI emitted. |
| Client | Derived from `HttpApi` (`HttpApiClient`). |
| Execution | Server-authoritative; per-session fiber/Scope on a shared base runtime. |
| Fan-out | Per-session Hub broadcast; cursor (`Last-Event-ID`) resume. |
| Elicitation | Typed service; request on event stream, answer POST by id. |
| UI extensions | Dual-entry (server Layer + optional browser UI module) + declarative fallback. |
| Default rendering | Schema-driven generic renderer + built-in special cases. |
| Approvals | Default-on interceptor extension via elicitation; no core permissions. |
| UI topology | Shared React `app`; `web`/`desktop` hosts; event-sourced client store; no TUI. |
| API stability | `@hena-dev/extension-api` facade + host-owned peer singletons + semver/capability detection. |
| MCP | External (default-off) extension bridging into the registry. |
| Sub-agents | Child sessions via a `task` tool-extension; nested streams; cascading cancel/budget. |
| Observability | Effect-native OpenTelemetry; pluggable exporters. |
| Config | Effect `Schema`-validated JSONC, layered, env interpolation. |
| Testing | In-memory Layers + fake model + `TestClock` + golden replays. |
| Composition | `/agent` embeddable root; server/cli/app/web/desktop optional. |
| Default tiers | Internal default-on standard library (all removable) vs external default-off. |
| Install UX | npm convention (`hena-ext-*`), no central index in v1. |
| Scope | Multi-user/hosted from the start; local single-user = same codebase, different config. |
| Top tradeoff | Accept the Effect learning curve (bet on the facade + safety payoff). |

---

## 24. Open questions / future work

- **Cross-tenant isolation:** design the per-user worker/container boundary and
  the control-plane protocol that fronts it.
- **Budgets & quotas:** token/cost/time budgets per session/sub-agent/user; how
  they surface as events and Decisions.
- **AgentEvent schema:** finalize the canonical typed event union and its
  versioning.
- **Extension API surface:** concrete shape of `@hena-dev/extension-api`
  (hook registry, capability registration, elicitation, UI registration).
- **Catalog vs config precedence:** how user/extension model overrides merge with
  the models.dev catalog.
- **Collaboration semantics:** conflict handling when multiple users drive one
  session simultaneously (steering vs queueing).
- **Docs/i18n:** English-canonical under `docs/en/`; translation workflow.
