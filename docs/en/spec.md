# hena — Specification

Status: draft v0.2 (interview-derived + review pass, pre-implementation)
Date: 2026-06-12
License: MIT
npm scope: `@hena-dev/*`

---

## 1. What hena is

hena is an open source, **headless agent runtime**: a server-first harness whose
agent loop is as small as possible, and where **everything else — including the
things most harnesses consider core — is an extension**.

Three commitments define the project:

1. **A truly minimal core loop.** The kernel is exactly the §3 inventory: the
   turn loop and its direct affordances (typed events, transcript, tool
   dispatch/validation, steering/follow-up, ask, hook dispatch, error
   classification, context accounting, cancellation) plus the extension
   registry and config loading. Nothing else is privileged.
2. **Everything is an extension behind a modifiable interface.** Providers,
   persistence, permissions, compaction, retry, tools (even `read` and `grep`),
   skills, the system prompt, telemetry, the HTTP server, and the default Web
   UI are all extensions. First-party extensions live in the monorepo but use
   only public APIs — they are deliberately replaceable proof that the seams
   are real.
3. **Self-improvement.** The agent can extend the harness it is running in: a
   first-party `self-dev` extension lets it scaffold, write, test, and
   hot-load new extensions into its own process, gated by approval.

### 1.1 Lessons taken from the reference projects

The design was preceded by a study of two open source harnesses:

- **opencode** (SST): Effect-everywhere; a DB-backed `while(true)` loop that
  re-derives "what to do next" from persisted state each iteration;
  event-sourced SQLite persistence with transactional projectors; ~20
  sequential-mutation plugin hooks; AI SDK v6 with a 1,400-line provider
  quirk-transform layer. Adopted: event-sourced persistence with projections,
  typed error taxonomy, structured interruption, ask/approval as a suspension
  primitive, schema-derived wire protocol. Avoided: storage-coupled core loop,
  god-files (`prompt.ts`, 1,722 lines), hook dispatch without timeouts,
  V1/V2 dual-write migration debt, runtime npm installs.
- **pi** (badlogic): a 742-line in-memory loop; an 88-line `EventStream`
  primitive; "streams never throw — errors are data"; retry and compaction
  live *outside* the loop; steering/follow-up queues; append-only JSONL
  session trees; TypeScript-as-extension-language; no MCP/permissions/
  subagents in core. Adopted: in-memory reducer loop, error-as-data, policy
  outside mechanism, steering/follow-up queues, imperative ExtensionAPI,
  scripted fake provider for tests, lean default toolset and prompt. Avoided:
  monolith session/interactive layers (3.1k/5.7k lines), regex-only error
  classification as the sole mechanism, duplicated compaction/session code.

---

## 2. Architecture overview

```
┌────────────────────────────────────────────────────────────────┐
│  clients (default Web UI extension, community UIs, scripts)    │
└──────────────▲─────────────────────────────────────────────────┘
               │  HTTP + SSE (schema-derived typed protocol)
┌──────────────┴─────────────────────────────────────────────────┐
│  @hena-dev/extensions/server        (extension)                │
├────────────────────────────────────────────────────────────────┤
│  extensions: provider · persistence-sqlite · permissions ·     │
│  compaction · recovery · tools (read/write/edit/bash/…) ·      │
│  skills · system-prompt · subagents · self-dev · telemetry ·   │
│  provider-script · web-ui                                      │
├────────────────────────────────────────────────────────────────┤
│  @hena-dev/core (the kernel)                                   │
│  turn loop · event protocol · transcript · tool dispatch ·     │
│  steering/follow-up · ask primitive · hook dispatcher ·        │
│  extension registry · config loader                            │
├────────────────────────────────────────────────────────────────┤
│  Effect v4 (effect-smol) · AI SDK v7 · Bun                     │
└────────────────────────────────────────────────────────────────┘
```

- **Identity:** headless runtime/server first. UIs (including ours) are
  protocol clients. The `hena` binary boots core + configured extensions and
  serves the protocol.
- **Effect boundary:** core internals (loop, services, concurrency,
  interruption, spans) are Effect (v4 / effect-smol). The **extension API is
  plain Promise/AsyncIterable** — extension authors never see Effect. Core
  wraps extension callbacks into Effects at the boundary (one bridge, owned by
  core, tested to 100%).
