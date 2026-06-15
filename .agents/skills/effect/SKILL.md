---
name: effect
description: Work with Effect v4 / effect-smol TypeScript code in this repo
---

# Effect

This codebase uses Effect for typed, composable TypeScript services, schemas, and workflows. This skill is the authoritative source for Effect and Effect-test patterns in this repo; prefer it over rules restated elsewhere.

## Source Of Truth

Use the current Effect v4 / effect-smol source, not memory or older Effect v2/v3 examples.

1. If `.agents/references/effect-smol` is missing, clone `https://github.com/Effect-TS/effect-smol` there. Do this in the project, not in the skill folder.
2. Search `.agents/references/effect-smol` for exact APIs, examples, tests, and naming patterns before answering or implementing Effect-specific code.
3. Also inspect existing repo code for local house style before introducing new patterns.
4. Prefer answers and implementations backed by specific source files or nearby repo examples.

## Guidelines

- Prefer current Effect v4 APIs and project-local patterns over old blog posts, examples, or package-memory guesses.
- Use `Effect.gen(function* () { ... })` for multi-step workflows.
- Use `Effect.fn("Name")` or `Effect.fnUntraced(...)` for named effects when adding reusable service methods or important workflows.
- Prefer Effect `Schema` for API and domain data shapes. Use branded schemas for IDs and `Schema.TaggedErrorClass` for typed domain errors when modeling new error surfaces.
- Keep HTTP handlers thin: decode input, read request context, call services, and map transport errors. Put business rules in services.
- In Effect service code, prefer Effect-aware platform abstractions and dependencies over ad hoc promises where the surrounding code already does so.
- Keep layer composition explicit. Avoid broad hidden provisioning that makes missing dependencies hard to see.
- In tests, prefer the repo's existing Effect test helpers and live tests for filesystem, git, child process, locks, or timing behavior.
- Do not introduce `any`, non-null assertions, unchecked casts, or older Effect APIs just to satisfy types.
- Do not answer from memory. Verify against `.agents/references/effect-smol` or nearby code first.

## Testing Patterns

- Import test helpers from `@effect/vitest` (every package depends on it via the root catalog), and prefer its `assert` over `expect` from `vitest`.
- Use `@effect/vitest` (`it.effect(...)`) for tests that exercise Effect services, layers, runtime context, scoped resources, or platform integrations.
- Use plain `it(...)` for pure synchronous tests.
- Use `it.live(...)` for filesystem, git repositories, HTTP servers, sockets, child processes, locks, real time, and other live platform behavior.
- Do not use `Effect.runSync` in tests.
- Test files are co-located in `packages/*/src/` as `*.test.ts`. Run tests from package directories such as `packages/core` (e.g. `bun --bun vitest run`); never run package tests from the repo root.
- Prefer explicit test layers over ad hoc managed runtimes. Keep dependency provisioning visible in the test file.
- Use scoped fixtures and finalizers for resources that must be cleaned up, including temporary directories, flags, databases, fibers, servers, and global state.