- **Runtime:** **Bun only**, explicitly. `bun:sqlite`, `Bun.serve`, native TS
  imports for extension loading. Node users consume the runtime over HTTP.

---

## 3. The core (`@hena-dev/core`)

The core is the only non-removable code. Everything in this section is kernel;
everything not in this section is an extension. Target: an essential loop in
the spirit of pi's — the ~350-line hot path of its 742-line loop — measured in
small files (≤150 lines each, enforced by lint).

### 3.1 State model: in-memory reducer + event stream

- The loop holds the session transcript **in memory** and emits typed events
  for every state transition. It never reads storage.
- Persistence, crash-resume, audit, and sync are extension concerns built by
  subscribing to the event stream and replaying events.
- The event stream primitive is a minimal async-iterable push queue (pi-style
  `EventStream`), implemented over Effect internally, exposed as
  `AsyncIterable` publicly.
- Core exposes session creation **with an initial transcript** (hydration) —
  the API persistence extensions use for crash-resume. Core still never reads
  storage itself.

### 3.2 Turn execution: own loop, `streamText` = one turn

The loop is hena's reason to exist; AI SDK is transport + providers only.

```
runLoop(session):
  emit agent_start
  loop:
    inject steering messages (if any)
    emit turn_start
    assistant = streamText(model, convert(transcript), tools, single-step)
                 # streamed: message_start / message_delta / message_end
    if assistant.stopReason in {error, aborted}:
        emit turn_end, agent_end(reason)        # errors are DATA, loop ends
        return
    toolCalls = assistant.toolCalls
    if toolCalls: execute via tool dispatcher    # tool_* events
                  append results to transcript
    emit turn_end (usage, context accounting)
    if no toolCalls:
        if steering queued: continue          # injected at top of loop
        if follow-up queued: inject follow-up; continue
        break
  emit agent_end(completed)
```

- One provider turn per iteration; hena owns tool execution, hook timing, and
  steering injection. `ToolLoopAgent` / AI SDK multi-step is not used.
- **Streams never throw.** Provider/transport failures are normalized into a
  final assistant message with `stopReason: "error" | "aborted"` plus a typed
  classification (see 3.7). Abnormal provider finishes (e.g. max-tokens →
  `output-length`, content filter) are normalized the same way, so runs end
  through this single path. The error path is the same shape as the success
  path.
- **`continue` is the second core entry point** (besides prompt): resume the
  loop on the existing transcript without appending a user message — fresh
  `agent_start`; rejected if a run is active (HTTP 409); queued
  steering/follow-ups drain per 3.4. Recovery and compaction call it; exposed
  as `POST /sessions/:id/continue`.
- Retry and compaction **policy** are not in the loop (see extensions); the
  loop only provides the `continue` mechanism.
- Concurrency: **one active run per session.** A prompt against a running
  session must be sent as steering or follow-up; otherwise the server replies
  409.

### 3.3 Transcript: own minimal event-sourced format

- Core defines a small `TranscriptEntry` union: `user`, `assistant`,
  `toolResult`, plus an extensible `custom` entry for extensions. Every entry
  has a stable monotonic ID (scoped per session), timestamp, and (for
  assistant) usage/cost/model metadata. The assistant body is an ordered list
  of parts (`text | reasoning | tool-call`), streamed as part-addressed
  `message_delta`s; tool results may carry structured content (text, images,
  files).
- The transcript is a **pure fold over the transcript-affecting event subset**
  (3.13): `user_message` → `user`, `message_end` → `assistant`, `tool_end` →
  `toolResult`, `custom_entry` → `custom`, `transcript_replaced` → splice.
  Persistence rebuild = replay of exactly these events.
- Exactly **one** conversion function exists, at the `streamText` boundary:
  `toModelMessages(transcript)`. Keeping the native format small keeps the
  conversion small (the opencode 744-line converter is the anti-goal).
- AI SDK `UIMessage`/`ModelMessage` are never persisted and never appear in
  the public API.

### 3.4 Mid-run interaction: steering and follow-up queues

Core affordances, exposed over the protocol:

- **Steering**: messages injected at the next turn boundary (after the current
  tool batch) without killing the stream.
- **Follow-up**: messages queued to run when the agent would otherwise stop
  (the loop continues instead of ending).
- Drain modes: `one-at-a-time` (default) | `all`, per queue.
- Identifier token: `followup` (`followup_queued`, `POST …/followup`); prose
  uses "follow-up".

### 3.5 Tool dispatch and validation

- Tool calls are validated against the tool's schema before execution;
  validation failure, unknown tool, and thrown errors all become **error tool
  results fed back to the model** — the loop never crashes on a tool failure.
- Execution order: source order, sequential by default. A tool may declare
  `parallel: true`; adjacent parallel-safe calls in a batch execute
  concurrently, but tool *results* are appended in assistant source order so
  transcripts stay deterministic. Preflight hooks always run sequentially.
- Tools receive `(args, ctx)` where `ctx` includes `toolCallId`, the session,
  an `AbortSignal`, `update(partial)` for live progress events, and
  `ask(question)` (see 3.6).
- **Tool schemas:** `registerTool` accepts any **Standard Schema** validator
  (Zod v4, Valibot, ArkType, Effect Schema via its standard-schema interface)
  **or a raw JSON Schema object**. Core converts to JSON Schema for the model.
  Agent-written tools can therefore be dependency-free.

### 3.6 The ask primitive (suspension)

One core mechanism powers approvals, questions, and any human-in-the-loop
interaction:

- Any tool or hook may emit an **ask event** (question, options, context).
  The emitting computation suspends until a **reply event** arrives, with a
  configurable timeout and default answer; without a timeout it blocks until
  reply or abort.
- Asks travel over SSE; replies arrive via POST. Multiple clients may watch;
  first reply wins, later replies are rejected (HTTP 409).
- The permissions extension decides *when* to ask; clients decide *how* to
  render. (AI SDK tool-approval machinery is unused — hena owns tool
  execution.)

### 3.7 Error model and classification

- Core normalizes all provider/transport failures into a typed taxonomy
  (`aborted`, `auth`, `rate-limit`, `overloaded`, `context-overflow`,
  `output-length`, `network`, `api`, `unknown`) carried on the final assistant
  message and the `agent_end` event.
- Classification is a **pluggable matcher registry** (extensions can register
  matchers, e.g. per-provider overflow regexes — the pi lesson that no
  standard overflow error exists). Core ships only generic matchers.

### 3.8 Context accounting

- Core tracks token usage from `streamText` results, emits `context_usage`
  events each turn, and surfaces provider context-overflow errors as
  `context_overflow` events (verbatim error retained).
- Core exposes a **transcript-replacement operation** (atomic splice with
  provenance recorded as an event) — the mechanism compaction policy
  extensions use. Core itself has no thresholds and no summarization.

### 3.9 Hook dispatch contract

- **Transform/veto hooks** (e.g. `tool_call`, `context`, `before_model_call`)
  run **sequentially in registration order**, each with a per-hook timeout
  (config-overridable) and a typed fallback on failure.
- **Observe-only events** fan out **concurrently** and cannot block the loop.
- A hook failure or timeout emits a diagnostic event and is otherwise
  contained. **Extension errors never crash the loop** (the opencode
  no-timeout flaw is explicitly designed out).
- Transform-hook points are a **separate namespace from events** (3.13).
  Initial vocabulary: `before_model_call`, `tool_call`, `context`.

### 3.10 Cancellation

- Effect interruption end-to-end inside core; one `AbortController` per run.
  Fiber interrupt → scope close → `AbortSignal` to the provider call and all
  running tools. `POST /sessions/:id/abort` triggers it.
- In-flight tool calls that die with the run are finalized as synthetic
  "interrupted" error results so no provider ever sees a dangling tool call.

### 3.11 Extension registry and config (bootstrap)

These two are core because they must exist before extensions load:

- **Registry**: loads configured extensions, owns hook/registry/port tables,
  dispatches per 3.9, supports unload/reload (for hot reload).
- **Config**: JSONC, schema-validated (Effect Schema; published JSON Schema
  for `$schema` autocomplete). Cascade: built-in defaults < global
  (`~/.config/hena/config.jsonc`) < project (`hena.jsonc`) < env (`HENA_*`) <
  flags. Objects deep-merge; arrays replace. Project-local config and
  extensions are gated behind a **trust prompt** on first use: answered on the
  TTY at boot when interactive; headless boots fail closed unless trust was
  pre-granted (`--trust` flag or trust list in global config).

### 3.12 Event schema: versioned envelope from day 1

- Every event carries `schemaVersion`. Event types are defined **once** in
  Effect Schema; wire JSON, SQLite payloads, and generated client types all
  derive from the same definitions.
- Pre-1.0 churn is allowed **only with a migration**: upgrade-on-read
  transforms, N→1 supported. Persisted sessions must always load.

### 3.13 Core event vocabulary (initial)

`agent_start`, `turn_start`, `message_start`, `message_delta`, `message_end`,
`user_message`, `custom_entry`, `tool_start`, `tool_update`, `tool_end`,
`turn_end`, `agent_end`, `context_usage`, `context_overflow`,
`transcript_replaced`, `ask`, `reply`, `steering_queued`, `followup_queued`,
`extension_loaded`, `extension_unloaded`, `extension_error`,
`session_created`, `session_deleted`, `config_changed`.
(Names indicative; final names fixed by the Effect Schema definitions.
`user_message` carries `source: prompt | steering | followup`. The
transcript-affecting subset is defined in 3.3.)

---

## 4. Extension system

### 4.1 API shape: imperative ExtensionAPI (pi-style)

An extension is a TypeScript module with a default export:

```ts
import type { ExtensionAPI } from "@hena-dev/core";

export default function (api: ExtensionAPI) {
  api.on("turn_end", async (ev) => { /* observe */ });
  api.on("tool_call", async (ev) => ({ block: false }));   // transform/veto
  api.registerTool({ name, description, parameters, execute });
  api.registerSkill(...); api.registerCommand(...);
  api.providePersistence("sqlite", impl);  // port: named impl, config selects
  api.provideProvider("ai-sdk", impl);     // port
  api.registerErrorMatcher(...);           // registry: additive
  api.serve(route, handler);   // registry: core route table, served by `server`
}
```

Although the surface is imperative, the underlying semantics are explicitly
three kinds (documented as such):

- **Ports** (`provide*`): named implementations; config selects the active one
  (e.g. `"ports": { "persistence": "sqlite" }`). Conflicts are diagnostics,
  not races.
- **Registries** (`register*`): additive (tools, skills, commands, matchers,
  routes).
- **Hooks** (`on`): observe (concurrent) or transform (ordered, timeout) per
  the 3.9 contract.

The full API is Promise/AsyncIterable-based. No Effect appears in extension
authoring.

### 4.2 Execution model

- **In-process**, loaded via Bun-native dynamic `import()` of TS — no jiti, no
  bundler. Errors contained per 3.9. Security isolation is a documented
  **non-goal**: containerize the whole runtime for hostile environments (pi's
  stance).
- **Hot reload** is a first-class runtime capability (not dev-only) because
  self-improvement requires it: changed extension files are re-imported with
  cache-busting; the registry disposes old registrations (each extension gets
  a disposal scope) and re-registers.

### 4.3 Discovery and configuration

- Sources: first-party subpath exports (`@hena-dev/extensions/<name>`), npm
  package names, local paths (`~/.config/hena/extensions/*.ts`,
  `.hena/extensions/*.ts`). All declared/toggled in config:

```jsonc
{
  "$schema": "https://hena.dev/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "extensions": {
    "@hena-dev/extensions/write": false,         // remove a default tool
    "@hena-dev/extensions/grep": true,           // enable an optional tool
    "./.hena/extensions/my-linter.ts": true      // add local
  },
  "ports": { "persistence": "sqlite" }           // select port impls
}
```

- No runtime npm installs, ever (supply-chain + Nix reproducibility).

### 4.4 Inter-extension dependencies

- Extensions load **sequentially in config order**; later extensions may rely
  on earlier ones having registered.
- No direct imports or calls between extensions. The only seams are
  core-owned: ports, registries, events, and core session operations
  (prompt/continue/ask). Example: `api.serve` writes to a core route table;
  the server extension serves whatever it finds there.
- A registration whose consumer is absent is inert (plus a diagnostic event);
  an unfilled port degrades the features that consume it (per their specs),
  never crashes them.

---

## 5. First-party extensions

All live in the monorepo, **one extension per tool/feature** (maximal
granularity), packaged as **subpath exports of `@hena-dev/extensions`** (one
version, one publish; each extension is an isolated directory with its own
tests). Sole exception: `web-ui` ships as its own package
(`@hena-dev/web-ui`) because of its Vite build pipeline — it is still just an
extension. All are built against public APIs only.

| Extension | Kind | Summary |
|---|---|---|
| `provider` | port | Model string → AI SDK v7 model. models.dev catalog (fetched, cached, static fallback snapshot in-repo); curated bundled `@ai-sdk/*` providers; custom baseURL/key config. No quirk-transform layer at v1: trust AI SDK, expose `before_model_call` (params/headers/messages/providerOptions) hooks as the escape hatch for per-provider fix extensions. Credentials: env vars + config keys at v1 (no OAuth/keychain), deliberately. |
| `persistence-sqlite` | port | Default persistence. `bun:sqlite`: append-only event log (with `schemaVersion`) + projection tables (sessions, messages) updated transactionally per event batch. Rebuild = replay. Session list/read APIs for the server. DB at `~/.local/share/hena/hena.db`. |
| `permissions` | hooks | Policy over the ask primitive: pattern rulesets (`allow | ask | deny`, last match wins) per tool/path/command; doom-loop detection (N identical consecutive calls → ask); session-scoped "always allow"; ask timeout defaults to deny. |
| `compaction` | hooks | Policy over core accounting: proactive threshold (reserve buffer below context window) and reactive on `context_overflow`; summarization turn via a hidden agent prompt (structured checkpoint: goal/progress/decisions/next steps + touched-files list); preserves a recent-turn tail verbatim; uses core transcript replacement, then core `continue()` to resume. |
| `recovery` | hooks | Retry outside the loop: observes error-terminated runs, classifies retryability (typed taxonomy + matcher registry), exponential backoff honoring `retry-after`, then core `continue()`. One-shot guard for overflow-triggered continuation. |
| `read`, `write`, `edit`, `bash` | registry (tool) | The default-on toolset (lean, pi-style). `bash` is the search/exec workhorse. |
| `grep`, `glob`, `webfetch`, `todo` | registry (tool) | Shipped, **default-off**. Each independently toggleable. |
| `system-prompt` | port | Assembles the system prompt: sub-100-line template (identity, tool list, cwd, date) + project context files (`AGENTS.md` honored) + skills index (read from the core skill registry). Fully replaceable. |
| `skills` | registry | Anthropic Agent Skills spec-compatible (`SKILL.md` + frontmatter, progressive disclosure: index in prompt, body read on demand). Sources: `~/.config/hena/skills`, `.hena/skills`. |
| `subagents` | tool + hooks | `task` tool spawning child sessions **via the public runtime API only** (create session, prompt, await events) — the acid test of API sufficiency. Agent definitions from config/markdown. Children record `parentSessionId`; recursion off by default; abort cascades parent→child. |
| `self-dev` | tool + skills | See §7. |
| `provider-script` | port (test) | Deterministic scripted provider: scripted text/tool-call/error/overflow streams with controllable chunking. Used by all test tiers and shipped as a public testing utility. |
| `telemetry` | hooks | OTLP export of core's Effect spans (turns, model calls, tool execs, hook dispatch) + structured logs. Zero overhead unconfigured. |
| `server` | host | HTTP + SSE protocol (see §6) on `Bun.serve`; hosts routes contributed by other extensions (`api.serve`). |
| `web-ui` | client | Default Web UI (see §8), registered as static assets + routes on `server`. |
| `mcp` | post-v1 | MCP client (stdio + HTTP) as a first-party extension **after** the tool-registry API stabilizes. v1 guidance: bridge MCP servers via `bash`/CLI wrappers. |

---

## 6. Wire protocol (`@hena-dev/extensions/server`, `@hena-dev/client`)

- **Own typed protocol: HTTP + SSE.** The SSE stream carries exactly the core
  event vocabulary (same Effect Schema definitions); REST verbs cover
  commands. A generated/derived TS client ships as `@hena-dev/client` (used by
  the Web UI and third parties). OpenAPI published from the same schemas.
- Sketch:
  - `POST /sessions` · `GET /sessions` · `GET /sessions/:id` ·
    `DELETE /sessions/:id`
  - `POST /sessions/:id/prompt` (409 if running) ·
    `POST /sessions/:id/steer` · `POST /sessions/:id/followup` ·
    `POST /sessions/:id/abort` · `POST /sessions/:id/continue`
  - `GET /sessions/:id/events` (SSE: live + replay from cursor) ·
    `GET /events` (global firehose)
  - `POST /asks/:id/reply`
  - `GET /config` · `PATCH /config` (surgical JSONC edits) ·
    `GET /extensions` · `POST /extensions/reload` (all, or `{ "ids": [...] }`)
- Session list/read and SSE replay-from-cursor are backed by the persistence
  port; with no persistence configured the server serves live SSE only and
  answers replay/list with a typed capability error.
- ACP/MCP-server bridges are possible later as extensions; the native protocol
  stays canonical.
- **Security default:** binds `127.0.0.1`, **no token auth** (opencode-style),
  with a loud documented warning (any local process can drive an agent that
  runs bash). `Origin`/`Host` validation (CSRF/DNS-rebinding defense) is
  always on, with no off switch. Non-localhost binding requires an explicit
  flag **and** token auth; token auth is also available behind config for
  localhost and recommended in docs. Revisit before 1.0.

---

## 7. Self-improvement (`self-dev`)

The headline feature; mechanism:

1. **Capability**: tools to scaffold a new extension (template with test
   file), write/edit it in the workspace extensions dir (`.hena/extensions/`
   or `~/.config/hena/extensions/`), and run its tests.
2. **Knowledge**: a built-in skill exposing the ExtensionAPI docs, event
   vocabulary, config schema, and working examples (docs are runtime material
   — written to be fed to the agent).
3. **Gate (default)**: **ask-before-activate + tests must pass.** The
   extension's vitest suite runs first; only then does activation fire an ask
   event for approval. Approved extensions hot-load into the running session
   and persist to config. "Always allow" is answerable per session/project.
4. **Containment**: hot-loaded extensions run under the same in-process
   error-containment contract (3.9); a broken one is unloaded and reported as
   events, never a crash.

---

## 8. Default Web UI (`web-ui` package)

- The reference client is a **Web UI, itself an extension**; community UIs are
  expected as alternative extensions. No CLI client at v1 (the `hena` binary
  only boots/serves); `curl` + docs cover scripting.
- Stack: **React + Vite + Tailwind CSS + shadcn/ui, routing via TanStack
  Router**. Scaffolded once in a scratch repo with `bunx --bun shadcn@latest
  init --template vite` (TanStack Router added by hand — the CLI has no
  TanStack Router template), then imported into the monorepo. The chosen
  design preset is committed as resolved config (`shadcn preset --json`), not
  an opaque preset code.
- Components are split into small modules — **the 150-line file cap applies to
  UI code too**.
- Functionality v1: session list/create/resume, streamed transcript rendering
  (deltas, tool calls with live updates), prompt/steer/follow-up input, ask
  dialogs (approvals), abort, config/extension inspection.
- Testing: vitest unit (event→view-model reducers, components), integration,
  and e2e (Playwright) against a real server running `provider-script`.

---

## 9. Monorepo layout

```
hena/
├── docs/en/                      # canonical docs (English only for now;
│   ├── spec.md                   #  /en/ namespace reserved for future locales;
│   ├── architecture.md           #  written agent-readable: stable headings,
│   ├── extension-api.md          #  one concern per file, compiling examples)
│   └── protocol.md
├── packages/
│   ├── core/                     # @hena-dev/core      — the kernel (§3)
│   ├── extensions/               # @hena-dev/extensions — subpath per extension (§5)
│   │   └── src/<name>/           #   each: index.ts + *.test.ts (≤150-line src; tests exempt, §10)
│   ├── client/                   # @hena-dev/client    — typed protocol client
│   ├── web-ui/                   # @hena-dev/web-ui    — default UI extension (§8)
│   └── hena/                     # @hena-dev/hena      — CLI entrypoint: `hena serve`
├── test/
│   └── e2e/                      # cross-package e2e suites (server+UI+script provider)
├── flake.nix                     # nix devshell + CI toolchain (bun, tsgo, playwright)
├── biome.jsonc
├── turbo.json                    # Turborepo task graph + cache
└── package.json                  # bun workspaces + root scripts
```

- **Versioning/release:** lockstep version across all packages (Effect/pi
  style), changesets, npm provenance from CI. Pre-1.0: breaking allowed at
  minor, **but event-schema changes always ship migrations** (3.12).
- Config dir `~/.config/hena/`, data dir `~/.local/share/hena/`, env prefix
  `HENA_`. Windows is not a v1 target (Bun-only, XDG paths; WSL works).

---

## 10. Engineering standards

- **Toolchain:** Bun (workspaces, runtime); Turborepo for package task
  orchestration and local/CI caching; vitest as the test runner — explicitly
  not `bun test` — executed under the Bun runtime; `tsgo`
  (`@typescript/native-preview@latest`) for typechecking, Biome v2, knip in CI,
  Nix flake for the dev shell and CI.
- **Biome v2** — all of the following set to **error**:
  - `complexity/noExcessiveLinesPerFunction`
  - `nursery/noExcessiveLinesPerFile` (**150 lines**; needs Biome ≥ 2.3.12)
  - `complexity/noExcessiveCognitiveComplexity`
  - `suspicious/noExplicitAny`
  - Consequence embraced: the codebase is many small single-concern files;
    the 150-line cap is a design tool, not an obstacle.
- **Exemption policy (narrow, documented):**
  - Generated files (models.dev snapshot, schema-derived client, scaffolds):
    excluded from lint caps and coverage, each exclusion listed in config with
    a comment.
  - Test files: exempt from the 150-line file cap and function-size caps;
    all other rules apply.
  - Source files: no exemptions; no inline `biome-ignore` without a linked
    issue.
- **Coverage: 100% lines/branches/functions/statements, enforced per package
  in CI** (vitest coverage thresholds, **istanbul provider** — the v8 provider
  needs `node:inspector`, which Bun does not implement). Live-model tests are
  env-gated and excluded from the gate. `web-ui` exception: components are
  exercised by Playwright e2e (outside the numeric gate); the 100% gate
  applies to its logic modules (event→view-model reducers, protocol glue).
- **knip** in CI: no unused files/exports/deps — keeps maximal-granularity
  extensions honest.
- **Effect usage:** effect-smol (Effect v4 beta) for core internals only;
  Effect Schema is the single source of truth for events, config, and
  protocol types. Public API exposes no Effect types.

### 10.1 Testing strategy (three required tiers)

| Tier | Scope | Model | Notes |
|---|---|---|---|
| Unit | per file/module | `provider-script` or pure fakes | Hooks contracts, reducers, conversion fn, matchers, schema migrations |
| Integration | real runtime + real extensions (sqlite, permissions, compaction, recovery) in-process | `provider-script` | Loop semantics end-to-end: steering, asks, abort, overflow→compact→continue, hot reload |
| e2e | real `hena serve` over HTTP/SSE; Web UI via Playwright | `provider-script` | Protocol contract, client generation, UI flows; plus env-gated live-model smoke suite (excluded from coverage) |

The scripted provider is a **first-class product feature**, not test-only:
downstream extension authors use it to test their own extensions.

---

## 11. Decided defaults (from the interview, condensed)

| Topic | Decision |
|---|---|
| Identity | Headless runtime/server first |
| Loop state | In-memory reducer + event stream; persistence subscribes |
| Turn execution | Own loop; `streamText` single-step per turn |
| Effect boundary | Effect core; Promise extension API |
| Core contents | The §3 inventory: loop, events, transcript, dispatch, queues, ask, hooks, registry, config — nothing else |
| Extension API | Imperative ExtensionAPI (pi-style); ports/registries/hooks semantics |
| Isolation | In-process, errors contained; no sandbox (containerize instead) |
| Hook dispatch | Ordered transforms with timeouts; concurrent observers |
| Self-improvement | self-dev extension; hot reload; tests-pass + ask-before-activate |
| Protocol | Own HTTP+SSE, schema-derived; localhost, no token auth default, origin-validated |
| Transcript | Own minimal event-sourced format; single conversion to AI SDK |
| Mid-run | Steering + follow-up queues in core |
| Persistence default | SQLite (`bun:sqlite`) event log + projections |
| Compaction | Core: accounting+events+replace-op+continue; extension: policy |
| Approvals | Core ask/reply suspension primitive; extension: policy |
| Granularity | One extension per tool/feature; subpath exports, few packages |
| Default tools | read/write/edit/bash; lean sub-100-line prompt; AGENTS.md |
| Sub-agents | First-party extension on public APIs only; recursion off |
| Skills / MCP | Skills first-party (Anthropic spec); MCP extension post-v1 |
| Models | models.dev catalog + bundled providers; no runtime installs |
| Provider quirks | Trust AI SDK v7 + hook escape hatches; no transform layer |
| Retry | Outside loop: recovery extension on error events |
| Tool schemas | Standard Schema or raw JSON Schema |
| Runtime | Bun-only |
| Config | JSONC, Effect-Schema-validated, 5-level cascade, trust prompt |
| Tests | Scripted provider extension across all tiers |
| Coverage/lint | 100% per package; narrow documented exemptions |
| Release | Lockstep + changesets; MIT |
| Events | Versioned envelope + migrations from day 1 |
| Observability | Effect spans in core; OTel-export extension |
| Reference client | Default Web UI extension (React/Vite/Tailwind/shadcn/TanStack Router) |
| Terminology | "extension" everywhere (config key `extensions`) |
| Name/scope/docs | hena; `@hena-dev/*`; docs English-only under `docs/en/` |

---

## 12. Risks and watch items

1. **Two beta foundations.** Effect v4 (effect-smol) and AI SDK v7 both churn;
   unified-version Effect releases and AI SDK canaries can break weekly.
   Mitigation: pin exactly, upgrade deliberately, confine AI SDK types to the
   provider extension + one conversion function, confine Effect to core. AI
   SDK v7 is canary-only today: pin a known-good canary; if stable v7 slips
   past M0, ship on v6 stable behind the same seam.
2. **Biome `nursery/noExcessiveLinesPerFile`** is a nursery rule; semantics
   may shift. Mitigation: treat the 150-line cap as project law independent of
   the rule's fate.
3. **100% branch coverage** on error/abort paths is the expensive part —
   priced in; the scripted provider must support error/abort/overflow
   injection from day 1 or coverage stalls.
4. **No-auth localhost server** that executes bash is a real attack surface.
   Mandatory `Origin`/`Host` validation from day 1 (CSRF/DNS-rebinding);
   documented loudly; token auth available; revisit default before 1.0.
5. **Hot reload via cache-busted import** leaks module instances by design
   (old modules stay in memory until process restart). Acceptable for v1;
   document.
6. **Maximal extension granularity** risks registry/config sprawl —
   mitigated by subpath packaging and knip, but UX of configuring ~20
   extensions needs care (good defaults, profiles later).
7. **In-process self-modification** can still wedge the process (infinite
   loop in a hook is only bounded by timeouts). Worker-tier isolation for
   agent-written extensions is a known possible hardening, deliberately
   deferred.
8. **vitest under Bun** is not an officially supported pairing, and
   `@vitest/coverage-v8` requires `node:inspector` (unimplemented in Bun) —
   hence the istanbul provider. Mitigation: pin vitest, keep a CI canary job
   for runner upgrades; if blocked, split suites (Node for runtime-agnostic
   packages, Bun for Bun-API packages).

## 13. Milestones

- **M0 — kernel:** core package (loop, events, transcript, dispatcher,
  registry, config, ask), provider + provider-script + server extensions,
  100% gates green, `hena serve` streams a scripted session over SSE.
- **M1 — usable agent:** read/write/edit/bash, system-prompt, skills,
  persistence-sqlite, permissions, recovery, compaction; sessions survive
  restart.
- **M2 — product surface:** server protocol frozen behind schema versioning,
  `@hena-dev/client` generation, Web UI extension, Playwright e2e.
- **M3 — differentiators:** self-dev (scaffold/test/hot-reload/approve),
  subagents, telemetry; first agent-authored extension merged as a demo.
- **Post-v1:** MCP extension, ACP bridge, auth hardening, worker-tier
  isolation option, additional persistence ports.
